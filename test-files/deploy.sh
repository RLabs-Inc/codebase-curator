#!/bin/bash
# Deployment script for production environment

set -euo pipefail

# Configuration
readonly DEPLOY_USER="deploy"
readonly DEPLOY_HOST="production.example.com"
readonly APP_DIR="/var/www/app"
readonly BACKUP_DIR="/var/backups/app"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check for required commands
    local required_commands=("git" "npm" "rsync" "ssh")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command '$cmd' not found"
            return 1
        fi
    done
    
    # Check SSH connectivity
    if ! ssh -q "$DEPLOY_USER@$DEPLOY_HOST" exit; then
        log_error "Cannot connect to $DEPLOY_HOST"
        return 1
    fi
    
    log_info "All prerequisites met"
    return 0
}

# Build application
build_application() {
    log_info "Building application..."
    
    # Install dependencies
    npm ci --production
    
    # Run build
    npm run build
    
    # Run tests
    if ! npm test; then
        log_error "Tests failed, aborting deployment"
        return 1
    fi
    
    log_info "Build completed successfully"
}

# Deploy to server
deploy_to_server() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local release_dir="${APP_DIR}/releases/${timestamp}"
    
    log_info "Deploying to $DEPLOY_HOST..."
    
    # Create release directory
    ssh "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p $release_dir"
    
    # Sync files
    rsync -avz --delete \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude '.env' \
        --exclude 'logs' \
        ./dist/ "$DEPLOY_USER@$DEPLOY_HOST:$release_dir/"
    
    # Update symlink
    ssh "$DEPLOY_USER@$DEPLOY_HOST" <<EOF
        cd $APP_DIR
        ln -sfn $release_dir current
        
        # Restart application
        sudo systemctl restart app.service
        
        # Check if service is running
        sleep 5
        if systemctl is-active --quiet app.service; then
            echo "Service started successfully"
        else
            echo "Service failed to start"
            exit 1
        fi
EOF
    
    log_info "Deployment completed"
}

# Cleanup old releases
cleanup_releases() {
    log_info "Cleaning up old releases..."
    
    ssh "$DEPLOY_USER@$DEPLOY_HOST" <<'EOF'
        cd /var/www/app/releases
        # Keep only last 5 releases
        ls -t | tail -n +6 | xargs -r rm -rf
EOF
}

# Main deployment flow
main() {
    log_info "Starting deployment process..."
    
    # Parse command line arguments
    while getopts "hf" opt; do
        case $opt in
            h)
                echo "Usage: $0 [-f]"
                echo "  -f  Force deployment without confirmation"
                exit 0
                ;;
            f)
                FORCE=true
                ;;
            \?)
                log_error "Invalid option: -$OPTARG"
                exit 1
                ;;
        esac
    done
    
    # Confirmation prompt
    if [[ "${FORCE:-false}" != "true" ]]; then
        read -p "Deploy to production? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warning "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Execute deployment steps
    if ! check_prerequisites; then
        exit 1
    fi
    
    if ! build_application; then
        exit 1
    fi
    
    if ! deploy_to_server; then
        log_error "Deployment failed"
        exit 1
    fi
    
    cleanup_releases
    
    log_info "Deployment completed successfully! 🚀"
}

# Run main function
main "$@"