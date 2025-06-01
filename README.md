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

### 🔍 Smart Grep - Semantic Code Search

```bash
# Don't just search - understand
smartgrep group auth            # Search ALL auth patterns
smartgrep "handleAuth"         # Search specific term

# Returns organized results:
# → Functions: authenticate() (12 uses), validateUser() (5 uses)
# → Classes: AuthService, AuthMiddleware  
# → Strings: "Login failed", "Invalid token"
# → Cross-references: Shows actual calling code

# Advanced patterns
smartgrep "error&handler"       # AND search
smartgrep "login|signin|auth"   # OR search
smartgrep "!test" --type function # Exclude tests
```

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

1. **Clone and install**

```bash
git clone https://github.com/RLabs-Inc/codebase-curator.git
cd codebase-curator
bun install
```

2. **Configure Claude Code MCP**
   Add to your `claude_code_config.json`:

```json
{
  "mcpServers": {
    "codebase-curator": {
      "command": "bun",
      "args": ["run", "/path/to/codebase-curator/src/mcp/server.ts"]
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

### Smart Grep CLI - Now with Concept Groups!

```bash
# Install globally
bun link

# Concept groups - search semantic patterns
smartgrep group auth           # ALL auth patterns (login, jwt, token...)
smartgrep group error          # ALL error patterns (exception, fail...)
smartgrep group api            # ALL API patterns (endpoint, route...)
smartgrep --list-groups        # See all 20+ concept groups

# Advanced search patterns
smartgrep "user|auth"          # OR search
smartgrep "async&function"      # AND search  
smartgrep "!test" --type function  # Exclude tests
smartgrep refs "PaymentService"    # Find all usages

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

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development

```bash
# Run tests
bun test

# Run MCP server locally
bun run src/mcp/server.ts

# Run CLI tools
bun run src/cli/app.ts            # Curator CLI
bun run smartgrep [query]         # Smart grep
bun run monitor watch --overview  # Live monitoring

# Build semantic index
bun run smartgrep index
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

## 🎆 What's New

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
