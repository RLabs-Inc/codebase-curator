# @codebase-curator/monitor

Real-time incremental indexing monitor for codebase analysis. Track file changes, view live dashboards, and analyze your codebase structure.

## Features

- 🔥 **Real-time Monitoring** - Watch file changes as they happen
- 📊 **Live Dashboard** - Dynamic codebase analytics that update on changes
- 🏗️ **Codebase Overview** - Static analysis with architectural insights
- ⚡ **Incremental Indexing** - Only reprocess changed files
- 📈 **Detailed Metrics** - Track unique files, events, and patterns

## Installation

```bash
# Using npm
npm install -g @codebase-curator/monitor

# Using bun
bun add -g @codebase-curator/monitor

# Or run directly with npx
npx @codebase-curator/monitor watch --overview
```

## Quick Start

```bash
# Basic monitoring of current directory
monitor watch

# Live dashboard with codebase analytics
monitor watch --overview

# Monitor a specific project
monitor watch -o /path/to/project

# Generate static codebase analysis
monitor overview

# Check index status and integrity
monitor status
```

## Commands

### `watch` / `monitor`
Start real-time file monitoring with optional live dashboard.

```bash
monitor watch [--overview] [project-path]
```

Options:
- `--overview`, `-o` - Enable live dashboard with codebase analytics

### `overview`
Generate a static snapshot of your codebase structure.

```bash
monitor overview [project-path]
```

Shows:
- Code distribution by type
- Most complex files
- Architectural patterns
- Code hotspots
- Potential entry points

### `status`
Display detailed technical information about the index.

```bash
monitor status [project-path]
```

### `rebuild`
Force a complete rebuild of the semantic index.

```bash
monitor rebuild [project-path]
```

## Live Dashboard

The live dashboard (`--overview` flag) provides:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                        🔥 LIVE CODEBASE MONITOR                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 📊 Tracked: 156 files │ Changed: 3 files │ Uptime: 5m 23s │ Watching: ✅    ║
║ 📈 Events: 42 │ Last Activity: 2s ago │ Overview: ✅ 1s ago                  ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 🏷️  CODE DISTRIBUTION:                                                       ║
║   function      234 (45.2%) █████████████████████████                       ║
║   class          89 (17.2%) █████████                                       ║
║   variable      156 (30.1%) ███████████████                                 ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 🧠 FILES BY SEMANTIC ELEMENTS:                                               ║
║   src/services/SemanticService.ts                             123 elements   ║
║   src/core/CuratorService.ts                                  98 elements   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 📁 RECENT CHANGES:                                                           ║
║   [10:23:45] ~ SemanticService.ts                                           ║
║   [10:23:42] + NewComponent.tsx                                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Architecture Detection

The monitor can identify common patterns:
- **Object-oriented** - High class to function ratio
- **Functional** - High function to class ratio  
- **Strong typing** - Many TypeScript interfaces/types

## Shell Completions

Completions are automatically installed for:
- **Bash** - Tab completion for commands and options
- **Zsh** - Advanced completion with descriptions
- **Fish** - User-friendly interactive completions

## Configuration

The monitor uses the `.curator` directory to store:
- `semantic-index.json` - The semantic index
- `semantic/hashtree.json` - File change tracking

## Performance

- Uses Bun's native file watcher for efficiency
- Debounced updates (500ms) to handle rapid changes
- Incremental indexing only processes changed files
- Silent mode prevents console spam during live monitoring

## Examples

### Development Workflow
```bash
# Start monitoring while coding
monitor watch --overview

# In another terminal, make changes
# The dashboard updates automatically!
```

### CI/CD Integration
```bash
# Check index integrity before deployment
monitor status || exit 1

# Rebuild if needed
monitor rebuild
```

### Project Analysis
```bash
# Quick project overview
monitor overview > project-analysis.md
```

## License

MIT © RLabs Inc.