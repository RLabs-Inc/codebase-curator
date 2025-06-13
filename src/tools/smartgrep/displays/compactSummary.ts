/**
 * Compact Summary Generator for Claude-First Output
 *
 * Creates concise, actionable summaries that preserve context
 * while providing maximum information density for Claudes
 */

import type {
  SearchResult,
  CrossReference,
  SemanticInfo,
  CodebaseStory,
} from '@codebase-curator/semantic-core'
import chalk from 'chalk'

export interface CompactSummaryOptions {
  maxBreakingChanges?: number
  maxUsageExamples?: number
  includePatterns?: boolean
  projectPath?: string // For git status checks
  story?: CodebaseStory // Story context
}

const DEFAULT_OPTIONS: CompactSummaryOptions = {
  maxBreakingChanges: 5,
  maxUsageExamples: 3,
  includePatterns: true,
}

export class CompactSummaryGenerator {
  constructor(private options: CompactSummaryOptions = DEFAULT_OPTIONS) {}

  private calculateMaxWidth(lines: string[]): number {
    // Calculate the maximum width needed for content
    let maxWidth = 0
    lines.forEach((line) => {
      const cleanLine = this.stripAnsi(line.replace(/^[│║┌└├─]/, ''))
      maxWidth = Math.max(maxWidth, cleanLine.length + 4) // +4 for padding and borders
    })
    // Cap at terminal width (typically 80-120 chars)
    return Math.min(Math.max(maxWidth, 60), 100)
  }

  private wrapLine(line: string, maxWidth: number): string[] {
    const cleanLine = this.stripAnsi(line)
    if (cleanLine.length <= maxWidth - 4) return [line]

    // If the line contains no spaces, hard break it
    if (!line.includes(' ')) {
      const wrapped: string[] = []
      let remaining = line
      while (remaining.length > maxWidth - 4) {
        wrapped.push(remaining.substring(0, maxWidth - 4))
        remaining = remaining.substring(maxWidth - 4)
      }
      if (remaining) wrapped.push(remaining)
      return wrapped
    }

    // Split long lines intelligently at word boundaries
    const words = line.split(' ')
    const wrapped: string[] = []
    let current = ''

    for (const word of words) {
      // If a single word is too long, it needs to be on its own line
      if (this.stripAnsi(word).length > maxWidth - 4) {
        if (current) {
          wrapped.push(current)
          current = ''
        }
        // Break the long word
        let remainingWord = word
        while (this.stripAnsi(remainingWord).length > maxWidth - 4) {
          wrapped.push(remainingWord.substring(0, maxWidth - 4))
          remainingWord = remainingWord.substring(maxWidth - 4)
        }
        current = remainingWord
      } else {
        const testLine = current ? `${current} ${word}` : word
        if (this.stripAnsi(testLine).length > maxWidth - 4) {
          if (current) wrapped.push(current)
          current = word
        } else {
          current = testLine
        }
      }
    }
    if (current) wrapped.push(current)

    return wrapped
  }

  private formatBox(
    lines: string[],
    color: typeof chalk.blue,
    width?: number
  ): string[] {
    const output: string[] = []

    // Calculate width if not provided
    const boxWidth = width || this.calculateMaxWidth(lines)

    lines.forEach((line) => {
      // Remove any existing box characters
      const content = line.replace(/^[│║]/, '').trimEnd()

      // Handle wrapped lines
      const wrappedLines = this.wrapLine(content, boxWidth)

      wrappedLines.forEach((wrappedLine, idx) => {
        // Calculate visible length without ANSI codes
        const visibleLength = this.stripAnsi(wrappedLine).length
        const padding = ' '.repeat(Math.max(0, boxWidth - visibleLength))

        // Add continuation indicator for wrapped lines
        const prefix = idx > 0 ? '  ' : ''
        output.push(color('│') + prefix + wrappedLine + padding + color('│'))
      })
    })

    return output
  }

