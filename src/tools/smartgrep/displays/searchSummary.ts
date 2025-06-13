/**
 * Search Summary Generator
 * Creates informative, actionable summaries at the end of search results
 */

import type {
  SearchResult,
  SemanticInfo,
} from '@codebase-curator/semantic-core'

export interface SearchContext {
  query: string
  results: SearchResult[]
  searchMode?: 'fuzzy' | 'exact' | 'regex'
  filters?: {
    type?: Partial<SemanticInfo['type'][]>
    file?: string[]
  }
  fallbackUsed?: 'split' | 'group' | 'variations'
}

export interface SearchSummary {
  primaryAnswer: string
  topLocations: LocationInfo[]
  impactAnalysis: ImpactInfo
  ecosystem: EcosystemInfo
  suggestions: Suggestion[]
}

interface LocationInfo {
  file: string
  line: number
  description: string
  occurrences: number
}

interface ImpactInfo {
  totalOccurrences: number
  filesAffected: number
  breakageRisk: string[]
}

interface EcosystemInfo {
  commonPatterns: string[]
  relatedTerms: string[]
  throwsErrors?: string[]
}

interface Suggestion {
  command: string
  reason: string
}

export class SearchSummaryGenerator {
  generateSummary(context: SearchContext): string {
    const { query, results } = context

    if (results.length === 0) {
      return this.generateNoResultsSummary(context)
    }

    const summary = this.analyzeResults(context)
    return this.formatSummary(summary, context)
  }

  private analyzeResults(context: SearchContext): SearchSummary {
    const { query, results } = context

    // Find primary definition (highest relevance + right type)
    const primaryResult = this.findPrimaryDefinition(results)

    // Get top locations by occurrence
    const topLocations = this.getTopLocations(results)

    // Analyze impact
    const impactAnalysis = this.analyzeImpact(results)

    // Find ecosystem patterns
    const ecosystem = this.findEcosystem(results)

    // Generate smart suggestions
    const suggestions = this.generateSuggestions(context, {
      primaryResult,
      topLocations,
      impactAnalysis,
      ecosystem,
    })

    return {
      primaryAnswer: this.createPrimaryAnswer(query, primaryResult),
      topLocations,
      impactAnalysis,
      ecosystem,
      suggestions,
    }
  }

  private findPrimaryDefinition(
    results: SearchResult[]
  ): SearchResult | undefined {
    // Prioritize: class/function definitions > high relevance > high usage
    const definitions = results.filter(
      (r) =>
        r.info.type === 'class' ||
        r.info.type === 'function' ||
        r.info.type === 'interface'
    )

    if (definitions.length > 0) {
      // Sort by relevance and usage
      return definitions.sort((a, b) => {
        const scoreA = a.relevanceScore * (1 + (a.usageCount || 0) / 10)
        const scoreB = b.relevanceScore * (1 + (b.usageCount || 0) / 10)
        return scoreB - scoreA
      })[0]
    }

    // Fall back to highest relevance
    return results[0]
  }

  private getTopLocations(results: SearchResult[]): LocationInfo[] {
    // Group by file
    const fileGroups = new Map<string, SearchResult[]>()

    results.forEach((result) => {
      const file = result.info.location.file
      if (!fileGroups.has(file)) {
        fileGroups.set(file, [])
      }
      fileGroups.get(file)!.push(result)
    })

    // Sort by occurrence count and create top 3
    const sorted = Array.from(fileGroups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)

    return sorted.map(([file, fileResults]) => {
      // Determine what this file is doing
      const types = [...new Set(fileResults.map((r) => r.info.type))]
      const description = this.describeFileRole(file, types, fileResults)

      return {
        file,
        line: fileResults[0].info.location.line,
        description,
        occurrences: fileResults.length,
      }
    })
  }

