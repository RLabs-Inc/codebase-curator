/**
 * Claude-optimized display functions for smartgrep
 *
 * This module provides enhanced output formatting that exposes ALL available
 * semantic data for optimal Claude consumption. Every piece of information
 * in the semantic index is displayed to help Claude understand code better.
 */

import type {
  SearchResult,
  CrossReference,
  SemanticInfo,
} from '@codebase-curator/semantic-core'
import { SearchSummaryGenerator, type SearchContext } from './searchSummary.js'

export interface DisplayOptions {
  showContext?: boolean
  humanMode?: boolean // Simplified output for humans
  maxResults?: number
  showFullPaths?: boolean
  showAllReferences?: boolean
  showRelevanceScores?: boolean
  showLanguageInfo?: boolean
  showMetadata?: boolean
  searchMode?: 'fuzzy' | 'exact' | 'regex'
  typeFilter?: Partial<SemanticInfo['type'][]> // Filter by specific types
  fileFilter?: string[]
  fallbackUsed?: 'split' | 'group' | 'variations'
}

const DEFAULT_OPTIONS: DisplayOptions = {
  showContext: true,
  humanMode: false,
  maxResults: 100, // More results for Claude
  showFullPaths: true,
  showAllReferences: true,
  showRelevanceScores: true,
  showLanguageInfo: true,
  showMetadata: true,
}

/**
 * Enhanced display for Claude - shows EVERYTHING
 */
export function displayResultsForClaude(
  query: string,
  results: SearchResult[],
  conceptGroup?: string[],
  options: DisplayOptions = DEFAULT_OPTIONS
) {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (results.length === 0) {
    console.log(`\n❌ No results found for "${query}"`)

    // Still generate summary for no results case
    const summaryGenerator = new SearchSummaryGenerator()
    const context: SearchContext = {
      query,
      results,
      searchMode: opts.searchMode,
      filters: {
        type: opts.typeFilter,
        file: opts.fileFilter,
      },
      fallbackUsed: opts.fallbackUsed,
    }

    const summary = summaryGenerator.generateSummary(context)
    console.log(summary)
    return
  }

  // Header with full query context
  console.log('\n' + '='.repeat(80))
  console.log(`🔍 SEMANTIC SEARCH RESULTS (Claude-Optimized Output)`)
  console.log(`📝 Query: "${query}"`)
  if (conceptGroup) {
    console.log(`📚 Concept Group: ${conceptGroup.join(', ')}`)
  }
  console.log(`📊 Total Results: ${results.length}`)
  console.log(`🕐 Timestamp: ${new Date().toISOString()}`)
  console.log('='.repeat(80) + '\n')

  // Group by type for organized display
  const grouped = groupResultsByType(results)

  // Display each type group with full information
  for (const [type, items] of Object.entries(grouped)) {
    displayTypeGroup(type, items, opts)
  }

  // Summary statistics for Claude
  displaySummaryStatistics(results, opts)

  // Relationship graph if requested
  if (opts.showAllReferences) {
    displayRelationshipGraph(results)
  }

  // NEW: Action-oriented summary at the end
  const summaryGenerator = new SearchSummaryGenerator()
  const context: SearchContext = {
    query,
    results,
    searchMode: opts.searchMode,
    filters: {
      type: opts.typeFilter,
      file: opts.fileFilter,
    },
    fallbackUsed: opts.fallbackUsed,
  }

  // Generate and display the summary
  const summary = summaryGenerator.generateSummary(context)
  console.log(summary)
}

function displayTypeGroup(
  type: string,
  items: SearchResult[],
  opts: DisplayOptions
) {
  const icon = getEnhancedTypeIcon(type)
  const typeDescription = getTypeDescription(type)

  console.log(
    `\n${icon} ${type.toUpperCase()} (${
      items.length
    } items) - ${typeDescription}`
  )
  console.log('─'.repeat(70))

  items
    .slice(0, opts.humanMode ? 10 : opts.maxResults)
    .forEach((result, index) => {
      displaySingleResult(result, index + 1, opts)
    })

  if (items.length > (opts.humanMode ? 10 : opts.maxResults!)) {
    console.log(
      `\n└── 📋 ... and ${
        items.length - (opts.humanMode ? 10 : opts.maxResults!)
      } more ${type} items`
    )
  }
}