  private stripAnsi(str: string): string {
    // Remove ANSI escape codes for accurate length calculation
    return str.replace(/\x1b\[[0-9;]*m/g, '')
  }

  generate(query: string, results: SearchResult[]): string {
    if (results.length === 0) {
      return this.generateNoResultsSummary(query)
    }

    const output: string[] = []

    // Beautiful header with gradient-like effect
    const uniqueTypes = [...new Set(results.map((r) => r.info.type))]
    const typeBreakdown =
      uniqueTypes.length > 1
        ? ` (${uniqueTypes
            .map(
              (t) =>
                `${this.countByType(results, t)} ${t}${
                  this.countByType(results, t) > 1 ? 's' : ''
                }`
            )
            .join(', ')})`
        : ''

    // Calculate dynamic width for header
    const headerLines = [
      ` 🔍 ${chalk.bold.white('SMARTGREP:')} ${chalk.yellow(`"${query}"`)}`,
      ` 📊 ${chalk.bold(results.length)} results in ${chalk.bold(
        this.countUniqueFiles(results)
      )} files${chalk.dim(typeBreakdown)}`,
    ]
    const headerWidth = this.calculateMaxWidth(headerLines)

    output.push(chalk.cyan('╔' + '═'.repeat(headerWidth - 2) + '╗'))
    headerLines.forEach((line) => {
      const visibleLength = this.stripAnsi(line).length
      const padding = ' '.repeat(Math.max(0, headerWidth - visibleLength - 2))
      output.push(chalk.cyan('║') + line + padding + chalk.cyan('║'))
    })
    output.push(chalk.cyan('╚' + '═'.repeat(headerWidth - 2) + '╝'))
    output.push('')

    // Add story context if available
    if (this.options.story) {
      const storyContext = this.generateStoryContext(query, this.options.story)
      if (storyContext) {
        output.push(storyContext)
        output.push('')
      }
    }

    // Primary definition with signature
    const primary = this.findPrimaryDefinition(results)
    if (primary) {
      const defLines = this.formatDefinition(primary).split('\n')
      const defWidth = this.calculateMaxWidth(defLines)
      const title = '📍 DEFINITION '
      const titlePadding = '─'.repeat(Math.max(0, defWidth - title.length - 2))

      output.push(chalk.blue('┌─ ' + title + titlePadding + '┐'))
      output.push(...this.formatBox(defLines, chalk.blue, defWidth))
      output.push(chalk.blue('└' + '─'.repeat(defWidth) + '┘'))
      output.push('')
    }

    // Top usage with context
    const topUsage = this.getTopUsage(results)
    if (topUsage.length > 0) {
      const usageWidth = this.calculateMaxWidth(topUsage)
      const title = '🔥 TOP USAGE '
      const titlePadding = '─'.repeat(
        Math.max(0, usageWidth - title.length - 2)
      )

      output.push(chalk.green('┌─ ' + title + titlePadding + '┐'))
      output.push(...this.formatBox(topUsage, chalk.green, usageWidth))
      output.push(chalk.green('└' + '─'.repeat(usageWidth) + '┘'))
      output.push('')
    }

    // Breaking changes (detailed)
    const breakingChanges = this.getBreakingChanges(results)
    if (breakingChanges.length > 0) {
      const breakingWidth = this.calculateMaxWidth(breakingChanges)
      const title = '⚡ BREAKING CHANGES '
      const titlePadding = '─'.repeat(
        Math.max(0, breakingWidth - title.length - 3)
      )

      output.push(chalk.red('┌─ ' + title + titlePadding + '┐'))
      output.push(...this.formatBox(breakingChanges, chalk.red, breakingWidth))
      output.push(chalk.red('└' + '─'.repeat(breakingWidth) + '┘'))
      output.push('')
    }

    // Patterns detected
    if (this.options.includePatterns) {
      const patterns = this.detectPatterns(results)
      if (patterns.length > 0) {
        const patternsWidth = this.calculateMaxWidth(patterns)
        const title = '💡 PATTERNS '
        const titlePadding = '─'.repeat(
          Math.max(0, patternsWidth - title.length - 2)
        )

        output.push(chalk.magenta('┌─ ' + title + titlePadding + '┐'))
        output.push(...this.formatBox(patterns, chalk.magenta, patternsWidth))
        output.push(chalk.magenta('└' + '─'.repeat(patternsWidth) + '┘'))
        output.push('')
      }
    }

    // Next suggestions
    const suggestions = this.generateNextSuggestions(query, results)
    const suggestionLines = [
      ' 🎯 ' + chalk.bold('NEXT STEPS:'),
      ...suggestions.map((sugg) => `   ${chalk.green('▸')} ${sugg}`),
      `   ${chalk.green('▸')} smartgrep "${query}" --full  ${chalk.dim(
        `[see all ${results.length} results]`
      )}`,
    ]
    const suggestionsWidth = this.calculateMaxWidth(suggestionLines)

    output.push(chalk.cyanBright('╔' + '═'.repeat(suggestionsWidth - 2) + '╗'))
    suggestionLines.forEach((line) => {
      const visibleLength = this.stripAnsi(line).length
      const padding = ' '.repeat(
        Math.max(0, suggestionsWidth - visibleLength - 2)
      )
      output.push(
        chalk.cyanBright('║') + line + padding + chalk.cyanBright('║')
      )
    })
    output.push(chalk.cyanBright('╚' + '═'.repeat(suggestionsWidth - 2) + '╝'))

    return output.join('\n')
  }

  private findPrimaryDefinition(
    results: SearchResult[]
  ): SearchResult | undefined {
    // Prioritize class/function/interface definitions
    const definitions = results.filter((r) =>
      ['class', 'function', 'interface', 'type', 'enum'].includes(r.info.type)
    )

    if (definitions.length === 0) return results[0]

    // Sort by relevance and type priority
    return definitions.sort((a, b) => {
      const typePriority: Record<string, number> = {
        class: 5,
        interface: 4,
        function: 3,
        type: 2,
        enum: 1,
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
    const langIcon = this.getLanguageIcon(info.language)

    const output: string[] = []
    output.push(
      ` ${langIcon} ${chalk.cyan(location)} ${chalk.dim(`(${typeUpper})`)}`
    )

    // Check if exported
    const isExported = this.checkIfExported(info)
    if (isExported !== null) {
      const exportStatus = isExported
        ? chalk.green('🔓 Exported')
        : chalk.gray('🔒 Internal')
      const usageInfo = result.usageCount
        ? chalk.dim(` • Used in ${result.usageCount} places`)
        : ''
      output.push(` ${exportStatus}${usageInfo}`)
    }

    // Extract signature based on type
    const signature = this.extractSignature(info)
    if (signature) {
      const lines = signature.split('\n')
      lines.forEach((line) => {
        output.push(`   ${chalk.bold(line)}`)
      })
    }

    // Check for TODO/FIXME nearby
    const devMarkers = this.checkForDevMarkers(info)
    if (devMarkers.length > 0) {
      output.push(
        ` ${chalk.yellow('⚠️')}  ${chalk.yellow(
          devMarkers.join(', ') + ' nearby'
        )}`
      )
    }

    return output.join('\n')
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
            if (
              (line.includes('New') || line.includes('new')) &&
              line.includes('(')
            ) {
              return `${classDecl}\n   ${line.trim()}`
            }
          }
        }
        // Just return class declaration if no constructor found
        return classDecl

      case 'function':
        // Extract function signature
        const funcMatch =
          context.match(
            /(?:async\s+)?(?:function\s+)?(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?/
          ) ||
          context.match(
            /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)(?:\s*:\s*[^=]+)?\s*=>/
          )
        return funcMatch ? funcMatch[0].replace(/\s*[{=].*$/, '').trim() : null

      case 'interface':
        // Show interface declaration
        const interfaceMatch = context.match(
          /interface\s+\w+(?:\s+extends\s+[\w,\s]+)?/
        )
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
        const varMatch = context.match(
          /(?:const|let|var)\s+(\w+)(?:\s*:\s*[^=]+)?/
        )
        if (varMatch) {
          // Try to show the value if it's simple
          const valueMatch = context.match(
            /=\s*(['"`])[^'"`]+\1|=\s*\d+|=\s*true|=\s*false/
          )
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
    results.forEach((r) => {
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
      const langIcon = fileResults[0]
        ? this.getLanguageIcon(fileResults[0].info.language)
        : '📁'
      usage.push(` ${langIcon} ${shortPath}:`)

      // Show up to 3 specific usages with context
      fileResults.slice(0, this.options.maxUsageExamples).forEach((r, idx) => {
        const mainLine = r.info.context.trim()
        usage.push(`   ├─ Line ${r.info.location.line}: ${mainLine}`)

        // Add surrounding context if available (this is the game-changer!)
        if (r.info.surroundingLines && r.info.surroundingLines.length > 0) {
          // Find the most relevant surrounding lines
          const relevantLines = this.selectRelevantSurroundingLines(
            r.info.surroundingLines,
            mainLine
          )
          relevantLines.forEach((line, lineIdx) => {
            const isLast =
              lineIdx === relevantLines.length - 1 &&
              idx ===
                Math.min(fileResults.length, this.options.maxUsageExamples!) -
                  1 &&
              fileResults.length <= this.options.maxUsageExamples!
            usage.push(`   │  ${line.trim()}`)
          })
        }

        // Check for dev markers in this usage
        const markers = this.checkForDevMarkers(r.info)
        if (markers.length > 0) {
          usage.push(`   │  ⚠️ ${markers.join(', ')} nearby`)
        }
      })

      if (fileResults.length > this.options.maxUsageExamples!) {
        usage.push(
          `   └─ ... and ${
            fileResults.length - this.options.maxUsageExamples!
          } more`
        )
      }
    }

    return usage
  }

  private getBreakingChanges(results: SearchResult[]): string[] {
    const changes: string[] = []

    // Look for results with high usage counts
    const highUsage = results
      .filter((r) => r.usageCount && r.usageCount > 0)
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))

    // Track unique changes to avoid duplicates
    const uniqueChanges = new Map<string, string>()

    highUsage.forEach((result) => {
      if (result.sampleUsages && result.sampleUsages.length > 0) {
        result.sampleUsages.forEach((usage) => {
          const fromFile = usage.fromLocation.file
            .split('/')
            .slice(-2)
            .join('/')
          const context = usage.context.trim()
          const changeKey = `${fromFile}:${usage.fromLocation.line}`

          if (
            !uniqueChanges.has(changeKey) &&
            uniqueChanges.size < this.options.maxBreakingChanges!
          ) {
            // Get the calling context - what function/class is making this call?
            const callerContext = this.extractCallerContext(usage)
            if (callerContext) {
              uniqueChanges.set(changeKey, `   • ${callerContext} - ${context}`)
            } else {
              uniqueChanges.set(
                changeKey,
                `   • ${fromFile}:${usage.fromLocation.line} - ${context}`
              )
            }
          }
        })
      }
    })

    // Add the unique changes
    Array.from(uniqueChanges.values()).forEach((change, idx) => {
      changes.push(change)
    })

    // Add count of additional impacts
    const totalImpacted = results.filter(
      (r) => r.usageCount && r.usageCount > 0
    ).length
    if (totalImpacted > this.options.maxBreakingChanges!) {
      changes.push(
        `   ⋮ ... and ${
          totalImpacted - this.options.maxBreakingChanges!
        } more affected locations`
      )
    }

    return changes
  }

  private detectPatterns(results: SearchResult[]): string[] {
    const patterns: string[] = []

    // Collect all related terms
    const relatedTerms = new Map<string, number>()
    results.forEach((r) => {
      if (r.info.relatedTerms) {
        r.info.relatedTerms.forEach((term) => {
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
      patterns.push(`   🔗 Used with: ${topRelated.join(', ')}`)
    }

    // File distribution pattern
    const fileCount = this.countUniqueFiles(results)
    const avgUsagePerFile = Math.round(results.length / fileCount)
    if (fileCount > 1) {
      patterns.push(
        `   📊 Distribution: ${fileCount} files, ~${avgUsagePerFile} uses per file`
      )
    }

    // Primary language
    const langCounts = new Map<string, number>()
    results.forEach((r) => {
      langCounts.set(
        r.info.language,
        (langCounts.get(r.info.language) || 0) + 1
      )
    })
    const topLang = Array.from(langCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0]
    if (topLang && langCounts.size > 1) {
      const langIcon = this.getLanguageIcon(topLang[0])
      patterns.push(
        `   ${langIcon} Primary language: ${topLang[0]} (${Math.round(
          (topLang[1] / results.length) * 100
        )}%)`
      )
    }

    // Detect async pattern
    const asyncCount = results.filter(
      (r) =>
        r.info.context.includes('async') || r.info.context.includes('await')
    ).length
    if (asyncCount > results.length / 2) {
      patterns.push('   ⚡ Pattern: Always async/await')
    }

    // Detect error handling
    const errors = new Set<string>()
    results.forEach((r) => {
      const errorMatch = r.info.context.match(/throw\s+new\s+(\w+Error)/)
      if (errorMatch) errors.add(errorMatch[1])
    })
    if (errors.size > 0) {
      patterns.push(`   💥 Throws: ${Array.from(errors).join(', ')}`)
    }

    // Test coverage
    const testFiles = results.filter(
      (r) =>
        r.info.location.file.includes('.test.') ||
        r.info.location.file.includes('.spec.')
    ).length
    if (testFiles > 0) {
      patterns.push(`   ✅ Test coverage: ${testFiles} test files`)
    }

    // Export/import patterns for main definition
    const primary = results.find((r) =>
      ['class', 'function', 'interface'].includes(r.info.type)
    )
    if (primary) {
      const isExported = this.checkIfExported(primary.info)
      if (isExported && primary.usageCount && primary.usageCount > 5) {
        patterns.push(
          `   🌟 Widely used export (${primary.usageCount} imports)`
        )
      }
    }

    return patterns
  }

  private generateNextSuggestions(
    query: string,
    results: SearchResult[]
  ): string[] {
    const suggestions: string[] = []

    // If it's a high-usage item, suggest refs
    const hasHighUsage = results.some((r) => r.usageCount && r.usageCount > 5)
    if (hasHighUsage) {
      suggestions.push(`smartgrep refs "${query}"`)
    }

    // If mostly one type, suggest filtering by another type
    const types = [...new Set(results.map((r) => r.info.type))]
    if (types.length > 2) {
      const nonPrimaryType = types.find((t) => t !== results[0].info.type)
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

  private getMeaningfulRelatedTerms(
    results: SearchResult[],
    query: string
  ): string[] {
    const termCounts = new Map<string, number>()

    results.forEach((r) => {
      if (r.info.relatedTerms) {
        r.info.relatedTerms.forEach((term) => {
          if (
            term.length > 3 &&
            !this.isCommonTerm(term) &&
            term.toLowerCase() !== query.toLowerCase() &&
            !term.toLowerCase().includes(query.toLowerCase())
          ) {
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
    const common = [
      'export',
      'import',
      'from',
      'const',
      'let',
      'var',
      'this',
      'await',
      'return',
      'async',
      'function',
      'class',
      'new',
      'true',
      'false',
      'null',
      'undefined',
      'string',
      'number',
      'boolean',
    ]
    return common.includes(term.toLowerCase())
  }

  private countUniqueFiles(results: SearchResult[]): number {
    return new Set(results.map((r) => r.info.location.file)).size
  }

  private countByType(results: SearchResult[], type: string): number {
    return results.filter((r) => r.info.type === type).length
  }

  private selectRelevantSurroundingLines(
    surroundingLines: string[],
    mainLine: string
  ): string[] {
    // Select 1-2 most relevant surrounding lines for context
    const selected: string[] = []

    // Language-agnostic patterns that indicate important context
    const importantPatterns = [
      // Control flow (all languages)
      /\b(if|elif|else|when|unless|case|switch)\b/i,
      /\b(try|catch|except|finally|rescue|ensure)\b/i,
      /\b(for|while|do|loop|each|map|filter)\b/i,
      /\b(return|yield|break|continue|goto)\b/i,
      /\b(throw|raise|panic|error)\b/i,

      // Async patterns (multiple languages)
      /\b(async|await|promise|future|coroutine|go)\b/i,
      /\b(then|defer|spawn)\b/i,

      // Assignment and declarations (generic)
      /^[^=]+=\s*[^=]/, // Any assignment (but not comparison)
      /[:=]\s*$/, // Assignment at end of line (Go, Python)
      /<-/, // Channel operations (Go)
      /\|>/, // Pipe operations (Elixir, F#)

      // Function/method calls and definitions
      /\([^)]*\)\s*[{:]/, // Function definition start
      /\)\s*->/, // Arrow functions
      /\bdef\b|\bfn\b|\bfunc\b/i, // Function keywords

      // Blocks and scopes
      /[{}\[\]]/, // Braces and brackets
      /\b(begin|end|do)\b/i, // Block keywords

      // Comments that might explain usage
      /\/\/|#|\/\*/, // Comment starts

      // Type annotations and guards
      /: \w+/, // Type annotations
      /\?\s*$/, // Optional chaining/nil checks
      /!\s*$/, // Force unwrap/assertion
    ]

    // Score each line by relevance
    const scoredLines = surroundingLines.map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed === mainLine.trim()) {
        return { line, score: -1, index }
      }

      let score = 0

      // Check pattern matches
      for (const pattern of importantPatterns) {
        if (pattern.test(trimmed)) {
          score += 2
        }
      }

      // Proximity to main line matters
      const mainIndex = surroundingLines.findIndex(
        (l) => l.trim() === mainLine.trim()
      )
      if (mainIndex !== -1) {
        const distance = Math.abs(index - mainIndex)
        score += 3 - distance // Closer lines get higher score
      }

      // Indentation relationship matters
      const mainIndent = mainLine.length - mainLine.trimStart().length
      const lineIndent = line.length - line.trimStart().length

      // Parent scope (less indented) is often important
      if (lineIndent < mainIndent) {
        score += 1
      }

      // Opening braces/conditions before are important
      if (index < mainIndex && /[{(]\s*$/.test(trimmed)) {
        score += 2
      }

      return { line, score, index }
    })

    // Sort by score and take top 2
    const relevant = scoredLines
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        // First by score, then by proximity to maintain order
        if (b.score !== a.score) return b.score - a.score
        return (
          Math.abs(a.index - surroundingLines.length / 2) -
          Math.abs(b.index - surroundingLines.length / 2)
        )
      })
      .slice(0, 2)
      .sort((a, b) => a.index - b.index) // Restore original order
      .map((item) => item.line)

    return relevant
  }

  private extractCallerContext(usage: CrossReference): string | null {
    // Try to extract the function/class name where this call is made
    // This is a simplified version - in real implementation, we'd have this info
    // from the semantic index
    const fromFile = usage.fromLocation.file.split('/').slice(-2).join('/')
    return null // For now, fallback to file:line format
  }

  private getLanguageIcon(language: string): string {
    const icons: Record<string, string> = {
      // Programming Languages
      typescript: '📘',
      javascript: '📙',
      python: '🐍',
      go: '🐹',
      rust: '🦀',
      swift: '🦉',
      java: '☕',
      csharp: '🔷',
      cpp: '🔵',
      ruby: '💎',
      php: '🐘',

      // Web Technologies
      html: '🌐',
      css: '🎨',
      jsx: '⚛️',
      tsx: '⚛️',

      // Framework Files
      svelte: '🔥',
      vue: '💚',
      astro: '🚀',
      mdx: '📝',

      // Config Files
      json: '📋',
      yaml: '📄',
      toml: '⚙️',
      xml: '📰',
      env: '🔐',

      // Shell/Scripts
      shell: '🐚',
      bash: '🖥️',
      powershell: '💠',

      // Default
      unknown: '📄',
    }

    return icons[language.toLowerCase()] || icons['unknown']
  }

  private checkIfExported(info: SemanticInfo): boolean | null {
    const context = info.context.trim()

    // TypeScript/JavaScript
    if (info.language === 'typescript' || info.language === 'javascript') {
      return context.startsWith('export ') || context.includes('module.exports')
    }

    // Python
    if (info.language === 'python') {
      // Check if it's in __all__ or at module level without underscore
      return !info.term.startsWith('_') && info.type !== 'variable'
    }

    // Go - exported if starts with capital
    if (info.language === 'go') {
      return /^[A-Z]/.test(info.term)
    }

    // Rust
    if (info.language === 'rust') {
      return context.includes('pub ')
    }

    // Can't determine for other languages
    return null
  }

  private checkForDevMarkers(info: SemanticInfo): string[] {
    const markers: string[] = []

    // Check surrounding lines for dev markers
    if (info.surroundingLines && info.surroundingLines.length > 0) {
      const devMarkerPattern =
        /\b(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REFACTOR|NOTE|REVIEW|DEPRECATED|WORKAROUND|TEMP|KLUDGE|SMELL)\b/gi

      info.surroundingLines.forEach((line) => {
        const matches = line.match(devMarkerPattern)
        if (matches) {
          matches.forEach((match) => {
            const upperMatch = match.toUpperCase()
            if (!markers.includes(upperMatch)) {
              markers.push(upperMatch)
            }
          })
        }
      })
    }

    // Also check metadata if available
    if (info.metadata?.isDevelopmentMarker && info.metadata?.markerType) {
      if (!markers.includes(info.metadata.markerType)) {
        markers.push(info.metadata.markerType)
      }
    }

    return markers
  }

  private truncate(str: string, maxLength: number): string {
    if (!str) return ''
    return str.length <= maxLength ? str : str.substring(0, maxLength - 3) + '...'
  }

  private generateStoryContext(query: string, story: CodebaseStory): string | null {
    const queryLower = query.toLowerCase()
    const output: string[] = []
    
    // Find relevant flow
    const relevantFlow = story.flows.find(flow =>
      flow.steps.some(step => step.text.toLowerCase().includes(queryLower))
    )
    
    // Find error patterns
    const relevantErrors = story.errors.filter(err =>
      err.error.toLowerCase().includes(queryLower) ||
      err.trigger.toLowerCase().includes(queryLower)
    ).slice(0, 3)
    
    // Find boundaries
    const relevantBoundaries = story.boundaries.filter(b =>
      b.identifier.toLowerCase().includes(queryLower) ||
      b.usage.some(u => u.context.toLowerCase().includes(queryLower))
    ).slice(0, 2)
    
    // Only show if we have relevant context
    if (!relevantFlow && relevantErrors.length === 0 && relevantBoundaries.length === 0) {
      return null
    }
    
    const contextLines: string[] = []
    
    if (relevantFlow) {
      contextLines.push(' 📖 ' + chalk.bold('STORY CONTEXT:'))
      contextLines.push(`    Part of: ${relevantFlow.name}`)
      
      // Show flow with current step highlighted
      const stepIndex = relevantFlow.steps.findIndex(s => 
        s.text.toLowerCase().includes(queryLower)
      )
      const flowSteps = relevantFlow.steps.map(s => this.truncate(s.text, 20))
      contextLines.push(`    Flow: ${flowSteps.join(' → ')}`)
      
      if (stepIndex > 0) {
        contextLines.push(`    Comes after: "${this.truncate(relevantFlow.steps[stepIndex - 1].text, 40)}"`)
      }
      if (stepIndex < relevantFlow.steps.length - 1 && stepIndex >= 0) {
        contextLines.push(`    Leads to: "${this.truncate(relevantFlow.steps[stepIndex + 1].text, 40)}"`)
      }
    }
    
    if (relevantErrors.length > 0) {
      if (!relevantFlow) contextLines.push(' ⚠️ ' + chalk.bold('ERROR PATTERNS:'))
      else contextLines.push('')
      
      relevantErrors.forEach(err => {
        contextLines.push(`    • ${this.truncate(err.trigger, 25)} → ${chalk.red(this.truncate(err.error, 35))}`)
        if (err.recovery) {
          contextLines.push(`      ↻ Recovery: ${this.truncate(err.recovery, 35)}`)
        }
      })
    }
    
    if (relevantBoundaries.length > 0) {
      contextLines.push(`    🌐 External: ${relevantBoundaries.map(b => b.identifier).join(', ')}`)
    }
    
    // Format as a box
    const width = this.calculateMaxWidth(contextLines)
    const boxLines: string[] = []
    
    boxLines.push(chalk.yellow('┌' + '─'.repeat(width - 2) + '┐'))
    contextLines.forEach(line => {
      const visibleLength = this.stripAnsi(line).length
      const padding = ' '.repeat(Math.max(0, width - visibleLength - 2))
      boxLines.push(chalk.yellow('│') + line + padding + chalk.yellow('│'))
    })
    boxLines.push(chalk.yellow('└' + '─'.repeat(width - 2) + '┘'))
    
    return boxLines.join('\n')
  }

  private generateNoResultsSummary(query: string): string {
    const shorter = query.substring(0, Math.ceil(query.length / 2))

    // Header
    const headerLines = [
      ` 🔍 ${chalk.bold.white('SMARTGREP:')} ${chalk.yellow(`"${query}"`)}`,
      ` 📊 ${chalk.red('0 results found')}`,
    ]
    const headerWidth = this.calculateMaxWidth(headerLines)

    // No matches box
    const noMatchLines = [
      ' No results found for your search term.',
      ' This could mean:',
      "   • Term doesn't exist in the codebase",
      '   • Different spelling/case is used',
      "   • It's part of a longer identifier",
    ]
    const noMatchWidth = this.calculateMaxWidth(noMatchLines)
    const noMatchTitle = '❌ NO MATCHES '
    const noMatchPadding = '─'.repeat(
      Math.max(0, noMatchWidth - noMatchTitle.length - 2)
    )

    // Suggestions
    const suggestionLines = [
      ' 💡 ' + chalk.bold('SUGGESTIONS:'),
      `   ${chalk.green('▸')} smartgrep "${shorter}"         ${chalk.dim(
        '[try shorter term]'
      )}`,
      `   ${chalk.green('▸')} smartgrep "/${query}.*/" --regex   ${chalk.dim(
        '[flexible pattern]'
      )}`,
      `   ${chalk.green('▸')} smartgrep group list             ${chalk.dim(
        '[browse concept groups]'
      )}`,
      `   ${chalk.green('▸')} smartgrep "${query}" --full        ${chalk.dim(
        '[check partial matches]'
      )}`,
    ]
    const suggestionsWidth = this.calculateMaxWidth(suggestionLines)

    const output: string[] = []

    // Header
    output.push(chalk.cyan('╔' + '═'.repeat(headerWidth - 2) + '╗'))
    headerLines.forEach((line) => {
      const visibleLength = this.stripAnsi(line).length
      const padding = ' '.repeat(Math.max(0, headerWidth - visibleLength - 2))
      output.push(chalk.cyan('║') + line + padding + chalk.cyan('║'))
    })
    output.push(chalk.cyan('╚' + '═'.repeat(headerWidth - 2) + '╝'))
    output.push('')

    // No matches box
    output.push(chalk.red('┌─ ' + noMatchTitle + noMatchPadding + '┐'))
    noMatchLines.forEach((line) => {
      const visibleLength = this.stripAnsi(line).length
      const padding = ' '.repeat(Math.max(0, noMatchWidth - visibleLength - 2))
      output.push(chalk.red('│') + line + padding + chalk.red('│'))
    })
    output.push(chalk.red('└' + '─'.repeat(noMatchWidth - 2) + '┘'))
    output.push('')

    // Suggestions
    output.push(chalk.cyanBright('╔' + '═'.repeat(suggestionsWidth - 2) + '╗'))
    suggestionLines.forEach((line) => {
      const visibleLength = this.stripAnsi(line).length
      const padding = ' '.repeat(
        Math.max(0, suggestionsWidth - visibleLength - 2)
      )
      output.push(
        chalk.cyanBright('║') + line + padding + chalk.cyanBright('║')
      )
    })
    output.push(chalk.cyanBright('╚' + '═'.repeat(suggestionsWidth - 2) + '╝'))

    return output.join('\n')
  }
}
