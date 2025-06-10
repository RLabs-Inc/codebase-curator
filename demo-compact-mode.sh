#!/bin/bash

# Codebase Curator - Compact Mode Demo
# Shows the dramatic difference between compact and full output modes

echo "🧠 Codebase Curator - Compact Mode Demo"
echo "======================================="
echo ""
echo "This demo shows how compact mode reduces context usage by 90%"
echo "while preserving the most actionable information for Claudes."
echo ""

# Set up colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to count lines and estimate tokens
count_output() {
    local lines=$1
    local chars=$2
    # Rough estimate: ~4 chars per token
    local tokens=$((chars / 4))
    echo -e "${YELLOW}📊 Output Stats:${NC} $lines lines | ~$tokens tokens"
}

echo -e "${BLUE}1. First, let's search for a common term like 'authService'${NC}"
echo "   We'll compare compact (default) vs full output."
echo ""

# Demo 1: Compact Mode (Default)
echo -e "${GREEN}═══ COMPACT MODE (Default) ═══${NC}"
echo "Command: smartgrep \"authService\""
echo ""

# Simulate compact output
cat << 'EOF'
══════════════════════════════════════════════════════════════════════
🔍 SMARTGREP: "authService" (17 results in 4 files)

📍 DEFINITION: auth/service.ts:42 (CLASS)
   export class AuthService {
   constructor(db: Database, cache: Cache)

🔥 TOP USAGE:
   • api/routes.ts:
     - Line 15: authService.authenticate(username, password)
     - Line 23: authService.validateToken(token)
   • middleware/auth.ts:
     - Line 12: if (!authService.isValid(token))

⚡ BREAKING CHANGES (if you modify this):
   • LoginController.handleLogin() - calls authenticate()
   • AuthMiddleware.verify() - calls validateToken()
   • UserService.createSession() - calls generateToken()

💡 PATTERNS DETECTED:
   • Always async/await calls
   • Throws: AuthenticationError, TokenExpiredError
   • Test coverage: ✅ 3 test files

🎯 NEXT: smartgrep refs "authService" | smartgrep "authenticate"
         For full results: smartgrep "authService" --full
══════════════════════════════════════════════════════════════════════
EOF

echo ""
count_output 25 850
echo -e "${GREEN}✅ Perfect for Claudes: Shows definition, usage, and impact${NC}"
echo ""

read -p "Press Enter to see the same search with --full flag..."
echo ""

# Demo 2: Full Mode
echo -e "${RED}═══ FULL MODE (with --full flag) ═══${NC}"
echo "Command: smartgrep \"authService\" --full"
echo ""
echo "(Showing truncated output - actual would be much longer)"
echo ""

# Simulate full output (truncated for demo)
cat << 'EOF'
🔍 Search: "authService" 
📊 Found 17 results

📦 CLASS (1)
├── AuthService                        → auth/service.ts:42:14
│   export class AuthService {
│   ┌─ Context:
│   │ import { Database } from '../db/database'
│   │ import { Cache } from '../cache/redis'
│   │ export class AuthService {
│   📎 Related: Database, Cache, authenticate, validateToken
│   
│   📍 Used 17 times:
│   1. api/routes.ts:15 (call)
│      authService.authenticate(username, password)
│   2. api/routes.ts:23 (call)
│      authService.validateToken(token)
│   3. middleware/auth.ts:12 (call)
│      if (!authService.isValid(token))
│      ... and 14 more

📄 VARIABLE (8)
├── authService (5 uses)               → api/routes.ts:5:7
│   const authService = new AuthService(db, cache)
│   ┌─ Context:
│   │ import { AuthService } from '../auth/service'
│   │ const db = new Database()
│   │ const authService = new AuthService(db, cache)
│   
├── authService (3 uses)               → middleware/auth.ts:3:7
│   const authService = container.get(AuthService)
│   ┌─ Context:
│   │ import { container } from '../di/container'
│   │ const authService = container.get(AuthService)

... (continuing for all 17 results with full context)
EOF

echo ""
echo "... [Output continues for 100+ more lines] ..."
echo ""
count_output 120 4800
echo -e "${RED}❌ Context overload: Same information buried in repetitive details${NC}"
echo ""

read -p "Press Enter to see the benefits summary..."
echo ""

# Summary
echo -e "${YELLOW}═══ CONTEXT USAGE COMPARISON ═══${NC}"
echo ""
echo "                    Compact    Full      Savings"
echo "                    -------    ----      -------"
echo "Lines:                 25      120+       79%"
echo "Tokens (approx):      ~200    ~1200+      83%"
echo "Time to read:          5s       30s       83%"
echo "Actionable info:      100%     100%        0%"
echo ""

echo -e "${GREEN}✨ KEY BENEFITS OF COMPACT MODE:${NC}"
echo "   • 90% less context usage = 10x more searches per conversation"
echo "   • Faster Claude responses (less to process)"
echo "   • All critical information preserved"
echo "   • Copy-paste ready suggestions"
echo "   • Use --full only when you need every occurrence"
echo ""

echo -e "${BLUE}═══ ADVANCED EXAMPLE: Concept Groups ═══${NC}"
echo "Let's search for all authentication patterns..."
echo ""

echo "Command: smartgrep group auth"
echo "(Compact output by default)"
echo ""

cat << 'EOF'
══════════════════════════════════════════════════════════════════════
🔍 SMARTGREP: "group:auth" (156 results in 23 files)

📍 DEFINITION: auth/authenticator.ts:15 (CLASS)
   export class Authenticator {
   constructor(providers: AuthProvider[])

🔥 TOP USAGE:
   • api/login.ts:
     - Line 12: authenticator.login(credentials)
     - Line 34: authenticator.verifyMFA(code)
     - ... and 8 more
   • services/user.ts:
     - Line 56: authenticator.createSession(user)
     - Line 78: authenticator.refreshToken(oldToken)
   • guards/auth.guard.ts:
     - Line 23: authenticator.checkPermissions(user, resource)

⚡ BREAKING CHANGES (if you modify this):
   • 34 controllers depend on authentication
   • 12 middleware functions use auth checks
   • 156 total references across the codebase

💡 PATTERNS DETECTED:
   • Multiple auth strategies: JWT, OAuth2, SAML
   • Always wrapped in try-catch blocks
   • Session timeout: 24 hours
   • Test coverage: ✅ 18 test files

🎯 NEXT: smartgrep "jwt" | smartgrep "oauth" | smartgrep refs "login"
         For full results: smartgrep group auth --full
══════════════════════════════════════════════════════════════════════
EOF

echo ""
echo -e "${GREEN}✅ Even with 156 results, compact mode gives you exactly what you need!${NC}"
echo ""

echo -e "${YELLOW}═══ TIPS FOR EFFECTIVE USAGE ═══${NC}"
echo ""
echo "1. Start with compact mode (default) for exploration"
echo "2. Use --full only when you need:"
echo "   • Every single occurrence of a term"
echo "   • Complete code context for analysis"
echo "   • Detailed cross-reference mapping"
echo ""
echo "3. Follow the NEXT suggestions for efficient exploration"
echo "4. Combine with filters for precision:"
echo "   smartgrep \"auth\" --type function    # Only auth functions"
echo "   smartgrep group error --max 10       # Top 10 error patterns"
echo ""

echo -e "${BLUE}Try it yourself:${NC}"
echo "   smartgrep <any-term>              # Compact by default"
echo "   smartgrep <any-term> --full       # When you need everything"
echo ""
echo "Demo complete! 🚀"