  private describeFileRole(
    file: string,
    types: string[],
    results: SearchResult[]
  ): string {
    const filename = file.split('/').pop() || file

    // Check for common patterns
    if (filename.includes('.test.') || filename.includes('.spec.')) {
      return 'test coverage'
    }
    if (filename.includes('.service.')) {
      return 'service implementation'
    }
    if (filename.includes('.controller.')) {
      return 'API endpoints'
    }
    if (
      types.includes('class') &&
      results.some((r) => r.relevanceScore > 0.9)
    ) {
      return 'main implementation'
    }
    if (types.includes('import')) {
      return 'imported and used'
    }
    if (results.length > 5) {
      return 'heavy usage'
    }

    return 'used here'
  }

  private analyzeImpact(results: SearchResult[]): ImpactInfo {
    const uniqueFiles = new Set(results.map((r) => r.info.location.file))

    // Find what would break - look for function calls and imports
    const breakageRisk: string[] = []
    const callSites = results.filter((r) => r.usageCount && r.usageCount > 5)

    callSites.forEach((site) => {
      if (site.info.type === 'function' || site.info.type === 'class') {
        breakageRisk.push(`${site.info.term} (${site.usageCount} calls)`)
      }
    })

    return {
      totalOccurrences: results.length,
      filesAffected: uniqueFiles.size,
      breakageRisk: breakageRisk.slice(0, 5),
    }
  }

