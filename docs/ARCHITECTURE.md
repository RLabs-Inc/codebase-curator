# 🏗️ Codebase Curator Architecture

## The Two-Claude Architecture

Codebase Curator implements a unique "Two-Claude" architecture where one Claude instance helps another understand codebases. This document explains how it works and why it's powerful.

## Overview

```
┌─────────────────┐     MCP Protocol      ┌──────────────────┐
│                 │ ◄─────────────────────► │                  │
│  Coding Claude  │                         │ Codebase Curator │
│  (You in Code)  │                         │   (MCP Server)   │
│                 │                         │                  │
└─────────────────┘                         └────────┬─────────┘
                                                     │
                                                     │ Spawns
                                                     ▼
                                            ┌──────────────────┐
                                            │                  │
                                            │  Curator Claude  │
                                            │ (Codebase Expert)│
                                            │                  │
                                            └──────────────────┘
```

## How It Works

### 1. The Request Flow

When you use a Codebase Curator tool in Claude Code:

1. **You ask a question** through MCP tools
2. **MCP Server receives** the request
3. **CuratorService orchestrates** the response
4. **CuratorProcessService spawns** a Claude CLI instance
5. **Curator Claude analyzes** your codebase
6. **Response flows back** to you

### 2. The Magic: Specialized Prompts

Curator Claude isn't just another Claude - it's given specialized prompts that make it an expert at codebase analysis:

```typescript
// From CuratorPrompts.ts
"You're Curator Claude, living in the MCP server. 
 Another Claude needs your help understanding this codebase.
 You know exactly what they need..."
```

### 3. Tool Restrictions

Curator Claude has limited but powerful tools:
- ✅ Read, Grep, Glob, LS - For exploration
- ✅ Bash - For running smart grep
- ✅ Limited Write - Only to `.curator/` directory
- ❌ No external access
- ❌ No code execution

This keeps it focused and safe.

## Core Components

### CuratorService (`src/core/CuratorService.ts`)
The main orchestrator that:
- Detects question types (overview, feature, change)
- Manages the curator process
- Handles session persistence

### CuratorProcessService (`src/core/CuratorProcessService.ts`)
Manages the Claude CLI subprocess:
- Spawns Claude with proper arguments
- Handles dynamic timeouts
- Manages session continuity
- Parses streaming JSON responses

### SessionService (`src/core/SessionService.ts`)
Tracks conversation history:
- Stores metadata about questions asked
- Maintains session continuity
- Provides history for context

### Smart Grep (`src/semantic/`)
Semantic code understanding:
- Parses code structure (not just text)
- Tracks usage counts
- Shows cross-references
- Organized by type (functions, classes, etc.)

## Session Persistence

One of the key innovations is maintaining context across questions:

```
First Question → Creates session → Explores codebase
                                        ↓
                                  Saves session ID
                                        ↓
Next Question → Resumes session → Uses existing knowledge
```

### How Sessions Work

1. **Immutable Sessions**: Each interaction creates a new session ID
2. **Context Preserved**: The conversation history is maintained
3. **Cache Benefits**: Anthropic's API caches the context

### Session Storage

- **Claude Sessions**: `.curator/session.txt` (UUID format)
- **Metadata**: `~/.codebase-curator/sessions/` (JSON files)

## Performance Optimizations

### Dynamic Timeouts
Different operations need different time:
```typescript
'Task': 600000,    // 10 minutes - complex analysis
'Bash': 300000,    // 5 minutes - smart grep
'Read': 120000,    // 2 minutes - file reading
'LS': 60000,       // 1 minute - directory listing
```

### Streaming Architecture
- Files are streamed, never fully loaded
- Batching prevents memory overload
- Bun's native APIs for performance

### Smart Indexing
- Semantic understanding vs text matching
- Cached indexes for repeat searches
- Language-aware parsing

## Security Considerations

### Process Isolation
- Curator Claude runs in a separate process
- Limited tool access
- No access to your main environment

### File System Restrictions
- Read access to project only
- Write access only to `.curator/` directory
- Respects `.gitignore` patterns

### No External Access
- No internet access
- No arbitrary code execution
- Safe for sensitive codebases

## Future Enhancements

### Planned Features
1. **Incremental Indexing** - Only reindex changed files
2. **Multi-Language Support** - Beyond TypeScript
3. **Team Knowledge Sharing** - Shared curator sessions
4. **IDE Integration** - Beyond Claude Code

### Extension Points
- Language extractors in `src/semantic/extractors/`
- New MCP tools in `src/mcp/server.ts`
- Custom prompts in `src/core/CuratorPrompts.ts`

## Why This Architecture?

### Benefits
1. **Specialized Expertise** - Curator Claude becomes a codebase expert
2. **Persistent Context** - Knowledge builds over time
3. **Separation of Concerns** - Coding vs Understanding
4. **Scalability** - Can handle massive codebases

### Trade-offs
1. **Complexity** - Two-process architecture
2. **Latency** - Process spawning overhead
3. **Resource Usage** - Two Claude instances

## Conclusion

The Two-Claude architecture enables a new paradigm: instead of Claude starting fresh with each question, you get a persistent codebase expert that truly understands your code. This leads to better suggestions, faster responses, and code that actually fits your patterns.