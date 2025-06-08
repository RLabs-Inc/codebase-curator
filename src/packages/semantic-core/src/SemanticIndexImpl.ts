/**
 * Semantic Index Implementation
 * Fast in-memory index with term-based and partial match searching
 */

import type {
  SemanticIndex,
  SemanticInfo,
  SearchOptions,
  SearchResult,
  CrossReference,
} from './types'

export class SemanticIndexImpl implements SemanticIndex {
  private entries: Map<string, SemanticInfo[]> = new Map()
  private termIndex: Map<string, SemanticInfo[]> = new Map()
  // Cross-reference tracking
  private crossReferences: Map<string, CrossReference[]> = new Map()
  private fileReferences: Map<string, CrossReference[]> = new Map()

  add(info: SemanticInfo): void {
    // Add to file-based index
    const fileEntries = this.entries.get(info.location.file) || []
    fileEntries.push(info)
    this.entries.set(info.location.file, fileEntries)

    // Add to term-based index (for fast searching)
    const normalizedTerm = info.term.toLowerCase()
    const termEntries = this.termIndex.get(normalizedTerm) || []
    termEntries.push(info)
    this.termIndex.set(normalizedTerm, termEntries)

    // Also index partial matches (for fuzzy search)
    this.indexPartialMatches(info)
  }

  private indexPartialMatches(info: SemanticInfo): void {
    const term = info.term.toLowerCase()
    const partsToIndex = new Set<string>()

    // Index camelCase parts: "getUserName" → ["get", "user", "name"]
    const camelParts = term.split(/(?=[A-Z])/).map((s) => s.toLowerCase())
    camelParts.forEach((part) => {
      if (part.length > 2 && part !== term) {
        partsToIndex.add(part)
      }
    })

    // Index snake_case parts: "user_name" → ["user", "name"]
    const snakeParts = term.split('_')
    snakeParts.forEach((part) => {
      if (part.length > 2 && part !== term) {
        partsToIndex.add(part)
      }
    })

    // Index kebab-case parts: "user-name" → ["user", "name"]
    const kebabParts = term.split('-')
    kebabParts.forEach((part) => {
      if (part.length > 2 && part !== term) {
        partsToIndex.add(part)
      }
    })

    // Add to index only once per unique part
    partsToIndex.forEach((part) => {
      const entries = this.termIndex.get(part) || []
      // Only add if not already present (avoid duplicates)
      if (!entries.some(e => e.term === info.term && e.location.line === info.location.line)) {
        entries.push(info)
        this.termIndex.set(part, entries)
      }
    })
  }

  addCrossReference(ref: CrossReference): void {
    // Index by target term
    const targetRefs = this.crossReferences.get(ref.targetTerm) || []
    targetRefs.push(ref)
    this.crossReferences.set(ref.targetTerm, targetRefs)

    // Also index by file (for quick file-based lookups)
    const fileRefs = this.fileReferences.get(ref.fromLocation.file) || []
    fileRefs.push(ref)
    this.fileReferences.set(ref.fromLocation.file, fileRefs)
  }

  getReferences(term: string): CrossReference[] {
    return this.crossReferences.get(term) || []
  }

