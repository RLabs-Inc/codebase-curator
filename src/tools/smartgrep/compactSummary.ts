/**
 * Compact Summary Generator for Claude-First Output
 * 
 * Creates concise, actionable summaries that preserve context
 * while providing maximum information density for Claudes
 */

import type { SearchResult, CrossReference } from '@codebase-curator/semantic-core'

export interface CompactSummaryOptions {
  maxBreakingChanges?: number
  maxUsageExamples?: number
  includePatterns?: boolean
}

const DEFAULT_OPTIONS: CompactSummaryOptions = {
  maxBreakingChanges: 5,
  maxUsageExamples: 3,
  includePatterns: true
}

export class CompactSummaryGenerator {
  constructor(private options: CompactSummaryOptions = DEFAULT_OPTIONS) {}
  
  generate(query: string, results: SearchResult[]): string {
    if (results.length === 0) {
      return this.generateNoResultsSummary(query)
    }
    
    const output: string[] = []
    
    // Header
    output.push('═'.repeat(70))
    output.push(`🔍 SMARTGREP: "${query}" (${results.length} results in ${this.countUniqueFiles(results)} files)`)
    output.push('')
    
    // Primary definition with signature
    const primary = this.findPrimaryDefinition(results)
    if (primary) {
      output.push(this.formatDefinition(primary))
      output.push('')
    }
    
    // Top usage with context
    const topUsage = this.getTopUsage(results)
    if (topUsage.length > 0) {
      output.push('🔥 TOP USAGE:')
      topUsage.forEach(usage => output.push(usage))
      output.push('')
    }
    
    // Breaking changes (detailed)
    const breakingChanges = this.getBreakingChanges(results)
    if (breakingChanges.length > 0) {
      output.push('⚡ BREAKING CHANGES (if you modify this):')
      breakingChanges.forEach(change => output.push(change))
      output.push('')
    }
    
    // Patterns detected
    if (this.options.includePatterns) {
      const patterns = this.detectPatterns(results)
      if (patterns.length > 0) {
        output.push('💡 PATTERNS DETECTED:')
        patterns.forEach(pattern => output.push(pattern))
        output.push('')
      }
    }
    
    // Next suggestions
    const suggestions = this.generateNextSuggestions(query, results)
    output.push('🎯 NEXT: ' + suggestions.join(' | '))
    output.push(`         For full results: smartgrep "${query}" --full`)
    
    output.push('═'.repeat(70))
    
    return output.join('\n')
  }
  
  private findPrimaryDefinition(results: SearchResult[]): SearchResult | undefined {
    // Prioritize class/function/interface definitions
    const definitions = results.filter(r => 
      ['class', 'function', 'interface', 'type', 'enum'].includes(r.info.type)
    )
    
    if (definitions.length === 0) return results[0]
    
    // Sort by relevance and type priority
    return definitions.sort((a, b) => {
      const typePriority: Record<string, number> = {
        'class': 5,
        'interface': 4,
        'function': 3,
        'type': 2,
        'enum': 1
      }
      
      const aPriority = typePriority[a.info.type] || 0
      const bPriority = typePriority[b.info.type] || 0
      
      if (aPriority !== bPriority) return bPriority - aPriority
      return b.relevanceScore - a.relevanceScore
    })[0]
  }
  
  private formatDefinition(result: SearchResult): string {
    const { info } = result
    const location = `${info.location.file}:${info.location.line}`
    const typeUpper = info.type.toUpperCase()
    
    let output = `📍 DEFINITION: ${location} (${typeUpper})\n`
    
    // Extract signature based on type
    const signature = this.extractSignature(info)
    if (signature) {
      output += `   ${signature}`
    }
    
    return output
  }
  
