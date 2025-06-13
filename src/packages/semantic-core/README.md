# @codebase-curator/semantic-core

Core semantic indexing and search engine for codebase analysis. This package provides the foundation for intelligent code search and analysis used by the Codebase Curator suite.

## Features

- 🚀 **Fast Semantic Indexing** - Understands code structure, not just text
- 🔍 **Cross-Reference Tracking** - Knows who calls what and where
- 📊 **Multi-Language Support** - TypeScript, JavaScript, Python, Go, Rust, Swift, and more
- 🌊 **Flow Tracing** - Track data flow through your codebase
- 📖 **Story Extraction** - Extract narrative patterns from code
- ⚡ **Incremental Updates** - Only reindex what changed
- 🎯 **Concept Groups** - Search by semantic concepts (auth, database, api, etc.)

## Installation

```bash
npm install @codebase-curator/semantic-core
# or
bun add @codebase-curator/semantic-core
```

## Usage

```typescript
import { SemanticService } from '@codebase-curator/semantic-core'

// Initialize the service
const semantic = new SemanticService('/path/to/project')
await semantic.initialize()

// Search for code
const results = await semantic.search('authentication')

// Get cross-references
const refs = await semantic.getReferences('processPayment')

// Trace data flow
const flow = await semantic.traceFlow('user.email')
```

## Core Components

### SemanticService
The main entry point for semantic analysis:
- Manages the semantic index
- Provides search and analysis APIs
- Handles incremental updates

### Language Extractors
Specialized extractors for each language:
- TypeScriptExtractor - TS/JS with full AST support
- PythonExtractor - Python with type hints
- GoExtractor - Go with struct/interface understanding
- RustExtractor - Rust with trait/impl tracking
- And more...

### Concept Groups
Pre-defined semantic groups for common patterns:
- `auth` - Authentication & security
- `database` - Database operations
- `api` - API endpoints and routes
- `error` - Error handling
- And 20+ more groups

### Flow Tracer
Track how data flows through your code:
```typescript
const flowTracer = new FlowTracer(index)
const path = await flowTracer.traceFlow('user.email')
// Shows: assignment → function parameter → API call → database
```

### Story Extractor
Extract narrative patterns from your codebase:
```typescript
const story = await storyExtractor.extract()
// Returns: process flows, error scenarios, system boundaries
```

## API Reference

### SemanticService

#### `search(query: string, options?: SearchOptions): Promise<SearchResult[]>`
Search the codebase with semantic understanding.

#### `getReferences(term: string): CrossReference[]`
Get all references to a term (function, class, variable).

#### `traceFlow(term: string): Promise<FlowPath>`
Trace how a value flows through the codebase.

#### `extractStory(): Promise<CodebaseStory>`
Extract narrative patterns and system understanding.

### Types

```typescript
interface SemanticInfo {
  term: string
  type: 'function' | 'class' | 'variable' | 'constant' | ...
  location: { file: string; line: number; column: number }
  context: string
  surroundingLines: string[]
  metadata: Record<string, any>
}

interface CrossReference {
  targetTerm: string
  referenceType: 'call' | 'import' | 'extends' | ...
  fromLocation: Location
  context: string
}

interface SearchOptions {
  maxResults?: number
  filePattern?: string
  includeTypes?: string[]
  excludeTypes?: string[]
  sortBy?: 'relevance' | 'usage' | 'alphabetical'
}
```

## Language Support

- **TypeScript/JavaScript** - Full AST analysis, JSX/TSX support
- **Python** - Classes, functions, imports, type hints
- **Go** - Packages, structs, interfaces, methods
- **Rust** - Structs, traits, impls, macros
- **Swift** - Classes, protocols, extensions
- **Shell** - Functions, variables, commands
- **Configuration** - JSON, YAML, TOML with schema understanding

## Performance

- **Incremental Indexing** - Only reindex changed files
- **Streaming Architecture** - Handle massive codebases
- **Bun-Optimized** - Uses Bun's native APIs for speed
- **Memory Efficient** - Processes files in batches

## Contributing

See the main [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](../../../LICENSE) for details.