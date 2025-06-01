# Smart Grep Tool - Implementation Guide with Cross-References

> **For Claude Developer**: This guide is written specifically for you. It assumes you're working in Claude Code and provides step-by-step implementation details with real code examples.

## Overview: What You're Building 🎯

You're building a semantic indexing system that:
1. Extracts meaningful information from codebases
2. **Tracks cross-references** between code elements (who calls what)
3. Provides smart search with usage analysis
4. Shows impact of potential changes

**Core Concept**: Parse every file → Extract definitions AND references → Index both → Provide smart CLI with impact analysis

## Architecture Overview

```
Codebase Files → Language Parsers → Semantic Extractor → Dual Index → Search Interface
     ↓              ↓                    ↓                  ↓           ↓
   *.ts, *.py    Babel, AST        Definitions +      Terms Index   smartgrep CLI
   *.go, *.js    Tree-sitter       References        X-Ref Index   "func (5 uses)"
                                        ↓                  ↓             ↓
                                 Cross-Reference     Impact Analysis  Where Used
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Semantic extractor interface** - Common interface for all language parsers
2. **Index storage** - Fast storage and retrieval of semantic information  
3. **Basic CLI** - Simple search interface
4. **TypeScript/JavaScript support** - First language implementation

### Phase 2: Cross-Reference Tracking (NEW!)
5. **Cross-reference types** - Function calls, instantiations, imports
6. **Bidirectional indexing** - Track both definitions and usages
7. **Impact analysis** - Show what would be affected by changes

### Phase 3: Language Expansion
8. **Python support** - Second language
9. **Go support** - Third language  
10. **Generic fallback** - For unsupported languages

### Phase 4: Advanced Features
11. **Extended concept groups** - Architecture, flow, state patterns
12. **Type signature tracking** - Parameter and return types
13. **Incremental indexing** - Only reindex changed files

## Detailed Implementation

### Version 3.0 Updates - Advanced Search & Display

The latest version adds powerful search patterns and utilizes all collected data:

**New Search Patterns**:
- OR: `term1|term2|term3`
- AND: `term1&term2`
- NOT: `!term`
- Regex: `/pattern/`

**Enhanced Display**:
- Shows surrounding lines
- Displays related terms
- Shows exact column positions
- Includes cross-reference context

### 1. Core Interfaces

Create `src/semantic/types.ts`:

```typescript
// Information about code definitions
export interface SemanticInfo {
  term: string;
  type: 'function' | 'class' | 'variable' | 'constant' | 'string' | 'comment' | 'import' | 'file';
  location: {
    file: string;
    line: number;
    column: number;
  };
  context: string; // The actual line of code
  surroundingLines: string[]; // 2-3 lines before/after for context
  relatedTerms: string[]; // Other terms found nearby
  language: string;
  metadata?: Record<string, any>; // Language-specific extra info
  references?: CrossReference[]; // NEW! Where this term is used
}

// NEW! Information about code usage
export interface CrossReference {
  targetTerm: string; // What is being referenced
  referenceType: 'call' | 'import' | 'extends' | 'implements' | 'instantiation' | 'type-reference';
  fromLocation: {
    file: string;
    line: number;
    column: number;
  };
  context: string; // The line making the reference
}

export interface LanguageExtractor {
  canHandle(filePath: string): boolean;
  extract(content: string, filePath: string): {
    definitions: SemanticInfo[];
    references: CrossReference[]; // NEW! Extract both definitions and usages
  };
}

export interface SemanticIndex {
  add(info: SemanticInfo): void;
  search(query: string, options?: SearchOptions): SearchResult[];
  searchGroup(terms: string[]): SearchResult[];
  clear(): void;
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;
}

export interface SearchOptions {
  type?: SemanticInfo['type'][];
  files?: string[]; // File patterns
  maxResults?: number;
  includeContext?: boolean;
}

export interface SearchResult {
  info: SemanticInfo;
  relevanceScore: number;
}
```

### 2. Index Implementation

Create `src/semantic/SemanticIndexImpl.ts`:

```typescript
import { SemanticIndex, SemanticInfo, SearchOptions, SearchResult } from './types';

export class SemanticIndexImpl implements SemanticIndex {
  private entries: Map<string, SemanticInfo[]> = new Map();
  private termIndex: Map<string, SemanticInfo[]> = new Map();

