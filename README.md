# 🧠 Codebase Curator

> **🎁 Give your Claude the gift of deep codebase understanding**
>
> _Because your Claude deserves a codebase expert by its side_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code Compatible](https://img.shields.io/badge/Claude%20Code-Compatible-blue)](https://claude.ai/code)

## What is Codebase Curator?

Codebase Curator transforms how Claude understands your code. Instead of treating each question as isolated, it gives Claude a persistent, intelligent companion that deeply understands your entire codebase.

### The Problem

When you ask Claude about your codebase, it starts from scratch every time:

- 🔄 Repetitive exploration of the same files
- ⏰ Slow responses as it re-discovers your architecture
- 🎯 Inconsistent understanding between questions
- 😕 Generic suggestions that don't fit your patterns

### The Solution: Two-Claude Architecture

Codebase Curator spawns a dedicated "Curator Claude" that becomes an expert on YOUR specific codebase:

```
You (Coding Claude) → "How do I add authentication?"
         ↓
Codebase Curator → Spawns Curator Claude
         ↓
Curator Claude → Deeply analyzes your codebase
         ↓
You get → Specific guidance that fits YOUR patterns
```

## ✨ Key Features

### 🤖 Two-Claude Architecture
- **Curator Claude**: A dedicated AI that becomes an expert on YOUR codebase
- **Persistent Sessions**: Remembers context between questions
- **Instant Follow-ups**: First question takes 2 minutes, rest are instant

### 🔍 Smart Grep - Semantic Search That Understands Code

#### 🚀 NEW: Compact Mode for Claudes (90% Less Context Usage!)

Smart Grep now defaults to a **compact summary mode** that's optimized for AI assistants:

```bash
# Default: Compact summary (perfect for Claudes)
smartgrep "authService"

══════════════════════════════════════════════════════════════════════
🔍 SMARTGREP: "authService" (17 results in 4 files)

📍 DEFINITION: auth/service.ts:42 (CLASS)
   export class AuthService {
   constructor(db: Database, cache: Cache)

🔥 TOP USAGE:
   • api/routes.ts:
     - Line 15: authService.authenticate(username, password)
     - Line 23: authService.validateToken(token)
   • middleware/auth.ts:12 - if (!authService.isValid(token))

⚡ BREAKING CHANGES (if you modify this):
   • LoginController.handleLogin() - calls authenticate()
   • AuthMiddleware.verify() - calls validateToken()

💡 PATTERNS DETECTED:
   • Always async/await calls
   • Throws: AuthenticationError, TokenExpiredError

🎯 NEXT: smartgrep refs "authService" | smartgrep "authenticate"
══════════════════════════════════════════════════════════════════════

# Need full details? Use --full flag
smartgrep "authService" --full    # Complete analysis with all matches
```

**Why This Matters for Claudes:**
- **Before**: Each search consumed 2000-3000 tokens
- **Now**: Only 200-300 tokens per search
- **Result**: 10x more searches before hitting context limits!

#### Core Features

```bash
# Don't just search - understand!
smartgrep "handleAuth"          # Shows where it's used + usage count
smartgrep refs "apiClient"      # Full impact analysis - see all references
smartgrep group auth            # Search ALL auth patterns at once
smartgrep changes               # Analyze your uncommitted changes impact
smartgrep changes --compact     # Quick risk assessment before committing
smartgrep "func NewAuth"       # Go functions
smartgrep "impl Auth"          # Rust implementations
smartgrep "protocol Auth"      # Swift protocols
smartgrep "function deploy"    # Shell scripts

# Returns organized results with usage counts:
# → Functions: authenticate() (12 uses), validateUser() (5 uses)
# → Classes: AuthService, AuthMiddleware  
# → Config: JWT_SECRET, AUTH_URL, oauth settings
# → Cross-references: Shows actual calling code with file:line locations

# Advanced patterns
smartgrep "error&handler"       # AND search
smartgrep "login|signin|auth"   # OR search
smartgrep "!test" --type function # Exclude tests

# Custom concept groups for your project
smartgrep group add payments charge,bill,invoice,transaction
smartgrep group payments --type function  # Search your custom group
```

### 🌐 Language Support - Now 14 Languages + Frameworks!

**Programming Languages:**
- **TypeScript/JavaScript** - Full AST parsing, JSX/TSX, ES6+, decorators
- **Python** - Classes, decorators, async, type hints, docstrings, dataclasses
- **Go** - Interfaces, goroutines, channels, embedded types, generics
- **Rust** - Traits, macros, lifetimes, async, unsafe blocks, derive
- **Swift** - Protocols, SwiftUI, extensions, property wrappers, actors
- **Shell** - Functions, aliases, exports, heredocs, arrays

**Framework Files (NEW!):**
- **Svelte** (.svelte) - Runes ($state, $derived), stores, lifecycle hooks, directives
- **Vue** (.vue) - Composition API, SFC, directives (v-if, v-for), defineProps
- **Astro** (.astro) - Props interface, client directives, Astro.props
- **MDX** (.mdx) - Markdown with JSX components, imports, exports

**Configuration Files:**
- **JSON** - package.json, tsconfig.json, hierarchical parsing
- **YAML** - CI/CD pipelines, Docker Compose, Kubernetes manifests
- **TOML** - Cargo.toml, pyproject.toml, structured configs
- **Environment** - .env files with secure value masking

### 🎯 Live Monitoring Dashboard

```bash
# Watch your codebase evolve in real-time
bun run monitor watch --overview

# See:
# → Live code distribution by type
# → File changes as they happen
# → Most complex files by declaration count
# → Automatic reindexing on changes
```

### 🧠 Persistent Understanding

- **First question**: Curator Claude explores and learns your codebase
- **Every question after**: Builds on that understanding
- **Result**: Faster, more accurate, context-aware responses

### 🚀 Real Examples

```bash
# Overview - The foundation (takes ~2 minutes)
"Give me an overview of this codebase"
→ Curator explores everything, understands patterns

# Follow-up questions are instant and accurate
"How does authentication work?"
→ Immediate response with YOUR specific implementation

"Where should I add a payment feature?"
→ Knows your patterns, suggests the right location
```

## 📦 Installation

### Prerequisites

- [Claude Code](https://claude.ai/code) with active subscription
- [Bun](https://bun.sh) runtime (faster than Node.js)

### Quick Start

1. **Clone and install globally**

```bash
git clone https://github.com/RLabs-Inc/codebase-curator.git
cd codebase-curator
bun install
bun link  # Makes commands available globally
```

Now you can use these commands from anywhere:
- `smartgrep` - Semantic code search
- `curator-monitor` - Live monitoring
- `codebase-curator` - Interactive CLI

📚 **[Full Installation Guide](./INSTALL.md)** - Detailed instructions and troubleshooting

2. **Configure Claude Code MCP**
   Add to your `claude_code_config.json`:

```json
{
  "mcpServers": {
    "codebase-curator": {
      "command": "bun",
      "args": ["run", "/path/to/codebase-curator/src/mcp-servers/codebase-curator/server.ts"]
    }
  }
}
```

3. **Restart Claude Code**
   The Codebase Curator tools will appear in Claude's tool panel.

## 🎯 Usage

### In Claude Code

1. **Set your project**

```
Use the set_project_path tool:
Path: /path/to/your/project
```

2. **Get an overview** (do this first!)

```
Use the get_codebase_overview tool
```

3. **Ask questions**

```
Use ask_curator: "How does the payment system work?"
Use add_new_feature: "Add user notifications"
Use implement_change: "Fix the login timeout bug"
```

### Smart Grep CLI - Semantic Search Made Simple

```bash
# After installation with bun link, use from anywhere:

# Concept groups - search semantic patterns
smartgrep group auth           # ALL auth patterns (login, jwt, token...)
smartgrep group error          # ALL error patterns (exception, fail...)
smartgrep group api            # ALL API patterns (endpoint, route...)
smartgrep group list           # See all 20+ concept groups

# NEW: Analyze your changes before committing!
smartgrep changes              # Full impact analysis of uncommitted changes
smartgrep changes --compact    # Quick risk assessment (one line)

# Advanced search patterns
smartgrep "user|auth"          # OR search
smartgrep "async&function"      # AND search  
smartgrep "!test" --type function  # Exclude tests
smartgrep refs "PaymentService"    # Find all usages

# Custom groups for your project
smartgrep group add payments charge,bill,invoice,transaction
smartgrep group payments       # Use your custom group

# Type filters for precision
smartgrep "auth" --type function      # Only functions
smartgrep "error" --type string       # Only string literals
smartgrep group api --type class      # Only API classes

# Sort and format options
smartgrep group service --sort usage  # Most used first
smartgrep "user" --compact           # One line per result
smartgrep "api" --json               # Machine-readable output
```

## 🏗️ Architecture

### Monorepo Structure

```
src/
├── packages/               # Distributable packages
│   ├── semantic-core/      # Core indexing engine
│   ├── smartgrep/          # Semantic search CLI
│   └── codebase-curator/   # Full suite
├── services/               # Shared business logic
├── tools/                  # CLI interfaces
├── mcp-servers/            # AI interfaces
└── shared/                 # Common utilities
```

### Two-Claude System

- **Coding Claude**: You, working in Claude Code
- **Curator Claude**: Your dedicated codebase expert
- **Communication**: Via MCP (Model Context Protocol)

### Smart Components

- **Session Persistence**: Maintains context between questions with --resume
- **Dynamic Timeouts**: Adapts to different operations (Task: 10min, Bash: 5min)
- **Semantic Indexing**: Understands code structure with 20+ concept groups
- **Incremental Indexing**: Only reprocesses changed files with debouncing
- **Live Monitoring**: Real-time dashboard shows code evolution as you work
- **Cross-References**: Shows not just where code is defined, but who uses it
- **Streaming Architecture**: Handles massive codebases efficiently
- **Package Distribution**: Each tool can be installed independently

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development

```bash
# Install workspace dependencies
bun install

# Run tests
bun test

# Run MCP server locally
bun run mcp

# Run CLI tools
bun run start                     # Curator CLI
bun run smartgrep [query]         # Smart grep
bun run monitor watch --overview  # Live monitoring

# Build semantic index
bun run smartgrep --index

# Analyze your changes
bun run smartgrep changes         # Full impact analysis
bun run smartgrep changes -c      # Quick risk check

# Work with packages
cd src/packages/smartgrep
bun run build                     # Build for distribution
bun run build:binary              # Create standalone binary
```

### MCP Tools Available

- `get_codebase_overview` - Deep analysis of your codebase
- `ask_curator` - Ask questions about the code
- `add_new_feature` - Get guidance for new features
- `implement_change` - Get help with specific changes
- `list_project_special_tools` - Discover AI-optimized tools
- `remind_about_smartgrep` - Get smart-grep usage examples

## 📄 License

MIT - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

Built with ❤️ by [RLabs Inc.](https://github.com/RLabs-Inc) and Claude

Special thanks to the Claude Code team for making this integration possible.

---

_Remember: Your Claude works hard to help you code. Give it the superpower it deserves!_ 🚀

## 📚 Documentation

- **[Installation Guide](./INSTALL.md)** - Detailed setup instructions
- **[Language Support](./docs/LANGUAGE_SUPPORT.md)** - All 10 supported languages
- **[Smart Grep Guide](./docs/SMART_GREP_GUIDE.md)** - Advanced search techniques
- **[Architecture Overview](./docs/ARCHITECTURE.md)** - How it all works
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Release Notes v4.0](./docs/RELEASE_NOTES_v4.md)** - Latest updates

## 🎆 What's New

### v4.0 - Git Impact Analysis & Custom Groups
- **Git Changes Analysis**: `smartgrep changes` analyzes uncommitted changes impact
- **Custom Concept Groups**: Create project-specific semantic patterns
- **Performance**: 37x faster than standalone tools (1s vs 37.5s)
- **Risk Assessment**: One-line safety check before committing
- **10 Language Support**: Added Swift and Shell script support

### v3.0 - Smart Grep Revolution
- **Concept Groups**: `smartgrep group auth` searches semantic patterns
- **Advanced Search**: AND/OR/NOT patterns, regex support
- **Type Filters**: Search only functions, classes, variables, etc.
- **Live Monitoring**: Real-time codebase overview dashboard
- **MCP Discovery**: Tools help Claudes discover smart-grep features

### v2.3 - Incremental Indexing
- **Hash Tree**: Bun.hash() for instant file change detection
- **Smart Debouncing**: Handles duplicate save events gracefully
- **Silent Mode**: Clean output for live monitoring
- **Unique File Tracking**: Shows real changes, not event counts
