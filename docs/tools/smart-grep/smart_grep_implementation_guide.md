# Smart Grep Tool - Implementation Guide for Claude Code

> **For Claude Developer**: This guide is written specifically for you. It assumes you're working in Claude Code and provides step-by-step implementation details with real code examples.

## Overview: What You're Building 🎯

You're building a semantic indexing system that extracts meaningful information from codebases and makes it searchable. Think "grep but understands code structure and semantics."

**Core Concept**: Parse every file → Extract semantic info → Index for fast search → Provide smart CLI interface

## Architecture Overview

```
Codebase Files → Language Parsers → Semantic Extractor → Index → Search Interface
     ↓              ↓                    ↓              ↓           ↓
   *.ts, *.py    Babel, AST           Functions,     JSON/DB    smartgrep CLI
   *.go, *.js    Tree-sitter         Classes,                      ↓
                                     Strings                   Rich Results
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Semantic extractor interface** - Common interface for all language parsers
2. **Index storage** - Fast storage and retrieval of semantic information  
3. **Basic CLI** - Simple search interface
4. **TypeScript/JavaScript support** - First language implementation

### Phase 2: Language Expansion
5. **Python support** - Second language
6. **Go support** - Third language  
7. **Generic fallback** - For unsupported languages

### Phase 3: Advanced Features
8. **Concept groups** - Predefined search clusters
9. **Smart filtering** - Type-based and context-based filters
10. **Integration** - Connect with existing curator system

## Detailed Implementation

### 1. Core Interfaces

Create `src/semantic/types.ts`:

```typescript
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
}

export interface LanguageExtractor {
  canHandle(filePath: string): boolean;
  extract(content: string, filePath: string): SemanticInfo[];
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

  extract(content: string, filePath: string): SemanticInfo[] {
    const results: SemanticInfo[] = [];
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
            results.push(this.createSemanticInfo(
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

    return results;
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

  private fallbackExtraction(content: string, filePath: string): SemanticInfo[] {
    // Simple regex-based extraction as fallback
    const results: SemanticInfo[] = [];
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

### 5. CLI Implementation

Create `src/semantic/cli.ts`:

```typescript
#!/usr/bin/env bun

import { SemanticService } from './SemanticService';

const CONCEPT_GROUPS = {
  auth: ["auth", "authenticate", "login", "signin", "credential", "token", "oauth", "jwt"],
  database: ["db", "database", "query", "sql", "mongo", "redis", "orm", "migration"],
  api: ["api", "endpoint", "route", "request", "response", "controller", "handler"],
  error: ["error", "exception", "fail", "invalid", "warning", "catch", "throw"],
  user: ["user", "account", "profile", "member", "customer", "person"],
  payment: ["payment", "billing", "charge", "invoice", "transaction", "stripe", "paypal"],
  config: ["config", "setting", "environment", "env", "constant", "variable"],
  test: ["test", "spec", "mock", "fixture", "assert", "expect", "describe"]
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
  // Try to load existing index
  const loaded = await service.loadIndex(projectPath);
  if (!loaded) {
    console.log('No semantic index found. Building...');
    await service.indexCodebase(projectPath);
  }

  const query = args[0];
  if (!query) {
    console.error('Please provide a search query');
    process.exit(1);
  }

  // Check if it's a concept group
  const conceptGroup = CONCEPT_GROUPS[query.toLowerCase() as keyof typeof CONCEPT_GROUPS];
  
  const results = conceptGroup 
    ? service.searchGroup(conceptGroup)
    : service.search(query);

  displayResults(query, results);
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
      const relevance = (result.relevanceScore * 100).toFixed(0);
      console.log(`├── ${info.term.padEnd(25)} → ${info.location.file}:${info.location.line} (${relevance}%)`);
      
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