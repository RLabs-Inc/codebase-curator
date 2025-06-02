/**
 * Semantic Search Types
 * Core types for the smart-grep semantic indexing system
 */

export interface CrossReference {
  // The term being referenced (e.g., function name, class name)
  targetTerm: string;
  // Type of reference
  referenceType: 'call' | 'import' | 'extends' | 'implements' | 'instantiation' | 'type-reference';
  // Where the reference is made from
  fromLocation: {
    file: string;
    line: number;
    column: number;
  };
  // The actual code making the reference
  context: string;
}

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
  // Cross-reference support
  references?: CrossReference[]; // Where this term is used
}

export interface LanguageExtractor {
  canHandle(filePath: string): boolean;
  extract(content: string, filePath: string): {
    definitions: SemanticInfo[];
    references: CrossReference[];
  };
}

export interface SemanticIndex {
  add(info: SemanticInfo): void;
  addCrossReference(ref: CrossReference): void;
  search(query: string, options?: SearchOptions): SearchResult[];
  searchGroup(terms: string[]): SearchResult[];
  getReferences(term: string): CrossReference[];
  getImpactAnalysis(term: string): {
    directReferences: CrossReference[];
    fileCount: number;
    byType: Record<string, number>;
  };
  clear(): void;
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;
}

export interface SearchOptions {
  type?: SemanticInfo['type'][];
  files?: string[]; // File patterns
  maxResults?: number;
  includeContext?: boolean;
  exact?: boolean; // Exact match only (no fuzzy/partial matching)
}

export interface SearchResult {
  info: SemanticInfo;
  relevanceScore: number;
  usageCount?: number; // Number of times this term is referenced
  sampleUsages?: CrossReference[]; // Up to 3 example usages
}