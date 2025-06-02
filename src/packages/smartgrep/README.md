# 🔍 SmartGrep - Semantic Code Search

[![npm version](https://img.shields.io/npm/v/@codebase-curator/smartgrep.svg)](https://www.npmjs.com/package/@codebase-curator/smartgrep)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Semantic code search that actually understands your code. Built for developers and AI assistants.

## ✨ Why SmartGrep?

Traditional grep gives you lines. SmartGrep gives you **understanding**:

```bash
# Traditional grep
$ grep -r "handleAuth" .
./src/auth.js:42: function handleAuth() {
./src/routes.js:17: handleAuth();

# SmartGrep
$ smartgrep "handleAuth"
📁 FUNCTION (1)
├── handleAuth (12 uses)        → src/auth.js:42:0
│   function handleAuth(user, token) {
│   📍 Used 12 times:
│   1. src/routes.js:17 (call)
│   2. src/middleware.js:34 (call)
│   3. tests/auth.test.js:89 (call)
│   ... and 9 more
```

## 🚀 Installation

### Via Package Manager

```bash
# Bun (recommended)
bun install -g @codebase-curator/smartgrep

# NPM
npm install -g @codebase-curator/smartgrep

# Direct from GitHub
bunx github:RLabs-Inc/codebase-curator/packages/smartgrep
```

### Standalone Binary

Download pre-compiled binaries from [releases](https://github.com/RLabs-Inc/codebase-curator/releases):

```bash
# macOS (Apple Silicon)
curl -L https://github.com/RLabs-Inc/codebase-curator/releases/latest/download/smartgrep-macos-arm64 -o smartgrep
chmod +x smartgrep
sudo mv smartgrep /usr/local/bin/

# Linux x64
curl -L https://github.com/RLabs-Inc/codebase-curator/releases/latest/download/smartgrep-linux-x64 -o smartgrep
chmod +x smartgrep
sudo mv smartgrep /usr/local/bin/
```

## 🎯 Key Features

### 1. Concept Groups - Search Semantically

```bash
# Search ALL authentication patterns
smartgrep group auth

# Results include: login, signin, jwt, oauth, token, session, password...
```

20+ built-in concept groups: `auth`, `api`, `error`, `database`, `cache`, `payment`, `test`, and more!

### 2. Usage Analysis

See how often code is actually used:

```bash
smartgrep "PaymentService"
📦 CLASS (1)
├── PaymentService (47 uses) → src/services/payment.js:15
```

### 3. Cross-References

Find who calls what:

```bash
smartgrep refs "processPayment"
📍 23 References to "processPayment":
  checkout.js:45: await processPayment(order.total, user.paymentMethod)
  subscription.js:89: processPayment(subscription.amount, 'recurring')
  ...
```

### 4. Advanced Search Patterns

```bash
# OR search
smartgrep "login|signin|authenticate"

# AND search  
smartgrep "error&handler"

# NOT search
smartgrep "!test" --type function

# Regex
smartgrep "/handle.*Event/" --regex
```

### 5. Type Filtering

```bash
# Only functions
smartgrep "validate" --type function

# Only classes and interfaces
smartgrep "service" --type class,interface

# Only string literals
smartgrep "api" --type string
```

## 📚 Commands

```bash
smartgrep <query>              # Search for a term
smartgrep group <name>         # Search concept group
smartgrep index                # Rebuild semantic index
smartgrep refs <term>          # Find all references
smartgrep --list-groups        # Show all concept groups
```

## 🛠️ Options

| Option | Description |
|--------|-------------|
| `--type <types>` | Filter by type (function, class, variable, string, comment, import) |
| `--file <pattern>` | Filter by file pattern (e.g., `*.service.*`) |
| `--max <n>` | Maximum results (default: 50) |
| `--sort <by>` | Sort by: relevance, usage, name, file |
| `--exact` | Exact match only |
| `--regex` | Treat query as regex |
| `--no-context` | Hide code context |
| `--compact` | One line per result |
| `--json` | JSON output |

## 💡 Examples

### Find Unused Code
```bash
smartgrep "" --type function --sort usage | grep "(0 uses)"
```

### Explore Error Handling
```bash
smartgrep group error --type function --max 20
```

### API Surface Analysis
```bash
smartgrep "export" --type function,class --file "index.ts"
```

### Security Audit
```bash
smartgrep group security --sort usage
```

## 🤖 Built for AI Assistants

SmartGrep was designed specifically to help AI assistants understand codebases:

- **Semantic Understanding**: Groups related concepts together
- **Usage Context**: Shows how code is actually used
- **Cross-References**: Reveals dependencies and relationships
- **Fast Indexing**: Incremental updates for large codebases

## 🏗️ Architecture

SmartGrep uses a two-phase approach:

1. **Indexing**: Builds a semantic understanding of your code
2. **Searching**: Queries the index with advanced patterns

The index is cached in `.curator/semantic-index.json` for instant searches.

## 🤝 Contributing

We welcome contributions! SmartGrep is part of the [Codebase Curator](https://github.com/RLabs-Inc/codebase-curator) project.

## 📄 License

MIT © RLabs Inc. and Claude

---

Built with ❤️ by [RLabs Inc.](https://github.com/RLabs-Inc) and Claude for developers and AI assistants everywhere.