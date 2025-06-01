/**
 * Semantic Index Implementation
 * Fast in-memory index with term-based and partial match searching
 */

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

    // Index kebab-case parts: "user-name" → ["user", "name"]
    const kebabParts = term.split('-');
    kebabParts.forEach(part => {
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
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
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
      entries: Array.from(this.entries.entries()),
      termIndex: Array.from(this.termIndex.entries()),
    };
    await Bun.write(path, JSON.stringify(data, null, 2));
  }

  async load(path: string): Promise<void> {
    try {
      const file = Bun.file(path);
      const data = await file.json();
      
      this.entries = new Map(data.entries);
      this.termIndex = new Map(data.termIndex);
    } catch (error) {
      console.warn(`Could not load semantic index from ${path}:`, error);
    }
  }
}