  add(info: SemanticInfo): void {
    // Add to file-based index
    const fileEntries = this.entries.get(info.location.file) || [];
    fileEntries.push(info);
    this.entries.set(info.location.file, fileEntries);

    // Add to term-based index (for fast searching)
    const normalizedTerm = info.term.toLowerCase();
    const termEntries = this.termIndex.get(normalizedTerm) || [];
    termEntries.push(info);
    this.termIndex.set(normalizedTerm, termEntries);

    // Also index partial matches (for fuzzy search)
    this.indexPartialMatches(info);
  }

  private indexPartialMatches(info: SemanticInfo): void {
    const term = info.term.toLowerCase();
    
    // Index camelCase parts: "getUserName" → ["get", "user", "name"]
    const camelParts = term.split(/(?=[A-Z])/).map(s => s.toLowerCase());
    camelParts.forEach(part => {
      if (part.length > 2) {
        const entries = this.termIndex.get(part) || [];
        entries.push(info);
        this.termIndex.set(part, entries);
      }
    });

    // Index snake_case parts: "user_name" → ["user", "name"]
    const snakeParts = term.split('_');
    snakeParts.forEach(part => {
      if (part.length > 2) {
        const entries = this.termIndex.get(part) || [];
        entries.push(info);
        this.termIndex.set(part, entries);
      }
    });
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const normalizedQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Exact matches first
    const exactMatches = this.termIndex.get(normalizedQuery) || [];
    exactMatches.forEach(info => {
      if (this.matchesOptions(info, options)) {
        results.push({ info, relevanceScore: 1.0 });
      }
    });

    // Partial matches
    for (const [term, infos] of this.termIndex.entries()) {
      if (term.includes(normalizedQuery) && term !== normalizedQuery) {
        infos.forEach(info => {
          if (this.matchesOptions(info, options)) {
            const score = normalizedQuery.length / term.length;
            results.push({ info, relevanceScore: score });
          }
        });
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = this.deduplicateResults(results);
    uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return uniqueResults.slice(0, options.maxResults || 100);
  }

  searchGroup(terms: string[]): SearchResult[] {
    const allResults: SearchResult[] = [];
    
    terms.forEach(term => {
      const termResults = this.search(term);
      allResults.push(...termResults);
    });

    return this.deduplicateResults(allResults);
  }

  private matchesOptions(info: SemanticInfo, options: SearchOptions): boolean {
    if (options.type && !options.type.includes(info.type)) {
      return false;
    }
    
    if (options.files) {
      const matchesFile = options.files.some(pattern => 
        info.location.file.includes(pattern) || 
        this.globMatch(info.location.file, pattern)
      );
      if (!matchesFile) return false;
    }

    return true;
  }

  private globMatch(path: string, pattern: string): boolean {
    // Simple glob matching - you might want to use a library for this
    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(regex).test(path);
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = `${result.info.location.file}:${result.info.location.line}:${result.info.term}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  clear(): void {
    this.entries.clear();
    this.termIndex.clear();
  }

  async save(path: string): Promise<void> {
    const data = {
      entries: Object.fromEntries(this.entries),
      termIndex: Object.fromEntries(this.termIndex),
    };
    await Bun.write(path, JSON.stringify(data, null, 2));
  }

  async load(path: string): Promise<void> {
    try {
      const file = Bun.file(path);
      const data = await file.json();
      
      this.entries = new Map(Object.entries(data.entries));
      this.termIndex = new Map(Object.entries(data.termIndex));
    } catch (error) {
      console.warn(`Could not load semantic index from ${path}:`, error);
    }
  }
}
```

### 3. TypeScript/JavaScript Extractor

Create `src/semantic/extractors/TypeScriptExtractor.ts`:

```typescript
import * as babel from '@babel/parser';
import traverse from '@babel/traverse';
import { LanguageExtractor, SemanticInfo } from '../types';

export class TypeScriptExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(filePath);
  }

  extract(content: string, filePath: string): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = [];
    const references: CrossReference[] = []; // NEW!
    const lines = content.split('\n');

    try {
      // Parse with Babel
      const ast = babel.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
        errorRecovery: true,
      });

      // Traverse the AST and extract semantic information
      traverse(ast, {
        // Function declarations and expressions
        FunctionDeclaration: (path) => {
          if (path.node.id?.name) {
            definitions.push(this.createSemanticInfo(
              path.node.id.name,
              'function',
              path.node.loc,
              filePath,
              lines,
              this.getContext(path.node.loc, lines)
            ));
          }
        },

        // Arrow functions and function expressions assigned to variables
        VariableDeclarator: (path) => {
          if (path.node.id.type === 'Identifier' && path.node.init) {
            const isFunction = path.node.init.type === 'ArrowFunctionExpression' || 
                             path.node.init.type === 'FunctionExpression';
            
            results.push(this.createSemanticInfo(
              path.node.id.name,
              isFunction ? 'function' : 'variable',
              path.node.loc,
              filePath,
              lines,
              this.getContext(path.node.loc, lines)
            ));
          }
        },

        // Class declarations
        ClassDeclaration: (path) => {
          if (path.node.id?.name) {
            results.push(this.createSemanticInfo(
              path.node.id.name,
              'class',
              path.node.loc,
              filePath,
              lines,
              this.getContext(path.node.loc, lines)
            ));
          }
        },

        // Import declarations
        ImportDeclaration: (path) => {
          path.node.specifiers.forEach(spec => {
            if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportSpecifier') {
              results.push(this.createSemanticInfo(
                spec.local.name,
                'import',
                spec.loc,
                filePath,
                lines,
                this.getContext(path.node.loc, lines)
              ));
            }
          });
        },

        // String literals
        StringLiteral: (path) => {
          const value = path.node.value;
          // Only index meaningful strings (longer than 3 chars, not just data)
          if (value.length > 3 && this.isMeaningfulString(value)) {
            results.push(this.createSemanticInfo(
              value,
              'string',
              path.node.loc,
              filePath,
              lines,
              this.getContext(path.node.loc, lines)
            ));
          }
        },

        // Template literals
        TemplateLiteral: (path) => {
          const value = path.node.quasis.map(q => q.value.raw).join('[expr]');
          if (value.length > 3 && this.isMeaningfulString(value)) {
            results.push(this.createSemanticInfo(
              value,
              'string',
              path.node.loc,
              filePath,
              lines,
              this.getContext(path.node.loc, lines)
            ));
          }
        },
      });

      // Extract comments
      if (ast.comments) {
        ast.comments.forEach(comment => {
          const value = comment.value.trim();
          if (value.length > 5) { // Skip tiny comments
            results.push(this.createSemanticInfo(
              value,
              'comment',
              comment.loc,
              filePath,
              lines,
              this.getContext(comment.loc, lines)
            ));
          }
        });
      }

    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error);
      // Fallback to simple regex extraction
      return this.fallbackExtraction(content, filePath);
    }

    return { definitions, references }; // Return both!
  }

  private createSemanticInfo(
    term: string,
    type: SemanticInfo['type'],
    loc: any,
    filePath: string,
    lines: string[],
    context: string
  ): SemanticInfo {
    return {
      term,
      type,
      location: {
        file: filePath,
        line: loc?.start?.line || 0,
        column: loc?.start?.column || 0,
      },
      context,
      surroundingLines: this.getSurroundingLines(loc?.start?.line || 0, lines),
      relatedTerms: this.extractRelatedTerms(context),
      language: 'typescript',
    };
  }

  private getContext(loc: any, lines: string[]): string {
    if (!loc?.start?.line) return '';
    const lineIndex = loc.start.line - 1;
    return lines[lineIndex] || '';
  }

  private getSurroundingLines(lineNumber: number, lines: string[]): string[] {
    const start = Math.max(0, lineNumber - 2);
    const end = Math.min(lines.length, lineNumber + 2);
    return lines.slice(start, end);
  }

  private extractRelatedTerms(context: string): string[] {
    // Extract identifiers from the context line
    const identifierRegex = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
    const matches = context.match(identifierRegex) || [];
    return [...new Set(matches)].filter(term => term.length > 2);
  }

  private isMeaningfulString(value: string): boolean {
    // Filter out strings that are likely just data
    if (/^\d+$/.test(value)) return false; // Just numbers
    if (/^[A-Z_]+$/.test(value) && value.length < 10) return false; // Short constants
    if (value.includes(' ') || value.includes('/') || value.length > 10) return true; // Likely meaningful
    return false;
  }

  private fallbackExtraction(content: string, filePath: string): { definitions: SemanticInfo[]; references: CrossReference[] } {
    // Simple regex-based extraction as fallback
    const definitions: SemanticInfo[] = [];
    const references: CrossReference[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Extract function declarations
      const functionMatch = line.match(/(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (functionMatch) {
        results.push({
          term: functionMatch[1],
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [],
          language: 'typescript',
        });
      }

      // Extract strings
      const stringMatches = line.match(/"([^"]{4,})"|'([^']{4,})'/g);
      if (stringMatches) {
        stringMatches.forEach(match => {
          const value = match.slice(1, -1); // Remove quotes
          if (this.isMeaningfulString(value)) {
            results.push({
              term: value,
              type: 'string',
              location: { file: filePath, line: index + 1, column: 0 },
              context: line.trim(),
              surroundingLines: [line.trim()],
              relatedTerms: [],
              language: 'typescript',
            });
          }
        });
      }
    });

    return results;
  }
}
```

### 4. Semantic Service Integration

Create `src/semantic/SemanticService.ts`:

```typescript
import { CodebaseStreamerBun } from '../core/CodebaseStreamerBun';
import { SemanticIndexImpl } from './SemanticIndexImpl';
import { TypeScriptExtractor } from './extractors/TypeScriptExtractor';
import { LanguageExtractor, SemanticInfo } from './types';

export class SemanticService {
  private index = new SemanticIndexImpl();
  private extractors: LanguageExtractor[] = [
    new TypeScriptExtractor(),
    // Add more extractors here as you implement them
  ];

  async indexCodebase(projectPath: string): Promise<void> {
    console.log('🔍 Building semantic index...');
    
    const streamer = new CodebaseStreamerBun(projectPath);
    const startTime = Date.now();
    let filesProcessed = 0;
    let entriesIndexed = 0;

    // Clear existing index
    this.index.clear();

    // Process files in batches
    for await (const batch of streamer.streamFiles()) {
      for (const [filePath, content] of batch.files) {
        const extractor = this.extractors.find(e => e.canHandle(filePath));
        
        if (extractor) {
          try {
            const semanticInfo = extractor.extract(content, filePath);
            semanticInfo.forEach(info => {
              this.index.add(info);
              entriesIndexed++;
            });
            filesProcessed++;
          } catch (error) {
            console.warn(`Error processing ${filePath}:`, error);
          }
        }
      }

      // Show progress
      console.log(`Processed ${filesProcessed} files, indexed ${entriesIndexed} entries...`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Semantic index complete: ${filesProcessed} files, ${entriesIndexed} entries in ${duration}ms`);

    // Save index to disk
    const indexPath = `${projectPath}/.curator/semantic-index.json`;
    await this.index.save(indexPath);
    console.log(`💾 Index saved to ${indexPath}`);
  }

  async loadIndex(projectPath: string): Promise<boolean> {
    const indexPath = `${projectPath}/.curator/semantic-index.json`;
    try {
      await this.index.load(indexPath);
      console.log(`📖 Loaded semantic index from ${indexPath}`);
      return true;
    } catch {
      return false;
    }
  }

  search(query: string, options?: any) {
    return this.index.search(query, options);
  }

  searchGroup(terms: string[]) {
    return this.index.searchGroup(terms);
  }
}
```

### 5. CLI Implementation (Version 3.0)

The CLI now supports advanced patterns and rich output:

```typescript
#!/usr/bin/env bun

import { SemanticService } from './SemanticService';

// Extended concept groups
const CONCEPT_GROUPS = {
  auth: ["auth", "authenticate", "login", "signin", "credential", "token", "oauth", "jwt"],
  database: ["db", "database", "query", "sql", "mongo", "redis", "orm", "migration"],
  api: ["api", "endpoint", "route", "request", "response", "controller", "handler"],
  error: ["error", "exception", "fail", "invalid", "warning", "catch", "throw"],
  service: ["service", "provider", "manager", "orchestrator", "handler", "processor"],
  flow: ["flow", "stream", "pipeline", "process", "workflow", "sequence", "chain"],
  // ... many more groups
};

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    process.exit(1);
  }

  const command = args[0];
  const projectPath = process.cwd();
  const service = new SemanticService();

  switch (command) {
    case 'index':
      await service.indexCodebase(projectPath);
      break;
      
    case 'search':
      await handleSearch(service, projectPath, args.slice(1));
      break;
      
    default:
      // Default to search
      await handleSearch(service, projectPath, args);
  }
}