function displaySingleResult(
  result: SearchResult,
  index: number,
  opts: DisplayOptions
) {
  const info = result.info

  // Main item header with ALL location info
  console.log(`\n${index}. 🎯 ${info.term}`)

  // Full location information
  console.log(
    `   📍 Location: ${
      opts.showFullPaths ? info.location.file : getShortPath(info.location.file)
    }`
  )
  console.log(
    `   📏 Position: Line ${info.location.line}, Column ${info.location.column}`
  )

  // Language and relevance info
  if (opts.showLanguageInfo) {
    console.log(`   🔤 Language: ${info.language}`)
  }
  if (opts.showRelevanceScores) {
    console.log(
      `   📈 Relevance Score: ${(result.relevanceScore * 100).toFixed(1)}%`
    )
  }
  if (result.usageCount !== undefined) {
    console.log(`   🔢 Usage Count: ${result.usageCount} references`)
  }

  // Full code context
  if (opts.showContext) {
    displayFullContext(info, opts)
  }

  // Related terms (ALL of them for Claude)
  if (info.relatedTerms && info.relatedTerms.length > 0) {
    console.log(
      `   🔗 Related Terms: ${
        opts.humanMode
          ? info.relatedTerms.slice(0, 5).join(', ')
          : info.relatedTerms.join(', ')
      }`
    )
  }

  // Metadata (if available)
  if (
    opts.showMetadata &&
    info.metadata &&
    Object.keys(info.metadata).length > 0
  ) {
    console.log(`   📊 Metadata:`)
    Object.entries(info.metadata).forEach(([key, value]) => {
      console.log(`      • ${key}: ${JSON.stringify(value)}`)
    })
  }

  // Full references (not just samples)
  if (opts.showAllReferences && (result.sampleUsages || info.references)) {
    displayAllReferences(result, opts)
  }
}

function displayFullContext(info: SemanticInfo, opts: DisplayOptions) {
  console.log(`   📄 Code Context:`)

  // Show the main line
  console.log(`      ${info.location.line}: ${info.context.trim()}`)

  // Show ALL surrounding lines for better context
  if (info.surroundingLines && info.surroundingLines.length > 0) {
    console.log(`   📐 Surrounding Code:`)
    info.surroundingLines.forEach((line, idx) => {
      const lineNum =
        info.location.line - Math.floor(info.surroundingLines.length / 2) + idx
      console.log(`      ${lineNum}: ${line}`)
    })
  }

  // For functions/classes, try to extract signature
  if (info.type === 'function' || info.type === 'class') {
    const signature = extractSignature(info)
    if (signature) {
      console.log(`   🔧 Signature: ${signature}`)
    }
  }
}

function displayAllReferences(result: SearchResult, opts: DisplayOptions) {
  const allRefs = result.info.references || result.sampleUsages || []
  const totalRefs = result.usageCount || allRefs.length

  if (totalRefs === 0) return

  console.log(`   📍 All References (${totalRefs} total):`)

  // Group references by type
  const refsByType = groupReferencesByType(allRefs)

  Object.entries(refsByType).forEach(([refType, refs]) => {
    console.log(
      `      ${getReferenceIcon(refType)} ${refType} (${refs.length}):`
    )

    const displayRefs = opts.humanMode ? refs.slice(0, 3) : refs
    displayRefs.forEach((ref, idx) => {
      const path = opts.showFullPaths
        ? ref.fromLocation.file
        : getShortPath(ref.fromLocation.file)
      console.log(`         ${idx + 1}. ${path}:${ref.fromLocation.line}`)
      console.log(`            ${ref.context.trim()}`)
    })

    if (opts.humanMode && refs.length > 3) {
      console.log(
        `         ... and ${refs.length - 3} more ${refType} references`
      )
    }
  })
}

