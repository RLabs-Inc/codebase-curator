#!/usr/bin/env bun

/**
 * Codebase Curator CLI - Thin presentation layer
 * Uses the core curator service for all functionality
 */

import { createCuratorService } from '../../core'
import { resolve, join } from 'path'
import { existsSync, mkdirSync } from 'fs'

interface CLIArgs {
  path: string
  command: 'imports' | 'frameworks' | 'organization' | 'patterns' | 'similarity' | 'all' | 'ask' | 'feature' | 'change'
  output?: 'json' | 'summary' | 'detailed'
  help?: boolean
  quiet?: boolean
  curator?: boolean
  exclude?: string[]
  question?: string
  feature?: string
  change?: string
  newSession?: boolean
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const result: CLIArgs = {
    path: '',
    command: 'all',
    output: 'summary',
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-h':
      case '--help':
        result.help = true
        break
      case '-o':
      case '--output':
        const format = args[++i]
        if (format === 'json' || format === 'summary' || format === 'detailed') {
          result.output = format
        }
        break
      case '-q':
      case '--quiet':
        result.quiet = true
        break
      case '--curator':
        result.curator = true
        result.quiet = true // Curator mode implies quiet
        result.output = 'json' // Curator mode implies JSON output
        break
      case '-e':
      case '--exclude':
        const patterns = args[++i]
        result.exclude = patterns.split(',').map((p) => p.trim())
        break
      case '--new-session':
        result.newSession = true
        break
      default:
        if (!result.command && isValidCommand(args[i])) {
          result.command = args[i] as CLIArgs['command']
          // For curator commands, the next arg is the text input
          if (['ask', 'feature', 'change'].includes(result.command) && i + 2 < args.length) {
            result.path = args[++i]
            const input = args[++i]
            if (result.command === 'ask') result.question = input
            else if (result.command === 'feature') result.feature = input
            else if (result.command === 'change') result.change = input
          }
        } else if (!result.path) {
          result.path = args[i]
        }
    }
  }

  return result
}

function isValidCommand(cmd: string): boolean {
  return ['imports', 'frameworks', 'organization', 'patterns', 'similarity', 'all', 'ask', 'feature', 'change'].includes(
    cmd
  )
}

function showHelp() {
  console.log(`
🤖 Codebase Curator CLI - v2.3

Usage: codebase-curator <command> <path> [options]

Analysis Commands:
  imports      Analyze import dependencies
  frameworks   Detect frameworks and libraries
  organization Analyze file organization patterns
  patterns     Discover code patterns and conventions
  similarity   Find similar code blocks
  all          Run all analyses (default)

Curator Commands:
  ask          Ask the curator a question about the codebase
  feature      Get guidance for adding a new feature
  change       Get guidance for implementing a change/fix

Options:
  -o, --output <format>  Output format: json, summary (default), or detailed
  -q, --quiet           Suppress informational output
  -e, --exclude <patterns>  Comma-separated exclusion patterns
  --curator             Save output to .curator directory
  --new-session         Start a new curator session (for ask command)
  -h, --help            Show this help message

Examples:
  # Analysis commands
  codebase-curator imports ./my-project
  codebase-curator all ./my-project -o json
  codebase-curator patterns ./src --exclude "*.test.ts,*.spec.ts"
  
  # Curator commands
  codebase-curator ask ./my-project "How does authentication work?"
  codebase-curator feature ./my-project "Add user profile management"
  codebase-curator change ./my-project "Fix memory leak in data processing"
`)
}

function formatOutput(result: any, format: string, command: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result.data, null, 2)
    case 'detailed':
      return formatDetailed(result, command)
    case 'summary':
    default:
      return result.summary || formatSummary(result, command)
  }
}

function formatSummary(result: any, command: string): string {
  const data = result.data
  if (!data) return 'No data available'

  switch (command) {
    case 'imports':
      return `
📦 Import Analysis Summary
Files analyzed: ${data.summary?.totalFiles || 0}
Internal dependencies: ${data.summary?.internalDependencies || 0}
External packages: ${data.summary?.externalDependencies || 0}
Entry points: ${data.entryPoints?.length || 0}
Circular dependencies: ${data.circularDependencies?.length || 0}
`
    case 'frameworks':
      return `
🛠️ Framework Detection Summary
${data.frameworks
  ?.map((f: any) => `• ${f.name} (${f.confidence}% confidence)`)
  .join('\n') || 'No frameworks detected'}
`
    case 'organization':
      return `
📁 File Organization Summary
Structure depth: ${data.structure?.depth || 0}
Total files: ${data.structure?.totalFiles || 0}
Patterns found: ${data.patterns?.length || 0}
`
    case 'patterns':
      return `
🔍 Code Patterns Summary
Total patterns: ${data.statistics?.totalPatterns || 0}
Unique patterns: ${data.statistics?.uniquePatterns || 0}
Files analyzed: ${data.statistics?.filesAnalyzed || 0}
`
    case 'similarity':
      return `
🔄 Code Similarity Summary
Similar clusters: ${data.statistics?.totalClusters || 0}
Duplicate blocks: ${data.statistics?.duplicateBlocks || 0}
Near duplicates: ${data.statistics?.nearDuplicates || 0}
`
    default:
      return JSON.stringify(data, null, 2)
  }
}