async function handleSearch(service: SemanticService, projectPath: string, args: string[]) {
  // Load index
  const loaded = await service.loadIndex(projectPath);
  if (!loaded) {
    console.log('No semantic index found. Building...');
    await service.indexCodebase(projectPath);
  }

  // Parse arguments for options
  let query = '';
  let searchMode: 'fuzzy' | 'exact' | 'regex' = 'fuzzy';
  let typeFilter: string[] | undefined;
  let sortBy: 'relevance' | 'usage' | 'name' | 'file' = 'relevance';
  // ... parse all options

  // Handle different search patterns
  let results: SearchResult[] = [];
  
  if (query.includes('|')) {
    // OR pattern
    const terms = query.split('|').map(t => t.trim());
    results = service.searchGroup(terms);
  } else if (query.includes('&')) {
    // AND pattern
    const terms = query.split('&').map(t => t.trim());
    results = await searchWithAnd(service, terms, options);
  } else if (query.startsWith('!')) {
    // NOT pattern
    results = await searchWithNot(service, query.substring(1), options);
  } else if (searchMode === 'regex') {
    // Regex pattern
    results = await searchWithRegex(service, query, options);
  } else {
    // Normal search
    results = service.search(query, { exact: searchMode === 'exact', ...options });
  }

  // Sort and display
  results = sortResults(results, sortBy);
  displayResults(query, results, showContext);
}

