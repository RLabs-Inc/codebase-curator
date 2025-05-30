# Codebase Curator MCP Server

## Overview

The Codebase Curator MCP Server provides a unique approach to codebase understanding: instead of directly executing analysis and returning data, it spawns specialized Claude instances that act as "curators" for specific codebases.

## Architecture

```
┌─────────────────┐     MCP Tools      ┌──────────────────┐
│  Coding Claude  │ ◄─────────────────► │   MCP Server     │
│ (uses codebase) │                     │                  │
└─────────────────┘                     └────────┬─────────┘
                                                 │
                                                 │ Spawns
                                                 ▼
                                        ┌──────────────────┐
                                        │  Curator Claude  │
                                        │  (understands    │
                                        │   codebase)      │
                                        └──────────────────┘
```

## How It Works

1. **Coding Claude** asks a semantic question like "How does this codebase handle authentication?"
2. **MCP Server** spawns a new Claude instance with:
   - System prompt explaining it's the "Codebase Curator"
   - Initial analysis data as context
   - Access to read files and run analysis tools
   - The specific question to answer
3. **Curator Claude** analyzes the codebase and provides detailed, contextual answers
4. **MCP Server** returns the curator's response to the coding Claude

## Available Tools

### `ask_curator`
Ask the codebase curator any question about the codebase.

**Parameters:**
- `question` (required): The question to ask
- `projectPath` (optional): Path to the codebase (defaults to current directory)
- `includeAnalysis` (optional): Whether to run fresh analysis

**Example questions:**
- "How does this codebase handle authentication?"
- "What's the established pattern for error handling?"
- "Where should I add a new API endpoint?"
- "How do components communicate with each other?"

### `get_curator_memory`
Retrieve the curator's accumulated knowledge about the codebase.

**Parameters:**
- `projectPath` (optional): Path to the codebase

### `run_analysis`
Run a specific analysis algorithm directly.

**Parameters:**
- `analysisType`: One of: imports, frameworks, organization, patterns, similarity
- `projectPath` (optional): Path to the codebase

## Curator Capabilities

The Curator Claude has access to:
- **Read**: Can read any file in the codebase
- **Grep/Glob**: Can search for patterns and files
- **Bash**: Can run analysis commands (restricted to `bun run` commands)
- **Write**: Can only write to `.curator/` directory for maintaining memory

## Memory System

The curator maintains memory in `.curator/memory.md` with:
- Insights discovered about the codebase
- Architectural patterns identified
- Important notes for future reference

This allows the curator to build up understanding over time, even though each instance is spawned fresh.

## Setup

1. Ensure Claude Code is installed and `claude` command is available in PATH
2. Run the MCP server: `bun run src/presentation/mcp/server.ts`
3. Configure your Claude Code instance to connect to this MCP server

## Unified Server (v2.3)

As of v2.3, we've unified the MCP server to provide both curator and direct analysis capabilities in a single implementation:

### All Tools Available
- **Curator Tools**: `ask_curator`, `get_curator_memory`, `add_new_feature`, `implement_change`
- **Direct Analysis**: `run_analysis`, `get_codebase_overview`, `get_cache_stats`
- **Management**: `clear_curator_session`, `get_context_management_help`

### Benefits of Unified Server
- Single server to configure and maintain
- Consistent performance and caching across all tools
- Simplified deployment and setup
- All functionality accessible through clean service architecture

## Future Enhancements

- Incremental indexing when files change
- Shared curator memory across teams
- Specialized curators for different aspects (security, performance, etc.)
- Integration with version control for historical understanding