# Charm TUI - Beautiful Terminal Interfaces for Codebase Curator

This directory contains Go-based TUI (Terminal User Interface) implementations of the codebase curator tools, built with the Charm libraries (Bubble Tea, Bubbles, Lipgloss, and Glamour).

## 🎯 Design Philosophy

- **CLI-First**: By default, all tools run in fast CLI mode optimized for Claude productivity
- **Optional TUI**: Use the `--tui` flag to launch beautiful interactive interfaces
- **Pass-Through**: CLI mode directly calls the TypeScript implementations
- **Beautiful Rendering**: Markdown support, syntax highlighting, and elegant styling

## 🛠️ Tools

### 1. SmartGrep TUI
Semantic code search with interactive menus and beautiful output formatting.

```bash
# CLI mode (default - fast for Claude)
./smartgrep "auth"
./smartgrep group list
./smartgrep refs "handleAuth"
./smartgrep --index  # Rebuild index

# TUI mode (interactive for humans)
./smartgrep --tui
```

Features in TUI mode:
- 🔍 Pattern search with live results
- 📦 Browse and search concept groups
- 🔗 Find references interactively
- 📊 Analyze changes with visual feedback
- 🤖 Claude batch mode for comprehensive exploration

### 2. Curator TUI
AI-powered codebase assistant with beautiful markdown rendering.

```bash
# CLI mode (default)
./curator overview /path/to/project
./curator ask . "How does authentication work?"

# TUI mode (interactive chat)
./curator --tui
./curator chat --tui
```

Features in TUI mode:
- 💬 Interactive chat with context persistence
- 📝 Beautiful markdown rendering (via Glamour)
- 🎨 Syntax-highlighted code blocks
- 📊 Visual project selection
- 💾 Session management

### 3. Monitor TUI
Live codebase monitoring with real-time dashboard.

```bash
# CLI mode (default)
./monitor watch
./monitor status

# TUI mode (live dashboard)
./monitor --tui
./monitor watch --tui --overview
```

Features in TUI mode:
- 📊 Real-time file change tracking
- 📈 Visual statistics dashboard
- 🎨 Color-coded events (added/modified/deleted)
- 📜 Scrollable event history
- ⚡ Live updates every second

## 🚀 Installation

### Prerequisites
- Go 1.21 or higher
- Bun (for running TypeScript implementations)
- Access to the TypeScript tools in `../src/tools/`

### Build from source
```bash
# Download dependencies
make deps

# Build all tools
make build

# Or build individually
make smartgrep
make curator
make monitor

# Install to system (requires sudo)
sudo make install
```

### Run directly
```bash
# Development mode
make run-smartgrep
make run-curator
make run-monitor
```

## 🏗️ Project Structure

```
charm-tui/
├── cmd/                    # Entry points for each tool
│   ├── smartgrep/         # SmartGrep CLI/TUI
│   ├── curator/           # Curator CLI/TUI
│   └── monitor/           # Monitor CLI/TUI
├── internal/              # TUI implementations
│   ├── smartgrep/         # SmartGrep TUI logic
│   ├── curator/           # Curator TUI with markdown
│   └── monitor/           # Monitor dashboard logic
├── build/                 # Build output directory
├── go.mod                 # Go module definition
├── Makefile              # Build automation
└── README.md             # This file
```

## 🎨 Symbol Compatibility

Based on user feedback, we use emojis (which display beautifully) instead of problematic Unicode symbols:

**Safe to use:**
- ✅ All emojis (🔍 📦 🤖 💬 etc.)
- ✓ ✗ Basic checkmarks
- > * - Basic ASCII symbols

**Avoid:**
- ▸ ▶ (triangles)
- → ← ↑ ↓ (arrows)
- ─ │ ┌ └ (box drawing)

## 🔧 Development

### Adding new features
1. Update the cobra command in `cmd/[tool]/main.go`
2. Add TUI logic in `internal/[tool]/`
3. Ensure CLI mode passes through to TypeScript

### Testing
```bash
# Run all tests
make test

# Test CLI mode passthrough
./build/bin/smartgrep "test" --type function
./build/bin/curator overview .
./build/bin/monitor status

# Test TUI mode
./build/bin/smartgrep --tui
./build/bin/curator --tui
./build/bin/monitor --tui
```

## 📝 License

Same as the parent Codebase Curator project.