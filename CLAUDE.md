# Codebase Curator - Claude Development Guide 🤖

This file contains important information for Claude (or other AI assistants) working on this codebase.

## Project Overview

Codebase Curator is an AI-powered codebase analysis system that enables AI assistants to deeply understand and work with any codebase through the MCP (Model Context Protocol).

## Recent Updates (v2.3)

### Language System Architecture

We've implemented a modular language plugin system that automatically detects and uses the appropriate language analyzer based on file extensions:

```typescript
// Language detection flow
ImportMapper → LanguageRegistry.getPluginForFile(filePath) → Appropriate Language Plugin
```

### Key Components

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