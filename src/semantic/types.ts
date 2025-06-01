/**
 * Semantic Search Types
 * Core types for the smart-grep semantic indexing system
 */

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