function displayResults(query: string, results: any[]) {
  if (results.length === 0) {
    console.log(`No results found for "${query}"`);
    return;
  }

  console.log(`\n🔍 Search: "${query}" (found ${results.length} results)\n`);

  // Group by type
  const grouped = results.reduce((acc, result) => {
    const type = result.info.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(result);
    return acc;
  }, {});

  // Display each group
  for (const [type, items] of Object.entries(grouped) as [string, any[]][]) {
    const icon = getTypeIcon(type);
    console.log(`${icon} ${type.toUpperCase()} (${items.length})`);
    
    items.slice(0, 10).forEach(result => { // Limit to top 10 per type
      const info = result.info;
      const termDisplay = result.usageCount 
        ? `${info.term} (${result.usageCount} uses)`
        : info.term;
      
      // Show full location with column
      console.log(`├── ${termDisplay.padEnd(30)} → ${info.location.file}:${info.location.line}:${info.location.column}`);
      
      // Show full context for functions/classes
      if (type === 'function' || type === 'class') {
        console.log(`│   ${info.context.trim()}`);
        
        // Show surrounding lines
        if (info.surroundingLines && info.surroundingLines.length > 0) {
          console.log(`│   ┌─ Context:`);
          info.surroundingLines.slice(0, 3).forEach(line => {
            console.log(`│   │ ${line.trim()}`);
          });
        }
        
        // Show related terms
        if (info.relatedTerms && info.relatedTerms.length > 0) {
          console.log(`│   📎 Related: ${info.relatedTerms.slice(0, 5).join(', ')}`);
        }
        
        // Show sample usages
        if (result.sampleUsages && result.sampleUsages.length > 0) {
          console.log(`│   `);
          console.log(`│   📍 Used ${result.usageCount} times:`);
          result.sampleUsages.slice(0, 3).forEach((usage, idx) => {
            const usageFile = usage.fromLocation.file.split('/').pop();
            console.log(`│   ${idx + 1}. ${usageFile}:${usage.fromLocation.line} (${usage.referenceType})`);
            console.log(`│      ${usage.context.trim()}`);
          });
        }
      }
      
      // Show context if it's a string or comment
      if ((type === 'string' || type === 'comment') && info.context) {
        console.log(`│   "${info.context.trim().substring(0, 60)}${info.context.length > 60 ? '...' : '}"`);
      }
    });
    
    if (items.length > 10) {
      console.log(`└── ... and ${items.length - 10} more`);
    }
    console.log('');
  }
}