  private findEcosystem(results: SearchResult[]): EcosystemInfo {
    const relatedTerms = new Set<string>()
    const patterns: string[] = []
    const errors = new Set<string>()

    results.forEach((result) => {
      // Collect related terms
      if (result.info.relatedTerms) {
        result.info.relatedTerms.forEach((term) => {
          if (term.length > 2) relatedTerms.add(term)
        })
      }

      // Look for error patterns
      const context = result.info.context
      const errorMatch = context.match(/throw\s+new\s+(\w+Error)/)
      if (errorMatch) {
        errors.add(errorMatch[1])
      }

      // Detect common patterns
      if (result.info.type === 'function') {
        const isAsync = context.includes('async') || context.includes('await')
        const returnsPromise = context.includes('Promise<')
        if (isAsync || returnsPromise) {
          patterns.push('async/await pattern')
        }
      }
    })

    // Find most common usage pattern
    const functionCalls = results.filter(
      (r) => r.info.context.includes('(') && r.info.context.includes(')')
    )

    if (functionCalls.length > results.length / 2) {
      // Extract common call pattern
      const callPatterns = functionCalls
        .map((r) => {
          const match = r.info.context.match(/(\w+)\s*\(/)
          return match ? match[1] : null
        })
        .filter(Boolean)

      const mostCommon = this.getMostFrequent(callPatterns)
      if (mostCommon) {
        patterns.push(
          `${mostCommon}() → returns ${this.guessReturnType(results)}`
        )
      }
    }

    return {
      commonPatterns: [...new Set(patterns)].slice(0, 3),
      relatedTerms: Array.from(relatedTerms).slice(0, 5),
      throwsErrors: Array.from(errors),
    }
  }

  private getMostFrequent(items: (string | null)[]): string | null {
    const counts = new Map<string, number>()
    items.forEach((item) => {
      if (item) {
        counts.set(item, (counts.get(item) || 0) + 1)
      }
    })

    let maxCount = 0
    let mostFrequent = null
    counts.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count
        mostFrequent = item
      }
    })

    return mostFrequent
  }

  private guessReturnType(results: SearchResult[]): string {
    // Look for return statements or Promise types
    for (const result of results) {
      const context = result.info.context

      // Check for Promise<Type>
      const promiseMatch = context.match(/Promise<(\w+)>/)
      if (promiseMatch) return `Promise<${promiseMatch[1]}>`

      // Check for return statements
      const returnMatch = context.match(/return\s+(\w+)/)
      if (returnMatch && returnMatch[1] !== 'new') {
        return returnMatch[1]
      }
    }

    return 'unknown'
  }

  private createPrimaryAnswer(query: string, primary?: SearchResult): string {
    if (!primary) {
      return `"${query}" not found in codebase`
    }

    const { type, location, term } = primary.info
    const typeName = type.toUpperCase()

    return `"${term}" is a ${typeName} in ${location.file}:${location.line}`
  }

  private generateSuggestions(
    context: SearchContext,
    analysis: {
      primaryResult?: SearchResult
      topLocations: LocationInfo[]
      impactAnalysis: ImpactInfo
      ecosystem: EcosystemInfo
    }
  ): Suggestion[] {
    const { query, results, filters } = context
    const suggestions: Suggestion[] = []

    // Always suggest jumping to main definition
    if (analysis.primaryResult) {
      const loc = analysis.primaryResult.info.location
      suggestions.push({
        command: `See the ${analysis.primaryResult.info.type}: ${loc.file}:${loc.line}`,
        reason: 'Jump to definition',
      })
    }

    // If it's a commonly used function/class, suggest refs
    if (analysis.impactAnalysis.breakageRisk.length > 0) {
      suggestions.push({
        command: `smartgrep refs "${query}"`,
        reason: 'See all usage locations',
      })
    }

    // If there are related terms, suggest exploring them (but filter out common terms)
    const commonTerms = [
      'export',
      'import',
      'from',
      'const',
      'let',
      'var',
      'this',
      'await',
      'return',
    ]
    const meaningfulRelated = analysis.ecosystem.relatedTerms.filter(
      (term) =>
        !commonTerms.includes(term.toLowerCase()) &&
        term.length > 3 &&
        term.toLowerCase() !== query.toLowerCase() && // Don't suggest the same term
        !term.toLowerCase().includes(query.toLowerCase()) // Don't suggest variations of the same term
    )

    if (meaningfulRelated.length > 0) {
      const topRelated = meaningfulRelated[0]
      suggestions.push({
        command: `smartgrep "${topRelated}"`,
        reason: `Frequently appears with ${query}`,
      })
    }

    // If results are mixed types, suggest filtering
    const types = [...new Set(results.map((r) => r.info.type))]
    if (types.length > 3 && !filters?.type) {
      const mainType = this.getMostFrequent(results.map((r) => r.info.type))
      suggestions.push({
        command: `smartgrep "${query}" --type ${mainType}`,
        reason: 'Filter to most common type',
      })
    }

    // If many results, suggest limiting
    if (results.length > 50) {
      suggestions.push({
        command: `smartgrep "${query}" --max 20`,
        reason: 'Too many results to scan',
      })

      // Add more specific suggestions for common scenarios
      if (query.length <= 3) {
        suggestions.push({
          command: `smartgrep "${query}Service" --type class`,
          reason: 'Search for service classes',
        })
      }
    }

    return suggestions.slice(0, 4) // Limit suggestions
  }

  private formatSummary(
    summary: SearchSummary,
    context: SearchContext
  ): string {
    const { query } = context
    let output = '\n'
    output += '═'.repeat(70) + '\n'
    output += `🎯 THE ANSWER YOU'RE LOOKING FOR:\n\n`
    output += `${summary.primaryAnswer}\n\n`

    // Top locations
    if (summary.topLocations.length > 0) {
      output += `🔥 THE ${Math.min(
        3,
        summary.topLocations.length
      )} PLACES THAT MATTER MOST:\n`
      summary.topLocations.forEach((loc, i) => {
        const count = loc.occurrences > 1 ? ` (${loc.occurrences} times)` : ''
        output += `   ${i + 1}. ${loc.file}:${
          loc.line
        } → ${loc.description.toUpperCase()}${count}\n`
      })
      output += '\n'
    }

    // Impact analysis
    if (summary.impactAnalysis.breakageRisk.length > 0) {
      output += `⚡ IF YOU CHANGE IT, THESE BREAK:\n`
      summary.impactAnalysis.breakageRisk.forEach((risk) => {
        output += `   • ${risk}\n`
      })
      if (
        summary.impactAnalysis.totalOccurrences >
        summary.impactAnalysis.breakageRisk.length
      ) {
        const more =
          summary.impactAnalysis.totalOccurrences -
          summary.impactAnalysis.breakageRisk.length
        output += `   [${more} more places...]\n`
      }
      output += '\n'
    }

    // Ecosystem
    if (
      summary.ecosystem.relatedTerms.length > 0 ||
      summary.ecosystem.commonPatterns.length > 0
    ) {
      output += `🎪 THE CIRCUS AROUND IT:\n`
      if (summary.ecosystem.relatedTerms.length > 0) {
        output += `   Always appears with: ${summary.ecosystem.relatedTerms.join(
          ', '
        )}\n`
      }
      if (
        summary.ecosystem.throwsErrors &&
        summary.ecosystem.throwsErrors.length > 0
      ) {
        output += `   Throws: ${summary.ecosystem.throwsErrors.join(', ')}\n`
      }
      if (summary.ecosystem.commonPatterns.length > 0) {
        output += `   Pattern: ${summary.ecosystem.commonPatterns[0]}\n`
      }
      output += '\n'
    }

    // Quick jumps
    if (summary.suggestions.length > 0) {
      output += `📍 QUICK JUMPS:\n`
      summary.suggestions.forEach((suggestion) => {
        output += `   ${suggestion.command}\n`
      })
      output += '\n'
    }

    output += '═'.repeat(70) + '\n'

    return output
  }

  private generateNoResultsSummary(context: SearchContext): string {
    const { query, fallbackUsed } = context
    let output = '\n'
    output += '═'.repeat(70) + '\n'
    output += `🤔 NOT WHAT YOU EXPECTED?\n\n`

    if (fallbackUsed) {
      output += `   We searched: "${query}"\n`
      output += `   ✓ Tried: exact match, case variations\n`
      if (fallbackUsed === 'split') {
        output += `   ✓ Split into parts and searched\n`
      }
      if (fallbackUsed === 'variations') {
        output += `   ✓ Expanded to common variations\n`
      }
      output += '\n'
    }

    output += `   Still not right? Try:\n`
    output += this.generateNoResultSuggestions(context)

    output += '═'.repeat(70) + '\n'
    return output
  }

  private generateNoResultSuggestions(context: SearchContext): string {
    const { query } = context
    let suggestions = ''

    // Suggest simpler searches
    if (query.length > 8) {
      const simplified = query.substring(0, Math.floor(query.length / 2))
      suggestions += `   → smartgrep "${simplified}"  (simpler term)\n`
    }

    // Suggest different patterns
    suggestions += `   → smartgrep "/${query}.*/" --regex  (flexible pattern)\n`
    suggestions += `   → smartgrep "${query}" --type function  (filter by type)\n`

    // Suggest exploring related concepts
    const possibleGroup = query.toLowerCase().replace(/[^a-z]/g, '')
    suggestions += `   → smartgrep group ${possibleGroup}  (if concept group exists)\n`

    // Language-specific suggestions
    suggestions += `   → smartgrep "def ${query}"  (Python function)\n`
    suggestions += `   → smartgrep "func ${query}"  (Go function)\n`

    return suggestions
  }
}

// Helper function for "too many results" scenario
export function generateTooManyResultsSummary(context: SearchContext): string {
  const { query, results } = context

  return `
═══════════════════════════════════════════════════════════════
🤔 TOO MANY RESULTS? (${results.length} matches for "${query}")

   Filter by what you need:
   → smartgrep "${query}" --type function
   → smartgrep "${query}" --file "*.service.*"  
   → smartgrep "${query}" --max 20
   → smartgrep "${query.charAt(0).toUpperCase() + query.slice(1)}" --exact
   
   Or be more specific:
   → smartgrep "${query}Service"
   → smartgrep "${query}.create"
   → smartgrep "class ${query}"
═══════════════════════════════════════════════════════════════
`
}
