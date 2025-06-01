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

### 🔍 Smart Grep - Semantic Code Search

```bash
# Don't just search - understand
smartgrep "auth"

# Returns organized results:
# → Functions: authenticate() (12 uses), validateUser() (5 uses)
# → Classes: AuthService, AuthMiddleware
# → Patterns: JWT tokens, session management
# → Cross-references: Shows where each is used
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

### Smart Grep CLI

```bash
# Install globally
bun link

# Search your codebase semantically
smartgrep "database"           # Find all database patterns
smartgrep "user|auth"          # OR search
smartgrep "async&function"      # AND search
smartgrep "!test" --type function  # Exclude tests
smartgrep refs "PaymentService"    # Find all usages
```

## 🏗️ Architecture

### Two-Claude System

- **Coding Claude**: You, working in Claude Code
- **Curator Claude**: Your dedicated codebase expert
- **Communication**: Via MCP (Model Context Protocol)

### Smart Components

- **Session Persistence**: Maintains context between questions
- **Dynamic Timeouts**: Adapts to different operations
- **Semantic Indexing**: Understands code structure, not just text
- **Streaming Architecture**: Handles massive codebases efficiently

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development

```bash
# Run tests
bun test

# Run MCP server locally
bun run src/mcp/server.ts

# Run CLI
bun run src/cli/app.ts
```

## 📄 License

MIT - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

Built with ❤️ by [RLabs Inc.](https://github.com/RLabs-Inc) and Claude

Special thanks to the Claude Code team for making this integration possible.

---

_Remember: Your Claude works hard to help you code. Give it the superpower it deserves!_ 🚀
