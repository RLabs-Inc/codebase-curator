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

The project is now organized as a monorepo with packages:

- **Packages** (for distribution):
  - `src/packages/semantic-core/` - Core semantic indexing engine
    - Semantic analysis and indexing
    - File change detection (HashTree)
    - Incremental indexing
    - Configuration management (exclusions, patterns)
    - Language extractors (TypeScript, Python, Go, Rust)
  - `src/packages/smartgrep/` - Standalone semantic search package
  - `src/packages/codebase-curator/` - Full suite package (future)

- **Services** (shared business logic):
  - `src/services/curator/` - Curator-specific services
    - `CuratorService.ts` - Main orchestration service
    - `CuratorProcessService.ts` - Manages Claude CLI processes
    - `CuratorPrompts.ts` - Contains prompts for Curator Claude
  - `src/services/session/` - Session management
    - `SessionService.ts` - Handles conversation history (corruption issue FIXED!)
  - `src/services/indexing/` - Now part of semantic-core package
  - `src/services/semantic/` - Now part of semantic-core package

- **Tools** (CLI interfaces):
  - `src/tools/smartgrep/` - Smart grep CLI with completions and man page
  - `src/tools/monitor/` - Real-time monitoring CLI
  - `src/tools/curator-cli/` - Curator command-line interface

- **MCP Servers** (AI interfaces):
  - `src/mcp-servers/codebase-curator/` - MCP server for Coding Claude

- **Shared** (common utilities):
  - `src/shared/config/` - Configuration management
  - `src/shared/types/` - Shared TypeScript types
  - `src/shared/utils/` - Common utilities

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
   - Now part of `@codebase-curator/semantic-core` package for reusability
   
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
   - **Changes Impact**: `smartgrep changes` analyzes uncommitted changes
   - **20+ Concept Groups**: auth, error, api, database, cache, etc.
   - **📖 Story Mode**: `smartgrep story` extracts narrative patterns from strings
   
   ```bash
   # List all concept groups
   bun run smartgrep group list
   
   # Search concept group
   bun run smartgrep group error --type function
   
   # Advanced searches
   bun run smartgrep "error&string"           # AND search
   bun run smartgrep "login|signin|auth"      # OR search
   bun run smartgrep "!test" --type function  # NOT search
   
   # Find references
   bun run smartgrep refs "processPayment"
   
   # Analyze uncommitted changes
   bun run smartgrep changes                  # Full impact analysis
   bun run smartgrep changes --compact        # One-line risk assessment
   
   # Framework-specific searches (NEW!)
   # IMPORTANT: When using Bash tool, use SINGLE QUOTES for $ symbols and special characters
   bun run smartgrep '$state'                 # Find Svelte 5 runes (MUST use single quotes!)
   bun run smartgrep '$derived'               # Find Svelte derived runes
   bun run smartgrep "onMount"                # Find Svelte lifecycle hooks
   bun run smartgrep "defineProps"            # Find Vue composition API
   bun run smartgrep "client:load"            # Find Astro client directives
   bun run smartgrep '{#if'                   # Find Svelte template directives (single quotes!)
   
   # DO NOT escape with backslash - it returns 0 results!
   # BAD:  bun run smartgrep "\$state"        # This won't work!
   # GOOD: bun run smartgrep '$state'         # This works!
   
   # Story Mode - Extract narrative patterns from codebase
   bun run smartgrep story                    # Full codebase story analysis
   # Shows:
   # - Process flows (how things work step by step)
   # - Error scenarios (what can go wrong and recovery)
   # - System boundaries (external APIs, DBs, files)
   # - Recurring patterns (retry, validation, lifecycle)
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
- Multi-language support (TypeScript, Python, Go, Rust)
- Professional shell completions for all CLI tools
- Human-friendly curator CLI with chat mode
- Story Mode - narrative extraction from codebase strings

### 🚀 Next Up
1. **Enhanced Monitoring**: More detailed code metrics
2. **Performance Optimization**: Parallel indexing
3. **More Languages**: Java, C#, Ruby, PHP, etc.

## Package Structure & Distribution

### Monorepo with Bun Workspaces
```json
// Root package.json
{
  "workspaces": ["src/packages/*"]
}
```

### Available Packages
1. **@codebase-curator/semantic-core** - Core indexing engine
2. **@codebase-curator/smartgrep** - Semantic search CLI
3. **@codebase-curator/codebase-curator** - Full suite (coming soon)

### Installation Options
```bash
# NPM Package (when published)
npm install -g @codebase-curator/smartgrep

# Standalone Binary (future releases)
curl -L https://github.com/RLabs-Inc/codebase-curator/releases/latest/download/smartgrep-macos-arm64

# Development
bun install  # Installs workspace dependencies
```

## Smart Grep Usage Guide

### Basic Commands
```bash
# Search for literal term
bun run smartgrep "handleAuth"

# Rebuild semantic index
bun run smartgrep --index

# Find references
bun run smartgrep refs "apiClient"

# Extract codebase story
bun run smartgrep story
```

### Group Commands (Built-in + Custom)
```bash
# List all available groups
bun run smartgrep group list

# Search built-in concept group
bun run smartgrep group auth

# Add custom concept group
bun run smartgrep group add payments charge,bill,invoice,transaction

# Search your custom group
bun run smartgrep group payments --type function

# Remove custom group
bun run smartgrep group remove payments
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

# Custom group with filters
bun run smartgrep group myapi --type class,function --sort usage
```

### 🚀 NEW: Compact Mode for Context Management

Smart Grep now defaults to **compact summary mode** specifically designed for Claudes:

```bash
# Default behavior - Compact summary (200-300 tokens)
bun run smartgrep "authService"

# Full detailed output when needed (2000-3000 tokens)
bun run smartgrep "authService" --full
```

**Why This Matters:**
- **90% reduction in context usage** - More searches before hitting limits
- **Focused information** - Definition, signature, top usage, breaking changes
- **Smart suggestions** - Next searches based on current results
- **Instant answers** - No scrolling through hundreds of lines

**What You Get in Compact Mode:**
1. **Primary Definition** with full signature (constructor/parameters)
2. **Top 3 Usage Locations** with actual code context
3. **Breaking Changes** - Specific functions that call this code
4. **Patterns Detected** - async/await, errors thrown, related terms
5. **Next Suggestions** - Contextual follow-up searches

**Context Management Tips:**
- Use compact mode (default) for exploration and quick lookups
- Use `--full` only when you need to see ALL occurrences
- Chain searches using the suggested "NEXT" commands
- Combine with filters to narrow results: `--type function --file "*.ts"`

### Custom Groups Configuration
Custom groups are saved to `.curatorconfig.json` in your project root:
```json
{
  "customGroups": {
    "payments": ["charge", "bill", "invoice", "transaction"],
    "frontend": {
      "name": "frontend",
      "description": "Frontend-specific patterns",
      "emoji": "🎨",
      "terms": ["component", "props", "state", "render", "ui"]
    }
  }
}
```

Remember: The goal is to help AI assistants write code that truly fits into existing codebases, not just syntactically correct code in isolation.
