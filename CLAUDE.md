# Codebase Curator - Claude Development Guide 🤖

This file contains important information for Claude working on this codebase.

## Project Overview

Codebase Curator is an AI-powered codebase analysis system that enables Claude to deeply understand and work with any codebase through the MCP (Model Context Protocol).

### Key Innovations We've Implemented:

1. **Two-Claude Architecture** - One Claude (Curator) helps another Claude (Coding) understand codebases
2. **Session Persistence** ✅ - Fixed! Sessions now properly maintain context across commands using --resume
3. **Dynamic Timeouts** ✅ - Different tools get different timeouts (Task: 10min, Bash: 5min, Read: 2min)
4. **Smart Grep** 🚀 - Semantic code search with concept groups, AND/OR/NOT searches, and cross-references
5. **🔥 Hierarchical Hash Tree** ✅ - Incremental indexing with Bun.hash() for lightning-fast file change detection
6. **🎯 Live Monitoring** ✅ - Real-time codebase overview dashboard with unique file tracking
7. **MCP Tool Discovery** ✅ - Help Claudes discover smart-grep with compelling examples

### Architecture

The project is structured into three main layers:

- **Core Services**: Contains the business logic and analysis algorithms

  - `src/core/CuratorService.ts` - Main orchestration service
  - `src/core/CuratorProcessService.ts` - Manages Claude CLI processes
  - `src/core/CuratorPrompts.ts` - Contains prompts for Curator Claude
  - `src/core/SessionService.ts` - Handles conversation history and sessions (corruption issue FIXED!)
  - `src/core/CodebaseStreamerBun.ts` - Efficient file streaming implementation

- **Semantic Analysis & Monitoring**: High-performance incremental indexing system

  - `src/semantic/HashTree.ts` - Hierarchical hash tree for file change tracking
  - `src/semantic/IncrementalIndexer.ts` - Orchestrates incremental semantic indexing
  - `src/semantic/monitor.ts` - Real-time monitoring CLI with live overview dashboard
  - `src/semantic/SemanticService.ts` - Enhanced with incremental update capabilities

- **Presentation Layer**: Thin UI layers that delegate to core services

  - `src/cli/app.ts` - Command-line interface
  - `src/mcp/server.ts` - MCP server (how coding claude interacts with the curator claude)

- **Configuration files**: Contains all configuration and metadata
  - `src/util/config.ts` - Configuration file loading and management, folder exclusions patterns, and other settings
  - `.curatorconfig.json` - Codebase curator app configuration file

### Important Implementation Notes

1. **MCP Server Logging**
   - Use `console.error()` for logging in MCP contexts, NOT `console.log()`
   - All stdout must be valid JSON for the MCP protocol

2. **Session Persistence** ✅ FIXED
   - Claude CLI creates immutable sessions - each resume creates a new session ID
   - We properly save and load the latest session ID
   - Context is preserved even though IDs change

3. **Dynamic Timeouts** 
   - Implemented in `CuratorProcessService.getDynamicTimeout()`
   - Task: 600s, Bash: 300s, Read: 120s, LS/Glob: 60s

4. **Testing Commands**

   ```bash
   # Run specific tests
   bun test tests/testScript.test.ts

   # Run all tests
   bun test
   ```

5. **🔥 Incremental Indexing System** ✅ IMPLEMENTED!
   - **HashTree.ts**: Bun.hash() for fast file change detection with 500ms debouncing
   - **IncrementalIndexer.ts**: Only reprocesses changed files, silent mode for clean output
   - **Live Monitoring**: Real-time dashboard showing unique files changed (not duplicate events)
   
   ```bash
   # Live monitoring with codebase overview
   bun run monitor watch --overview
   
   # Static codebase analysis
   bun run monitor overview
   
   # Technical status and integrity checks
   bun run monitor status
   ```

6. **🔍 Smart Grep - Semantic Code Search** ✅ FULLY FEATURED!
   - **Concept Groups**: `smartgrep group auth` searches ALL auth patterns
   - **Advanced Patterns**: AND (`&`), OR (`|`), NOT (`!`), regex (`/pattern/`)
   - **Type Filters**: `--type function,class,variable,string,comment`
   - **Cross-References**: `smartgrep refs "functionName"` shows all usages
   - **20+ Concept Groups**: auth, error, api, database, cache, etc.
   
   ```bash
   # List all concept groups
   bun run smartgrep --list-groups
   
   # Search concept group
   bun run smartgrep group error --type function
   
   # Advanced searches
   bun run smartgrep "error&string"           # AND search
   bun run smartgrep "login|signin|auth"      # OR search
   bun run smartgrep "!test" --type function  # NOT search
   
   # Find references
   bun run smartgrep refs "processPayment"
   ```

### Debugging MCP Issues

1. Check for `console.log()` calls that should be `console.error()`
2. Verify all stdout output is valid JSON
3. Look for MaxListenersExceeded warnings (already fixed with setMaxListeners)
4. Check cache directory permissions (falls back to temp dir if needed)

### Performance Considerations

1. **Process Spawning**: The curator spawns a separate Claude CLI process for analysis
2. **Session Reuse**: First overview takes ~2 minutes, subsequent questions are instant
3. **Anthropic Caching**: API caching reduces costs for repeated context
4. **Streaming**: Files are streamed, never fully loaded into memory
5. **🚀 Incremental Performance**: Hash tree enables sub-second updates by only processing changed files
6. **Bun-Native Speed**: Bun.hash() + file watching provides near-instant change detection
7. **Smart-Grep Cache**: Semantic index persisted, instant searches after first index

## Project Philosophy

- **Emergent Understanding**: Discover patterns, don't prescribe them
- **Language Agnostic Core**: Analysis algorithms work across languages
- **Modular Extension**: Easy to add new tools without breaking existing ones
- **Practical Focus**: Provide actionable insights, not academic analysis

## Implementation Status

### ✅ Completed Features
- Two-Claude architecture with MCP
- Session persistence with --resume flag
- Dynamic timeouts for different tools
- Smart-grep with full semantic search
- Concept groups with intuitive `group` command
- Hierarchical hash tree with Bun.hash()
- Incremental indexing with debouncing
- Live monitoring dashboard
- MCP tool discovery helpers
- .curator directory exclusion
- Unique file tracking (vs event counts)

### 🚀 Next Up
1. **Multi-Language Support**: Python, Go, Rust extractors
2. **Enhanced Monitoring**: More detailed code metrics
3. **Performance Optimization**: Parallel indexing

## Smart Grep Usage Guide

### Basic Commands
```bash
# Search for literal term
bun run smartgrep "handleAuth"

# Search concept group
bun run smartgrep group auth

# List all concept groups
bun run smartgrep --list-groups

# Find references
bun run smartgrep refs "apiClient"
```

### Advanced Patterns
```bash
# AND search (must contain both)
bun run smartgrep "error&handler"

# OR search (contains any)
bun run smartgrep "login|signin|auth"

# NOT search (exclude term)
bun run smartgrep "!test" --type function

# Regex search
bun run smartgrep "/handle.*Event/" --regex
```

### Type Filters
```bash
# Single type
bun run smartgrep "auth" --type function

# Multiple types
bun run smartgrep "user" --type function,class

# All types: function, class, variable, string, comment, import
```

### Combining Features
```bash
# Concept group + type filter + sorting
bun run smartgrep group error --type function --sort usage

# Pattern + file filter + max results
bun run smartgrep "service" --file "*.ts" --max 10

# Compact output for scanning
bun run smartgrep group api --compact
```

Remember: The goal is to help AI assistants write code that truly fits into existing codebases, not just syntactically correct code in isolation.
