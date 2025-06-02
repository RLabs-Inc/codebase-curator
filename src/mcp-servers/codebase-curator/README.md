# Codebase Curator MCP Server

## Overview

The Codebase Curator MCP Server implements a unique "Two-Claude Architecture": it spawns a specialized Claude instance (Curator Claude) that becomes an expert on your specific codebase and helps you (Coding Claude) understand it deeply.

## Architecture

```
┌─────────────────┐     MCP Protocol    ┌──────────────────┐
│  Coding Claude  │ ◄─────────────────► │   MCP Server     │
│ (You in Code)   │                     │  (Thin Layer)    │
└─────────────────┘                     └────────┬─────────┘
                                                 │
                                                 │ Spawns
                                                 ▼
                                        ┌──────────────────┐
                                        │  Curator Claude  │
                                        │ (Your Codebase   │
                                        │    Expert)       │
                                        └──────────────────┘
```

## How It Works

1. **You ask a question** through MCP tools (e.g., "How does authentication work?")
2. **MCP Server** receives the request and orchestrates the response
3. **CuratorService** prepares specialized prompts for codebase analysis
4. **CuratorProcessService** spawns Claude CLI with proper arguments
5. **Curator Claude** analyzes your codebase using restricted tools
6. **Response flows back** with deep, contextual understanding

## Available MCP Tools

### Core Tools

#### `set_project_path`
Set the project path for all subsequent operations.
```
Parameters:
- path: Absolute path to your project
```

#### `get_codebase_overview` 
Get a comprehensive overview of how the codebase actually works.
```
Parameters:
- projectPath (optional): Override the set project path
- newSession (optional): Force a fresh session (default: false)
```
**Always run this first!** It builds the foundational understanding.

#### `ask_curator`
Ask questions about the codebase architecture, patterns, or implementation.
```
Parameters:
- question: Your question about the codebase
- projectPath (optional): Override the set project path
- newSession (optional): Start fresh (default: false)
```

#### `add_new_feature`
Get comprehensive guidance for implementing a new feature.
```
Parameters:
- feature: Description of the feature to implement
- projectPath (optional): Override the set project path
```

#### `implement_change`
Get focused action plan for implementing a specific change or fix.
```
Parameters:
- change: Description of the change or fix
- projectPath (optional): Override the set project path
- scope (optional): Specific files or areas to focus on
```

### Session Management

#### `get_curator_memory`
Retrieve the curator's accumulated knowledge and insights.
```
Parameters:
- projectPath (optional): Override the set project path
```

#### `clear_curator_session`
Clear the curator's session for a fresh start.
```
Parameters:
- projectPath (optional): Override the set project path
```

#### `get_curator_activity`
View recent curator activity logs.
```
Parameters:
- lines (optional): Number of log lines (default: 50)
```

### Utility Tools

#### `get_cache_stats`
Get cache statistics including hit rates and memory usage.

#### `get_context_management_help`
Learn about context management and the /compact command.

#### `get_project_path`
Get the currently set project path.

## Curator Claude's Capabilities

The Curator Claude has restricted but powerful tools:

### ✅ Allowed Tools
- **Read**: Read any file in the codebase
- **Grep/Glob**: Search for patterns and files
- **LS**: List directory contents
- **Bash**: Run commands (especially `bun run smartgrep`)
- **Limited Write**: Only to `.curator/` directory for memory
- **Task**: Launch parallel analysis agents

### ❌ Restricted
- No internet access
- No arbitrary code execution
- No writing to source files
- No access outside project directory

## Session Persistence

The MCP server maintains session continuity:

1. **First `get_codebase_overview`**: Creates comprehensive understanding (~2 minutes)
2. **Subsequent commands**: Build on that context (instant responses)
3. **Session IDs**: Change with each command but context is preserved
4. **Cost optimization**: Anthropic's caching reduces costs over time

## Memory System

The curator can maintain memory in `.curator/memory.md`:
- Architectural insights discovered
- Patterns and conventions identified
- Important notes for future reference
- Tech debt and gotchas

## Implementation Details

### Key Files
- `server.ts` - This MCP server (thin routing layer)
- `../core/CuratorService.ts` - Main orchestration logic
- `../core/CuratorProcessService.ts` - Claude CLI process management
- `../core/CuratorPrompts.ts` - Specialized prompts (DO NOT MODIFY)

### Logging
**CRITICAL**: Use `console.error()` for all logging, never `console.log()`!
- stdout must be valid JSON for MCP protocol
- All debug output goes to stderr

### Dynamic Timeouts
Different operations get different timeouts:
```typescript
'Task': 600000,    // 10 minutes
'Bash': 300000,    // 5 minutes  
'Read': 120000,    // 2 minutes
'LS': 60000,       // 1 minute
```

## Setup for Development

1. **Install dependencies**
```bash
bun install
```

2. **Run in development mode**
```bash
bun run --watch src/mcp/server.ts
```

3. **Configure Claude Code**
```json
{
  "mcpServers": {
    "codebase-curator-dev": {
      "command": "bun",
      "args": ["run", "--watch", "/path/to/dev/codebase-curator/src/mcp/server.ts"]
    }
  }
}
```

## Deployment Options

### NPM Package (Recommended)
```bash
npm install -g codebase-curator
# Then use: codebase-curator-mcp
```

### Direct from GitHub
```json
{
  "mcpServers": {
    "codebase-curator": {
      "command": "npx",
      "args": ["-y", "github:RLabsInc/codebase-curator"]
    }
  }
}
```

### Local Installation
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

## Future Enhancements

- [ ] Incremental indexing for changed files
- [ ] Team knowledge sharing (shared curator sessions)
- [ ] Specialized curators (security, performance, etc.)
- [ ] Watch mode for real-time updates
- [ ] Multi-language support beyond TypeScript

## Troubleshooting

See [docs/TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md) for common issues.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

---

Remember: This MCP server gives your Claude a dedicated codebase expert. Use it wisely! 🧠