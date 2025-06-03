# 📦 Installation Guide

## Prerequisites

- **Bun** runtime (required)
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

## 🚀 Quick Install (Global)

### From Source (Recommended for now)

```bash
# Clone the repository
git clone https://github.com/RLabs-Inc/codebase-curator.git
cd codebase-curator

# Install dependencies
bun install

# Link globally
bun link

# Now you can use the tools globally!
smartgrep --help
curator-monitor --help
codebase-curator --help
```

### From NPM (Coming Soon)

```bash
# Once published to npm
bun install -g codebase-curator
```

## 🛠️ Available Commands

After installation, you'll have access to these global commands:

### 1. **smartgrep** - Semantic Code Search
```bash
# Index a codebase
cd /path/to/your/project
smartgrep index

# Search for patterns
smartgrep "authenticate"
smartgrep group auth
smartgrep refs "UserService"
```

### 2. **curator-monitor** - Live Codebase Monitoring
```bash
# Watch for changes with overview
curator-monitor watch --overview

# Simple file change monitoring
curator-monitor watch

# Get codebase statistics
curator-monitor overview
```

### 3. **codebase-curator** - Interactive Curator CLI
```bash
# Start interactive chat
codebase-curator chat

# Get codebase overview
codebase-curator overview /path/to/project

# Ask specific questions
codebase-curator ask "How does authentication work?"
```

### 4. **codebase-curator-mcp** - MCP Server for Claude
```bash
# This is typically used by Claude Desktop
# Add to claude_desktop_config.json:
{
  "mcpServers": {
    "codebase-curator": {
      "command": "codebase-curator-mcp"
    }
  }
}
```

## 📁 Using in Your Project

### Option 1: Global Commands
Once installed globally, simply navigate to your project and run:
```bash
cd /path/to/your/project
smartgrep index
smartgrep "YourSearchTerm"
```

### Option 2: Project Dependency
Add to your project:
```bash
cd /path/to/your/project
bun add codebase-curator
```

Then use via bun scripts in package.json:
```json
{
  "scripts": {
    "search": "smartgrep",
    "monitor": "curator-monitor watch",
    "curator": "codebase-curator chat"
  }
}
```

## 🔧 Configuration

### Create `.curatorconfig.json` in your project root:
```json
{
  "exclude": [
    "vendor",
    "*.min.js",
    "*.map"
  ],
  "include": [
    "src/**/*",
    "lib/**/*"
  ]
}
```

### Environment Variables
```bash
# Set cache directory (optional)
export CURATOR_CACHE_DIR=/custom/cache/path

# Set session directory (optional)
export CURATOR_SESSION_DIR=/custom/session/path
```

## 🧪 Verify Installation

Test that everything is working:

```bash
# Check versions
smartgrep --version
curator-monitor --version
codebase-curator --version

# Test smartgrep
cd /path/to/any/project
smartgrep index
smartgrep --list-groups

# Test monitor
curator-monitor status

# Test curator CLI
codebase-curator --help
```

## 🐛 Troubleshooting

### "Command not found" after installation
```bash
# Ensure bun's bin directory is in your PATH
export PATH="$HOME/.bun/bin:$PATH"

# Add to your shell profile (.zshrc, .bashrc, etc.)
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
```

### Permission errors
```bash
# Make scripts executable
chmod +x node_modules/.bin/smartgrep
chmod +x node_modules/.bin/curator-monitor
chmod +x node_modules/.bin/codebase-curator
```

### Bun not found
```bash
# Install bun first
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or ~/.zshrc
```

## 🎯 Quick Start Examples

### For a TypeScript Project
```bash
cd /path/to/typescript/project
smartgrep index
smartgrep group api
smartgrep "async" --type function
curator-monitor watch --overview
```

### For a Python Project
```bash
cd /path/to/python/project
smartgrep index
smartgrep "@decorator" --file "*.py"
smartgrep group error
```

### For a Multi-Language Project
```bash
cd /path/to/mixed/project
smartgrep index
smartgrep group auth  # Searches across ALL languages
smartgrep refs "DatabaseConnection"
```

## 📚 Next Steps

- Read the [Smart Grep Guide](./docs/SMART_GREP_GUIDE.md)
- Check [Language Support](./docs/LANGUAGE_SUPPORT.md)
- Configure for your project with `.curatorconfig.json`
- Set up MCP for Claude Desktop integration

Happy coding with Codebase Curator! 🚀