# Codebase Curator - Claude Development Guide 🤖

This file contains important information for Claude working on this codebase.

## Project Overview

Codebase Curator is an AI-powered codebase analysis system that enables Claude to deeply understand and work with any codebase through the MCP (Model Context Protocol).

### Key Innovations We've Implemented:

1. **Two-Claude Architecture** - One Claude (Curator) helps another Claude (Coding) understand codebases
2. **Session Persistence** - Fixed! Sessions now properly maintain context across commands
3. **Dynamic Timeouts** - Different tools get different timeouts (Task: 10min, Bash: 5min, Read: 2min)
4. **Smart Grep** - Semantic code search with usage counts and cross-references
5. **🔥 Hierarchical Hash Tree** - Incremental indexing with Bun-native xxHash64 for lightning-fast file change detection
6. **🎯 Live Monitoring** - Real-time codebase overview dashboard that evolves as you code

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

5. **🔥 Incremental Indexing System** ✅ NEW!
   - **HashTree.ts**: Bun-native xxHash64 for lightning-fast file change detection
   - **IncrementalIndexer.ts**: Only reprocesses changed files, dramatically reducing overhead
   - **Live Monitoring**: Real-time dashboard showing codebase evolution as you code
   
   ```bash
   # Live monitoring with codebase overview
   bun run monitor watch --overview
   
   # Static codebase analysis
   bun run monitor overview
   
   # Technical status and integrity checks
   bun run monitor status
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
6. **Bun-Native Speed**: xxHash64 + file watching provides near-instant change detection

## Project Philosophy

- **Emergent Understanding**: Discover patterns, don't prescribe them
- **Language Agnostic Core**: Analysis algorithms work across languages
- **Modular Extension**: Easy to add new tools without breaking existing ones
- **Practical Focus**: Provide actionable insights, not academic analysis

## Future Directions

1. **More Languages**: Go, Rust, Java, Ruby, etc.
2. **Real-time Analysis**: Watch mode for continuous updates

Remember: The goal is to help AI assistants write code that truly fits into existing codebases, not just syntactically correct code in isolation.
