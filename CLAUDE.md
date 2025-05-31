# Codebase Curator - Claude Development Guide 🤖

This file contains important information for Claude (or other AI assistants) working on this codebase.

## Project Overview

Codebase Curator is an AI-powered codebase analysis system that enables AI assistants to deeply understand and work with any codebase through the MCP (Model Context Protocol).

## Recent Updates (v2.4 - Streaming Revolution!)

### Memory-Efficient Streaming Analyzers (JUST COMPLETED!)

We've successfully implemented streaming analyzers that reduce memory usage by 99%:
- **OLD**: Analyzers loaded entire codebases into memory (1.83GB for large projects)
- **NEW**: Streaming analyzers process files in batches (25MB total!)
- **How**: Built `CodebaseStreamer` using Bun's native file streaming and glob APIs
- **Result**: MCP server is now production-ready for ANY size codebase!

Key components:
- `BaseStreamingAnalyzer` - Base class all analyzers extend
- `CodebaseStreamerBun` - Ultra-efficient file streaming with Bun's native APIs
- `DataFlowTracerNew`, `DependencyOracleNew`, `PatternLibraryNew` - Streaming versions

## Recent Updates (v2.3)

### Go Language Support Added

We've successfully implemented full Go language support with:
- Complete import parsing (single, grouped, aliased, blank imports)
- Framework detection for popular Go libraries (Gin, Echo, Bubble Tea, Cobra, etc.)
- Go-specific pattern extraction (goroutines, channels, defer, error handling)
- Ready to use for analyzing charm.sh libraries for our beautiful CLI!

### Clean Architecture Refactoring

We've completed a major architectural refactoring from monolithic files to a clean layered service architecture:

```
Presentation Layer (CLI/MCP) → Core Services → Algorithms
```

**Key Changes:**
- **Core Services**: Business logic extracted into dedicated service classes
  - `CuratorService` - Main orchestration and coordination
  - `AnalysisService` - Unified wrapper for all analysis algorithms
  - `CuratorProcessService` - Manages Claude CLI spawning
  - `SessionService` - Conversation history and session management
- **Presentation Layer**: Thin UI layers that delegate to core services
  - `src/presentation/cli/app.ts` - Command-line interface
  - `src/presentation/mcp/server.ts` - Unified MCP server (curator + direct tools)
- **Removed Duplicates**: Eliminated old monolithic implementations
  - `src/cli.ts` → `src/presentation/cli/app.ts`
  - `src/mcp/server-curator.ts` → `src/presentation/mcp/server.ts`

### Language System Architecture

We've implemented a modular language plugin system that automatically detects and uses the appropriate language analyzer based on file extensions:

```typescript
// Language detection flow
ImportMapper → LanguageRegistry.getPluginForFile(filePath) → Appropriate Language Plugin
```

### Key Components

#### Core Services (`src/core/`)

1. **CuratorService** - The orchestra conductor
   - Main entry point for all curator functionality
   - Coordinates between AnalysisService, CuratorProcessService, and SessionService
   - Implements the specialized tools (overview, feature, change)

2. **AnalysisService** - The algorithm runner
   - Unified wrapper for all 5 analysis algorithms
   - Handles caching through ContextManager
   - Runs analyses in parallel with Promise.all()

3. **CuratorProcessService** - The Claude whisperer
   - Spawns and manages Claude CLI processes
   - The META part: Claude analyzing code by spawning Claude
   - Manages process lifecycle and streaming JSON responses

4. **SessionService** - The memory keeper
   - Persistent session management in `~/.codebase-curator/sessions/`
   - Tracks conversation history and insights
   - Auto-cleanup of old sessions

#### Language System

1. **Language Registry** (`src/languages/base/LanguageRegistry.ts`)
   - Singleton pattern for managing language plugins
   - Maps file extensions to language analyzers
   - Provides `getPluginForFile()` for automatic language detection

2. **Base Language Analyzer** (`src/languages/base/BaseLanguageAnalyzer.ts`)
   - Abstract base class all language plugins extend
   - Provides common functionality (parameter extraction, comment removal)
   - Defines required methods: `parseImports()`, `detectFrameworks()`, `extractPatterns()`

3. **Language Plugins**
   - **TypeScript** (`src/languages/plugins/typescript/`) - Handles .ts, .tsx, .js, .jsx
   - **Python** (`src/languages/plugins/python/`) - Handles .py files

### Important Implementation Notes

1. **MCP Server Logging**
   - Use `console.error()` for logging in MCP contexts, NOT `console.log()`
   - All stdout must be valid JSON for the MCP protocol
   - Example fix in v2.3: Changed language initialization logs to use stderr

2. **Cache System**
   - Caches analysis results (ImportMapper, FrameworkDetector, etc.)
   - NOT curator responses - only the underlying analysis operations
   - Uses hierarchical hash trees for efficient change detection

3. **Testing Commands**
   ```bash
   # Run specific tests
   bun test tests/pythonAnalyzer.test.ts
   bun test tests/languageSystem.test.ts
   
   # Run all tests
   bun test
   ```

## Common Tasks

### Adding a New Language

1. Create plugin directory: `src/languages/plugins/{language}/`
2. Implement the language analyzer extending `BaseLanguageAnalyzer`
3. Register in `src/languages/index.ts`
4. Add comprehensive tests

Example structure:
```typescript
export class GoAnalyzer extends BaseLanguageAnalyzer {
  language: Language = {
    name: 'Go',
    extensions: ['.go'],
    aliases: ['go', 'golang']
  }
  
  parseImports(content: string, filePath: string): ImportStatement[] {
    // Implementation
  }
  
  detectFrameworks(dependencies: string[], fileContents?: Map<string, string>): Framework[] {
    // Implementation
  }
  
  extractPatterns(content: string, filePath: string): CodePattern[] {
    // Implementation
  }
}
```

### Debugging MCP Issues

1. Check for `console.log()` calls that should be `console.error()`
2. Verify all stdout output is valid JSON
3. Look for MaxListenersExceeded warnings (already fixed with setMaxListeners)
4. Check cache directory permissions (falls back to temp dir if needed)

### Performance Considerations

1. The curator spawns a separate Claude CLI process for analysis
2. Caching prevents re-analysis of unchanged files
3. Multi-file reads are encouraged (3-5x performance improvement)
4. Task agents are recommended for complex searches

## Project Philosophy

- **Emergent Understanding**: Discover patterns, don't prescribe them
- **Language Agnostic Core**: Analysis algorithms work across languages
- **Modular Extension**: Easy to add new languages without breaking existing ones
- **Practical Focus**: Provide actionable insights, not academic analysis

## Known Gotchas

1. **Import Order**: Language system must initialize before being used
2. **Circular Dependencies**: Careful with imports between language modules
3. **MCP Environment**: Different paths/permissions than regular CLI
4. **Memory Usage**: Large codebases can consume significant memory

## Future Directions

1. **More Languages**: Go, Rust, Java, Ruby, etc.
2. **Cross-Language Analysis**: Understanding polyglot projects
3. **AI Training Data**: Using analysis results to improve AI code generation
4. **Real-time Analysis**: Watch mode for continuous updates

Remember: The goal is to help AI assistants write code that truly fits into existing codebases, not just syntactically correct code in isolation.