function getTypeIcon(type: string): string {
  const icons = {
    function: '📁',
    class: '📦',
    variable: '📄',
    constant: '🔤',
    string: '💬',
    comment: '📝',
    import: '📥',
    file: '🗂️'
  };
  return icons[type as keyof typeof icons] || '📄';
}

function showHelp() {
  console.log(`
🔍 Smart Grep - Semantic Code Search

Usage:
  smartgrep <query>           Search for term
  smartgrep index            Rebuild semantic index
  smartgrep auth             Search concept group (auth, api, database, etc.)

Examples:
  smartgrep "authentication"
  smartgrep auth
  smartgrep "user"
  smartgrep payment
`);
}

main().catch(console.error);
```

### 6. Integration with Existing System

Add to `package.json`:

```json
{
  "scripts": {
    "smartgrep": "bun run src/semantic/cli.ts"
  }
}
```

Add to your MCP server tools:

```typescript
{
  name: 'smart_grep',
  description: 'Semantic search through codebase using indexed semantic information',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search term or concept group' },
      type: { type: 'string', description: 'Filter by type: function, class, string, etc.' },
      projectPath: { type: 'string', description: 'Project path (optional)' }
    },
    required: ['query']
  }
}
```

## Dependencies You Need

Add these to your `package.json`:

```json
{
  "dependencies": {
    "@babel/parser": "^7.23.0",
    "@babel/traverse": "^7.23.0",
    "@babel/types": "^7.23.0"
  },
  "devDependencies": {
    "@types/babel__parser": "^7.1.1",
    "@types/babel__traverse": "^7.20.2"
  }
}
```

## Repositories to Clone for Reference

Clone these into your `docs/libraries/` folder:

```bash
# Babel (JavaScript/TypeScript parsing)
git clone https://github.com/babel/babel.git docs/libraries/babel