function formatDetailed(result: any, command: string): string {
  // For detailed output, show both summary and full data
  const summary = formatSummary(result, command)
  const details = JSON.stringify(result.data, null, 2)
  return `${summary}\n\nDetailed Results:\n${details}`
}

async function saveToCurator(result: any, command: string, projectPath: string) {
  const curatorDir = join(projectPath, '.curator')
  if (!existsSync(curatorDir)) {
    mkdirSync(curatorDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
  const filename = `${command}-${timestamp}.json`
  const filepath = join(curatorDir, filename)

  await Bun.write(filepath, JSON.stringify(result.data, null, 2))
  return filepath
}

async function main() {
  const args = parseArgs()

  if (args.help) {
    showHelp()
    process.exit(0)
  }

  // Default to current directory if no path provided
  const projectPath = args.path || process.cwd()
  const resolvedPath = resolve(projectPath)

  if (!existsSync(resolvedPath)) {
    console.error(`Error: Path "${resolvedPath}" does not exist`)
    process.exit(1)
  }

  // Create curator service
  const curator = createCuratorService({
    projectPath: resolvedPath,
    cacheEnabled: true,
  })

  try {
    await curator.initialize()

    if (!args.quiet) {
      console.log(`🔍 Analyzing ${resolvedPath}...`)
    }

    let result
    let output: string

    // Handle curator commands
    if (args.command === 'ask') {
      if (!args.question) {
        console.error('Error: Please provide a question for the curator')
        process.exit(1)
      }
      const response = await curator.askCurator({
        question: args.question,
        projectPath: resolvedPath,
        newSession: args.newSession,
      })
      output = response.content
    } else if (args.command === 'feature') {
      if (!args.feature) {
        console.error('Error: Please provide a feature description')
        process.exit(1)
      }
      output = await curator.addNewFeature({
        feature: args.feature,
        projectPath: resolvedPath,
      })
    } else if (args.command === 'change') {
      if (!args.change) {
        console.error('Error: Please provide a change description')
        process.exit(1)
      }
      output = await curator.implementChange({
        change: args.change,
        projectPath: resolvedPath,
      })
    } else if (args.command === 'all') {
      // Run all analyses
      const analyses = await Promise.all([
        curator.runAnalysis({ type: 'imports', projectPath: resolvedPath }),
        curator.runAnalysis({ type: 'frameworks', projectPath: resolvedPath }),
        curator.runAnalysis({ type: 'organization', projectPath: resolvedPath }),
        curator.runAnalysis({ type: 'patterns', projectPath: resolvedPath }),
        curator.runAnalysis({ type: 'similarity', projectPath: resolvedPath }),
      ])

      result = {
        data: {
          imports: analyses[0].data,
          frameworks: analyses[1].data,
          organization: analyses[2].data,
          patterns: analyses[3].data,
          similarity: analyses[4].data,
        },
        summary: analyses.map((a) => a.summary).join('\n'),
      }
      output = formatOutput(result, args.output!, args.command)
    } else {
      // Run specific analysis
      result = await curator.runAnalysis({
        type: args.command as any,
        projectPath: resolvedPath,
        options: {
          exclude: args.exclude,
        },
      })
      output = formatOutput(result, args.output!, args.command)
    }

    // Output results
    console.log(output)

    // Save to curator directory if requested (only for analysis commands)
    if (args.curator && result) {
      const savedPath = await saveToCurator(result, args.command, resolvedPath)
      if (!args.quiet) {
        console.error(`\n📁 Results saved to: ${savedPath}`)
      }
    }

    // Show cache stats if not quiet
    if (!args.quiet) {
      const stats = curator.getCacheStats()
      console.error(`\n⚡ Cache: ${stats.cacheHits} hits, ${stats.cacheMisses} misses`)
    }

    await curator.cleanup()
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})