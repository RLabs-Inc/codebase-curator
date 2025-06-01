# Codebase Curator - Claude Development Guide 🤖

This file contains important information for Claude working on this codebase.

## Project Overview

Codebase Curator is an AI-powered codebase analysis system that enables Claude to deeply understand and work with any codebase through the MCP (Model Context Protocol).

Key components:

- `CodebaseStreamerBun` - Ultra-efficient file streaming with Bun's native APIs

### Architecture

The project is structured into three main layers:

- **Core Services**: Contains the business logic and analysis algorithms

  - `src/core/CuratorService.ts` - Main orchestration service
  - `src/core/CuratorProcessService.ts` - Manages Claude CLI processes
  - `src/core/CuratorPrompts.ts` - Contains prompts for Curator Claude
  - `src/core/SessionService.ts` - Handles conversation history and sessions (needs attention as curator claude sessions are getting corrupted)
  - `src/core/CodebaseStreamerBun.ts` - Efficient file streaming implementation

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

2. **Incremental Indexing** (TODO)

   - Uses hierarchical hash trees for efficient change detection

3. **Testing Commands**

   ```bash
   # Run specific tests
   bun test tests/testScript.test.ts

   # Run all tests
   bun test
   ```

### Debugging MCP Issues

1. Check for `console.log()` calls that should be `console.error()`
2. Verify all stdout output is valid JSON
3. Look for MaxListenersExceeded warnings (already fixed with setMaxListeners)
4. Check cache directory permissions (falls back to temp dir if needed)

### Performance Considerations

1. The curator spawns a separate Claude CLI process for analysis
2. Caching prevents re-analysis of unchanged files (not implemented yet)

## Project Philosophy

- **Emergent Understanding**: Discover patterns, don't prescribe them
- **Language Agnostic Core**: Analysis algorithms work across languages
- **Modular Extension**: Easy to add new tools without breaking existing ones
- **Practical Focus**: Provide actionable insights, not academic analysis

## Future Directions

1. **More Languages**: Go, Rust, Java, Ruby, etc.
2. **Real-time Analysis**: Watch mode for continuous updates

Remember: The goal is to help AI assistants write code that truly fits into existing codebases, not just syntactically correct code in isolation.