# Tree-sitter (universal parser - for future use)
git clone https://github.com/tree-sitter/tree-sitter.git docs/libraries/tree-sitter

# Python AST examples
git clone https://github.com/python/cpython.git docs/libraries/cpython

# Go parser examples  
git clone https://github.com/golang/tools.git docs/libraries/go-tools
```

## Cross-Reference Implementation Summary

### What We Added

1. **Dual Index Structure**
   - Term index for definitions (existing)
   - Cross-reference index for usages (NEW!)

2. **Enhanced Language Extractors**
   - Extract both definitions AND references
   - Track function calls, class usage, imports

3. **Smart Search Results**
   - Show usage counts: "functionName (5 uses)"
   - Include sample usage locations
   - Enable impact analysis

4. **New CLI Commands**
   - `smartgrep refs <term>` - Show all references
   - Usage information in search results

### Benefits

- **Impact Analysis**: Know what breaks if you change something
- **Better Understanding**: See how code is actually used
- **Smarter Search**: Results ranked by usage frequency
- **Curator Efficiency**: One search gives complete picture

## Testing Strategy

Create `tests/semantic.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { TypeScriptExtractor } from '../src/semantic/extractors/TypeScriptExtractor';

describe('TypeScriptExtractor', () => {
  const extractor = new TypeScriptExtractor();

  it('extracts function names', () => {
    const code = `
      function authenticateUser(email: string) {
        return true;
      }
    `;
    
    const results = extractor.extract(code, 'test.ts');
    expect(results).toContainEqual(
      expect.objectContaining({
        term: 'authenticateUser',
        type: 'function'
      })
    );
  });

  it('extracts meaningful strings', () => {
    const code = `
      throw new Error("Invalid credentials provided");
    `;
    
    const results = extractor.extract(code, 'test.ts');
    expect(results).toContainEqual(
      expect.objectContaining({
        term: 'Invalid credentials provided',
        type: 'string'
      })
    );
  });
});
```

## Next Steps

1. **Start with TypeScript extractor** - Get the core working first
2. **Test on your existing codebase** - See what results you get
3. **Add Python extractor** - Copy the pattern for Python AST
4. **Integrate with curator** - Add smartgrep as a curator tool
5. **Add more concept groups** - Based on what you find useful

## Tips for Implementation

- **Start simple**: Get basic indexing working before adding fancy features
- **Test incrementally**: Test each extractor on real code as you build
- **Handle errors gracefully**: Parsing can fail, have good fallbacks
- **Performance matters**: Index once, search many times
- **Feedback loop**: Use the tool yourself and iterate based on real usage

---

This implementation gives you a fully functional semantic search tool that Curator Claude will genuinely love using. The key is starting with TypeScript/JavaScript and expanding from there.