  private extractSignature(info: any): string | null {
    const context = info.context.trim()
    
    switch (info.type) {
      case 'class':
        // Show the class declaration line
        const classDecl = context.trim()
        
        // Look for constructor in surrounding lines
        if (info.surroundingLines && info.surroundingLines.length > 0) {
          // Try to find constructor
          for (let i = 0; i < info.surroundingLines.length; i++) {
            const line = info.surroundingLines[i]
            if (line.includes('constructor') && line.includes('(')) {
              return `${classDecl}\n   ${line.trim()}`
            }
            // For other languages
            if (line.includes('__init__') && line.includes('(')) {
              return `${classDecl}\n   ${line.trim()}`
            }
            // Go/Rust constructors
            if ((line.includes('New') || line.includes('new')) && line.includes('(')) {
              return `${classDecl}\n   ${line.trim()}`
            }
          }
        }
        // Just return class declaration if no constructor found
        return classDecl
        
      case 'function':
        // Extract function signature
        const funcMatch = context.match(/(?:async\s+)?(?:function\s+)?(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?/) ||
                         context.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)(?:\s*:\s*[^=]+)?\s*=>/)
        return funcMatch ? funcMatch[0].replace(/\s*[{=].*$/, '').trim() : null
        
      case 'interface':
        // Show interface declaration
        const interfaceMatch = context.match(/interface\s+\w+(?:\s+extends\s+[\w,\s]+)?/)
        return interfaceMatch ? interfaceMatch[0] : null
        
      case 'type':
        // Show type alias
        return context.split('=')[0].trim() + ' = ...'
        
      case 'enum':
        // Show enum name
        const enumMatch = context.match(/enum\s+\w+/)
        return enumMatch ? enumMatch[0] : null
        
      case 'variable':
      case 'constant':
        // Show variable declaration with type if available
        const varMatch = context.match(/(?:const|let|var)\s+(\w+)(?:\s*:\s*[^=]+)?/)
        if (varMatch) {
          // Try to show the value if it's simple
          const valueMatch = context.match(/=\s*(['"`])[^'"`]+\1|=\s*\d+|=\s*true|=\s*false/)
          return varMatch[0] + (valueMatch ? ' ' + valueMatch[0] : '')
        }
        return null
        
      default:
        return null
    }
  }
  
  private getTopUsage(results: SearchResult[]): string[] {
    const usage: string[] = []
    
    // Group by file
    const byFile = new Map<string, SearchResult[]>()
    results.forEach(r => {
      const file = r.info.location.file
      if (!byFile.has(file)) byFile.set(file, [])
      byFile.get(file)!.push(r)
    })
    
    // Sort files by occurrence count
    const topFiles = Array.from(byFile.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
    
    for (const [file, fileResults] of topFiles) {
      const shortPath = file.split('/').slice(-2).join('/')
      usage.push(`   • ${shortPath}:`)
      
      // Show up to 3 specific usages with context
      fileResults.slice(0, this.options.maxUsageExamples).forEach(r => {
        const context = r.info.context.trim()
        // Clean up the context to show just the relevant part
        const cleanContext = context.length > 60 
          ? context.substring(0, 60) + '...'
          : context
        usage.push(`     - Line ${r.info.location.line}: ${cleanContext}`)
      })
      
      if (fileResults.length > this.options.maxUsageExamples!) {
        usage.push(`     - ... and ${fileResults.length - this.options.maxUsageExamples!} more`)
      }
    }
    
    return usage
  }
  
  private getBreakingChanges(results: SearchResult[]): string[] {
    const changes: string[] = []
    
    // Look for results with high usage counts
    const highUsage = results
      .filter(r => r.usageCount && r.usageCount > 0)
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    
    // Track unique changes to avoid duplicates
    const uniqueChanges = new Map<string, string>()
    
    highUsage.forEach(result => {
      if (result.sampleUsages && result.sampleUsages.length > 0) {
        result.sampleUsages.forEach(usage => {
          const fromFile = usage.fromLocation.file.split('/').slice(-2).join('/')
          const context = usage.context.trim()
          const changeKey = `${fromFile}:${usage.fromLocation.line}`
          
          if (!uniqueChanges.has(changeKey) && uniqueChanges.size < this.options.maxBreakingChanges!) {
            uniqueChanges.set(changeKey, `   • ${fromFile}:${usage.fromLocation.line} - ${context}`)
          }
        })
      }
    })
    
    // Add the unique changes
    changes.push(...Array.from(uniqueChanges.values()))
    
    // Add count of additional impacts
    const totalImpacted = results.filter(r => r.usageCount && r.usageCount > 0).length
    if (totalImpacted > this.options.maxBreakingChanges!) {
      changes.push(`   [... and ${totalImpacted - this.options.maxBreakingChanges!} more affected locations]`)
    }
    
    return changes
  }
  
  private detectPatterns(results: SearchResult[]): string[] {
    const patterns: string[] = []
    
    // Collect all related terms
    const relatedTerms = new Map<string, number>()
    results.forEach(r => {
      if (r.info.relatedTerms) {
        r.info.relatedTerms.forEach(term => {
          if (term.length > 3 && !this.isCommonTerm(term)) {
            relatedTerms.set(term, (relatedTerms.get(term) || 0) + 1)
          }
        })
      }
    })
    
    // Top related terms
    const topRelated = Array.from(relatedTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term)
    
    if (topRelated.length > 0) {
      patterns.push(`   • Used with: ${topRelated.join(', ')}`)
    }
    
    // Detect async pattern
    const asyncCount = results.filter(r => 
      r.info.context.includes('async') || r.info.context.includes('await')
    ).length
    if (asyncCount > results.length / 2) {
      patterns.push('   • Always async/await calls')
    }
    
    // Detect error handling
    const errors = new Set<string>()
    results.forEach(r => {
      const errorMatch = r.info.context.match(/throw\s+new\s+(\w+Error)/)
      if (errorMatch) errors.add(errorMatch[1])
    })
    if (errors.size > 0) {
      patterns.push(`   • Throws: ${Array.from(errors).join(', ')}`)
    }
    
    // Test coverage
    const testFiles = results.filter(r => 
      r.info.location.file.includes('.test.') || 
      r.info.location.file.includes('.spec.')
    ).length
    if (testFiles > 0) {
      patterns.push(`   • Test coverage: ✅ ${testFiles} test files`)
    }
    
    return patterns
  }
  
  private generateNextSuggestions(query: string, results: SearchResult[]): string[] {
    const suggestions: string[] = []
    
    // If it's a high-usage item, suggest refs
    const hasHighUsage = results.some(r => r.usageCount && r.usageCount > 5)
    if (hasHighUsage) {
      suggestions.push(`smartgrep refs "${query}"`)
    }
    
    // If mostly one type, suggest filtering by another type
    const types = [...new Set(results.map(r => r.info.type))]
    if (types.length > 2) {
      const nonPrimaryType = types.find(t => t !== results[0].info.type)
      if (nonPrimaryType) {
        suggestions.push(`smartgrep "${query}" --type ${nonPrimaryType}`)
      }
    }
    
    // Suggest a meaningful related term
    const relatedTerms = this.getMeaningfulRelatedTerms(results, query)
    if (relatedTerms.length > 0) {
      suggestions.push(`smartgrep "${relatedTerms[0]}"`)
    }
    
    return suggestions.slice(0, 3)
  }
  
  private getMeaningfulRelatedTerms(results: SearchResult[], query: string): string[] {
    const termCounts = new Map<string, number>()
    
    results.forEach(r => {
      if (r.info.relatedTerms) {
        r.info.relatedTerms.forEach(term => {
          if (term.length > 3 && 
              !this.isCommonTerm(term) && 
              term.toLowerCase() !== query.toLowerCase() &&
              !term.toLowerCase().includes(query.toLowerCase())) {
            termCounts.set(term, (termCounts.get(term) || 0) + 1)
          }
        })
      }
    })
    
    return Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([term]) => term)
  }
  
  private isCommonTerm(term: string): boolean {
    const common = ['export', 'import', 'from', 'const', 'let', 'var', 'this', 
                   'await', 'return', 'async', 'function', 'class', 'new', 'true', 
                   'false', 'null', 'undefined', 'string', 'number', 'boolean']
    return common.includes(term.toLowerCase())
  }
  
  private countUniqueFiles(results: SearchResult[]): number {
    return new Set(results.map(r => r.info.location.file)).size
  }
  
  private generateNoResultsSummary(query: string): string {
    return `
═══════════════════════════════════════════════════════════════════════
🔍 SMARTGREP: "${query}" (0 results)

❌ No matches found

💡 TRY:
   • smartgrep "${query.substring(0, Math.ceil(query.length / 2))}" - shorter term
   • smartgrep "/${query}.*/" --regex - flexible pattern  
   • smartgrep group <name> - if concept group exists
   • smartgrep "${query}" --full - show any partial matches

For available concept groups: smartgrep group list
═══════════════════════════════════════════════════════════════════════`
  }
}