  getImpactAnalysis(term: string): {
    directReferences: CrossReference[]
    fileCount: number
    byType: Record<string, number>
  } {
    const references = this.getReferences(term)
    const uniqueFiles = new Set(references.map((ref) => ref.fromLocation.file))

    const byType: Record<string, number> = {}
    references.forEach((ref) => {
      byType[ref.referenceType] = (byType[ref.referenceType] || 0) + 1
    })

    return {
      directReferences: references,
      fileCount: uniqueFiles.size,
      byType,
    }
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const normalizedQuery = query.toLowerCase()
    const results: SearchResult[] = []

    // Handle empty query - return all results
    if (!query) {
      for (const [term, infos] of this.termIndex.entries()) {
        infos.forEach((info) => {
          if (this.matchesOptions(info, options)) {
            results.push(this.createSearchResult(info, 0.5))
          }
        })
      }
    } else if (options.exact) {
      // Exact match only
      const exactMatches = this.termIndex.get(normalizedQuery) || []
      exactMatches.forEach((info) => {
        if (this.matchesOptions(info, options)) {
          results.push(this.createSearchResult(info, 1.0))
        }
      })
    } else {
      // Enhanced fuzzy matching with multiple strategies
      
      // 1. Exact matches (case-insensitive) - highest score
      const exactMatches = this.termIndex.get(normalizedQuery) || []
      exactMatches.forEach((info) => {
        if (this.matchesOptions(info, options)) {
          results.push(this.createSearchResult(info, 1.0))
        }
      })

      // 2. Case variations (for exact term)
      for (const [term, infos] of this.termIndex.entries()) {
        if (term.toLowerCase() === normalizedQuery && term !== normalizedQuery) {
          infos.forEach((info) => {
            if (this.matchesOptions(info, options)) {
              results.push(this.createSearchResult(info, 0.95))
            }
          })
        }
      }

      // 3. Word boundary matches (term starts with or ends with query)
      for (const [term, infos] of this.termIndex.entries()) {
        const termLower = term.toLowerCase()
        if (termLower !== normalizedQuery) {
          // Check if query matches at word boundaries
          const startsWithQuery = termLower.startsWith(normalizedQuery)
          const endsWithQuery = termLower.endsWith(normalizedQuery)
          const containsAtBoundary = this.matchesAtWordBoundary(termLower, normalizedQuery)
          
          if (startsWithQuery || endsWithQuery || containsAtBoundary) {
            infos.forEach((info) => {
              if (this.matchesOptions(info, options)) {
                // Higher score for boundary matches
                const score = startsWithQuery ? 0.85 : (endsWithQuery ? 0.80 : 0.75)
                results.push(this.createSearchResult(info, score))
              }
            })
          }
        }
      }

      // 4. Substring matches (contains query anywhere)
      for (const [term, infos] of this.termIndex.entries()) {
        const termLower = term.toLowerCase()
        if (termLower.includes(normalizedQuery) && 
            !termLower.startsWith(normalizedQuery) && 
            !termLower.endsWith(normalizedQuery) &&
            !this.matchesAtWordBoundary(termLower, normalizedQuery)) {
          infos.forEach((info) => {
            if (this.matchesOptions(info, options)) {
              // Score based on how much of the term matches
              const score = 0.6 * (normalizedQuery.length / term.length)
              results.push(this.createSearchResult(info, score))
            }
          })
        }
      }

      // 5. Common variations (auth -> authenticate, config -> configuration)
      const variations = this.getCommonVariations(normalizedQuery)
      for (const variation of variations) {
        for (const [term, infos] of this.termIndex.entries()) {
          if (term.toLowerCase().includes(variation)) {
            infos.forEach((info) => {
              if (this.matchesOptions(info, options)) {
                results.push(this.createSearchResult(info, 0.5))
              }
            })
          }
        }
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = this.deduplicateResults(results)
    uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return uniqueResults.slice(0, options.maxResults || 100)
  }

  searchGroup(terms: string[]): SearchResult[] {
    const allResults: SearchResult[] = []

    terms.forEach((term) => {
      const termResults = this.search(term)
      allResults.push(...termResults)
    })

    return this.deduplicateResults(allResults)
  }

  private createSearchResult(
    info: SemanticInfo,
    relevanceScore: number
  ): SearchResult {
    const references = this.getReferences(info.term)
    const result: SearchResult = {
      info,
      relevanceScore,
      usageCount: references.length,
    }

    // Add sample usages (up to 3)
    if (references.length > 0) {
      result.sampleUsages = references.slice(0, 3)
    }

    return result
  }

  private matchesOptions(info: SemanticInfo, options: SearchOptions): boolean {
    if (options.type && !options.type.includes(info.type)) {
      return false
    }

    if (options.files) {
      const matchesFile = options.files.some(
        (pattern) =>
          info.location.file.includes(pattern) ||
          this.globMatch(info.location.file, pattern)
      )
      if (!matchesFile) return false
    }

    return true
  }

  private globMatch(path: string, pattern: string): boolean {
    // Simple glob matching - you might want to use a library for this
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(regex).test(path)
  }

  private matchesAtWordBoundary(term: string, query: string): boolean {
    // Check if query appears at camelCase, snake_case, or kebab-case boundaries
    const boundaries = [
      // CamelCase boundaries
      /[a-z][A-Z]/g,
      // snake_case and kebab-case
      /[_-]/g,
      // Dots and slashes (for namespaced items)
      /[.\/]/g
    ]
    
    for (const boundary of boundaries) {
      const parts = term.split(boundary)
      for (const part of parts) {
        if (part.toLowerCase().startsWith(query) || part.toLowerCase() === query) {
          return true
        }
      }
    }
    
    // Also check if query appears after common prefixes
    const prefixes = ['get', 'set', 'is', 'has', 'create', 'update', 'delete', 'handle', 'process']
    for (const prefix of prefixes) {
      if (term.toLowerCase().startsWith(prefix) && 
          term.toLowerCase().substring(prefix.length).startsWith(query)) {
        return true
      }
    }
    
    return false
  }

  private getCommonVariations(query: string): string[] {
    const variations: string[] = []
    
    // Common abbreviations and their expansions
    const expansions: Record<string, string[]> = {
      'auth': ['authenticate', 'authorization', 'authorized'],
      'config': ['configuration', 'configure'],
      'db': ['database'],
      'ctx': ['context'],
      'req': ['request', 'require'],
      'res': ['response', 'result'],
      'err': ['error'],
      'msg': ['message'],
      'usr': ['user'],
      'pwd': ['password'],
      'mgr': ['manager'],
      'ctrl': ['controller', 'control'],
      'svc': ['service'],
      'repo': ['repository'],
      'util': ['utility', 'utilities'],
      'lib': ['library'],
      'pkg': ['package'],
      'proc': ['process', 'processor'],
      'exec': ['execute', 'execution'],
      'init': ['initialize', 'initialization']
    }
    
    // Check if query is an abbreviation
    if (expansions[query]) {
      variations.push(...expansions[query])
    }
    
    // Check if query is a shortened version of common words
    for (const [abbr, expanded] of Object.entries(expansions)) {
      for (const word of expanded) {
        if (word.startsWith(query) && query.length >= 3) {
          variations.push(word)
        }
      }
    }
    
    return [...new Set(variations)] // Remove duplicates
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return results.filter((result) => {
      const key = `${result.info.location.file}:${result.info.location.line}:${result.info.term}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  clear(): void {
    this.entries.clear()
    this.termIndex.clear()
    this.crossReferences.clear()
    this.fileReferences.clear()
  }

  removeFile(filePath: string): void {
    // Remove from file-based index
    const fileEntries = this.entries.get(filePath) || []
    this.entries.delete(filePath)

    // Remove from term-based index
    fileEntries.forEach((info) => {
      const normalizedTerm = info.term.toLowerCase()
      const termEntries = this.termIndex.get(normalizedTerm) || []
      const filtered = termEntries.filter(
        (entry) => entry.location.file !== filePath
      )

      if (filtered.length === 0) {
        this.termIndex.delete(normalizedTerm)
      } else {
        this.termIndex.set(normalizedTerm, filtered)
      }
    })

    // Remove from cross-references
    this.fileReferences.delete(filePath)

    // Remove references that originate from this file
    for (const [term, refs] of this.crossReferences.entries()) {
      const filtered = refs.filter((ref) => ref.fromLocation.file !== filePath)
      if (filtered.length === 0) {
        this.crossReferences.delete(term)
      } else {
        this.crossReferences.set(term, filtered)
      }
    }
  }

  getStats(): { totalEntries: number; totalFiles: number } {
    let totalEntries = 0
    for (const entries of this.entries.values()) {
      totalEntries += entries.length
    }

    return {
      totalEntries,
      totalFiles: this.entries.size,
    }
  }

  async save(path: string): Promise<void> {
    const stats = this.getStats()
    
    // For massive codebases (>50K entries), use a lightweight summary format
    if (stats.totalEntries > 50000) {
      console.log(`💾 Large index detected (${stats.totalEntries} entries) - using summary format`)
      
      const summary = {
        type: 'large_index_summary',
        stats,
        timestamp: Date.now(),
        note: 'Full index too large for JSON serialization. Search functionality remains active in memory.',
        // Save just the most important data
        topTerms: this.getTopTerms(100),
        fileCount: this.entries.size,
        version: '1.0'
      }
      
      await Bun.write(path, JSON.stringify(summary, null, 2))
      console.log(`✅ Summary saved to ${path}`)
      return
    }

    // Build JSON in memory for reliability
    const data = {
      entries: Array.from(this.entries.entries()),
      termIndex: Array.from(this.termIndex.entries()),
      crossReferences: Array.from(this.crossReferences.entries()),
      fileReferences: Array.from(this.fileReferences.entries()),
    }
    
    await Bun.write(path, JSON.stringify(data, null, 2))
  }

  private getTopTerms(limit: number): Array<{term: string, count: number}> {
    const termCounts = new Map<string, number>()
    
    for (const [term, infos] of this.termIndex.entries()) {
      termCounts.set(term, infos.length)
    }
    
    return Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term, count]) => ({ term, count }))
  }

  private async streamSerializeMap(
    writer: any,
    map: Map<any, any>,
    isFirst: boolean
  ): Promise<void> {
    let count = 0
    const CHUNK_SIZE = 10 // Process in small chunks
    
    for (const [key, value] of map.entries()) {
      if (count > 0) writer.write(',')
      
      // Serialize individual items, not arrays
      writer.write('\n    [')
      writer.write(JSON.stringify(key))
      writer.write(', ')
      
      // For arrays of SemanticInfo, serialize each item separately
      if (Array.isArray(value)) {
        writer.write('[')
        let arrayFirst = true
        for (const item of value) {
          if (!arrayFirst) writer.write(',')
          writer.write(JSON.stringify(item))
          arrayFirst = false
        }
        writer.write(']')
      } else {
        writer.write(JSON.stringify(value))
      }
      
      writer.write(']')
      count++
      
      // Flush periodically to prevent memory buildup
      if (count % CHUNK_SIZE === 0) {
        await writer.flush()
      }
    }
    
    // Final flush to ensure all data is written
    if (count % CHUNK_SIZE !== 0) {
      await writer.flush()
    }
  }

  async load(path: string): Promise<void> {
    try {
      const file = Bun.file(path)
      const data = await file.json()

      this.entries = new Map(data.entries)
      this.termIndex = new Map(data.termIndex)
      this.crossReferences = new Map(data.crossReferences || [])
      this.fileReferences = new Map(data.fileReferences || [])
    } catch (error) {
      // Silently fail - it's normal for index not to exist on first run
      throw error
    }
  }
}