function displaySummaryStatistics(
  results: SearchResult[],
  opts: DisplayOptions
) {
  console.log('\n' + '='.repeat(80))
  console.log('📊 SUMMARY STATISTICS')
  console.log('─'.repeat(70))

  // Type distribution
  const typeStats = results.reduce((acc, r) => {
    acc[r.info.type] = (acc[r.info.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('📈 Type Distribution:')
  Object.entries(typeStats).forEach(([type, count]) => {
    console.log(
      `   • ${type}: ${count} (${((count / results.length) * 100).toFixed(1)}%)`
    )
  })

  // File distribution
  const fileStats = results.reduce((acc, r) => {
    acc[r.info.location.file] = (acc[r.info.location.file] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\n📁 File Distribution:')
  Object.entries(fileStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, opts.humanMode ? 5 : 10)
    .forEach(([file, count]) => {
      const path = opts.showFullPaths ? file : getShortPath(file)
      console.log(`   • ${path}: ${count} matches`)
    })

  // Usage statistics
  const withUsage = results.filter((r) => r.usageCount !== undefined)
  if (withUsage.length > 0) {
    const avgUsage =
      withUsage.reduce((sum, r) => sum + r.usageCount!, 0) / withUsage.length
    const maxUsage = Math.max(...withUsage.map((r) => r.usageCount!))

    console.log('\n🔢 Usage Statistics:')
    console.log(`   • Average usage count: ${avgUsage.toFixed(1)}`)
    console.log(`   • Maximum usage count: ${maxUsage}`)
    console.log(
      `   • Items with usage data: ${withUsage.length}/${results.length}`
    )
  }
}

function displayRelationshipGraph(results: SearchResult[]) {
  console.log('\n' + '='.repeat(80))
  console.log('🕸️ RELATIONSHIP GRAPH')
  console.log('─'.repeat(70))

  // Build a graph of relationships
  const graph = new Map<string, Set<string>>()

  results.forEach((result) => {
    const from = result.info.term

    // Add related terms
    if (result.info.relatedTerms) {
      result.info.relatedTerms.forEach((related) => {
        if (!graph.has(from)) graph.set(from, new Set())
        graph.get(from)!.add(related)
      })
    }

    // Add reference targets
    if (result.info.references) {
      result.info.references.forEach((ref) => {
        if (!graph.has(from)) graph.set(from, new Set())
        graph.get(from)!.add(ref.targetTerm)
      })
    }
  })

  // Display the graph
  console.log('🔗 Term Relationships:')
  Array.from(graph.entries())
    .slice(0, 20) // Limit to prevent overwhelming output
    .forEach(([term, connections]) => {
      if (connections.size > 0) {
        console.log(`   ${term} → {${Array.from(connections).join(', ')}}`)
      }
    })

  if (graph.size > 20) {
    console.log(`   ... and ${graph.size - 20} more relationships`)
  }
}

// Helper functions

function getEnhancedTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    function: '🔧',
    class: '🏛️',
    variable: '📦',
    constant: '🔒',
    string: '💬',
    comment: '💭',
    import: '📥',
    file: '📂',
    interface: '📋',
    type: '🏷️',
    enum: '🎲',
    module: '📦',
  }
  return icons[type] || '📄'
}

function getTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    function: 'Executable code blocks',
    class: 'Object blueprints and constructors',
    variable: 'Mutable data storage',
    constant: 'Immutable values',
    string: 'Text literals and messages',
    comment: 'Documentation and notes',
    import: 'Module dependencies',
    file: 'File-level matches',
    interface: 'Type contracts',
    type: 'Type definitions',
    enum: 'Enumerated values',
    module: 'Module declarations',
  }
  return descriptions[type] || 'Code elements'
}

function getReferenceIcon(refType: string): string {
  const icons: Record<string, string> = {
    call: '📞',
    import: '📥',
    extends: '🔄',
    implements: '🔧',
    instantiation: '🏗️',
    'type-reference': '🏷️',
  }
  return icons[refType] || '🔗'
}

function extractSignature(info: SemanticInfo): string | null {
  // Try to extract function/class signature from context
  const context = info.context.trim()

  // For functions, look for parameter list
  if (info.type === 'function') {
    const match =
      context.match(/function\s+\w+\s*\((.*?)\)(?:\s*:\s*(.+?))?(?:\s*{|$)/) ||
      context.match(
        /(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\((.*?)\)(?:\s*:\s*(.+?))?\s*=>/
      ) ||
      context.match(/\w+\s*\((.*?)\)(?:\s*:\s*(.+?))?\s*{/)

    if (match) {
      const params = match[1].trim()
      const returnType = match[2]?.trim()
      return `(${params})${returnType ? ` → ${returnType}` : ''}`
    }
  }

  // For classes, look for extends/implements
  if (info.type === 'class') {
    const match = context.match(
      /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(.+?))?(?:\s*{|$)/
    )
    if (match) {
      const [, className, extendsClass, implementsInterfaces] = match
      let sig = className
      if (extendsClass) sig += ` extends ${extendsClass}`
      if (implementsInterfaces) sig += ` implements ${implementsInterfaces}`
      return sig
    }
  }

  return null
}

function groupResultsByType(
  results: SearchResult[]
): Record<string, SearchResult[]> {
  return results.reduce((acc, result) => {
    const type = result.info.type
    if (!acc[type]) acc[type] = []
    acc[type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)
}

function groupReferencesByType(
  refs: CrossReference[]
): Record<string, CrossReference[]> {
  return refs.reduce((acc, ref) => {
    const type = ref.referenceType
    if (!acc[type]) acc[type] = []
    acc[type].push(ref)
    return acc
  }, {} as Record<string, CrossReference[]>)
}

function getShortPath(fullPath: string): string {
  return fullPath.split('/').slice(-2).join('/')
}

// Export for use in main CLI
export function displayResultsBodyClaude(
  results: SearchResult[],
  options: DisplayOptions = {}
) {
  const grouped = groupResultsByType(results)

  for (const [type, items] of Object.entries(grouped)) {
    displayTypeGroup(type, items, { ...DEFAULT_OPTIONS, ...options })
  }
}
