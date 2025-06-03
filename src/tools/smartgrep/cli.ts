#!/usr/bin/env bun

/**
 * Smart Grep CLI
 * Semantic search tool for codebases
 */

import {
  SemanticService,
  loadConfig,
  parseCustomGroups,
  getGroupTerms,
  groupExists,
  getFormattedGroupList,
} from '@codebase-curator/semantic-core'
import type {
  SearchResult,
  CrossReference,
  ConceptGroupDefinition,
} from '@codebase-curator/semantic-core'


async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp()
    process.exit(0)
  }

  const projectPath = process.cwd()
  const service = new SemanticService(projectPath)

  // Parse command and options
  const command = args[0]

  // Handle flag-based commands first
  if (command.startsWith('--')) {
    switch (command) {
      case '--index':
        await handleIndex(service, projectPath)
        break
      
      case '--list-groups': // Keep this for backward compatibility
        await handleGroupCommand(projectPath, ['list'])
        break
        
      default:
        console.error(`Unknown command: ${command}`)
        showHelp()
        process.exit(1)
    }
    return
  }

  // Handle group subcommands
  if (command === 'group') {
    await handleGroupCommand(projectPath, args.slice(1), service)
    return
  }

  // Handle refs/references
  if (command === 'refs' || command === 'references') {
    if (args.length < 2) {
      console.error('Please provide a term to find references for')
      process.exit(1)
    }
    await handleReferences(service, projectPath, args[1])
    return
  }

  // Default: treat everything else as search
  await handleSearch(service, projectPath, args)
}

/**
 * Handle all group-related commands
 */
async function handleGroupCommand(
  projectPath: string, 
  args: string[], 
  service?: SemanticService
) {
  if (args.length === 0) {
    console.error('Please specify a group action: list, add, remove, or <group-name>')
    console.error('\nExamples:')
    console.error('  smartgrep group list')
    console.error('  smartgrep group auth')
    console.error('  smartgrep group add mygroup term1,term2,term3')
    console.error('  smartgrep group remove mygroup')
    process.exit(1)
  }

  const action = args[0].toLowerCase()
  
  switch (action) {
    case 'list':
      await handleGroupList(projectPath)
      break
      
    case 'add':
      await handleGroupAdd(projectPath, args.slice(1))
      break
      
    case 'remove':
    case 'rm':
      await handleGroupRemove(projectPath, args.slice(1))
      break
      
    default:
      // Treat as group search
      if (!service) {
        console.error('Service not available for group search')
        process.exit(1)
      }
      await handleGroupSearchCommand(service, projectPath, action, args.slice(1))
  }
}

async function handleGroupList(projectPath: string) {
  const config = loadConfig(projectPath)
  const customGroups = parseCustomGroups(config.customGroups || {})
  console.log(getFormattedGroupList(customGroups))
}

async function handleGroupAdd(projectPath: string, args: string[]) {
  if (args.length < 2) {
    console.error('Usage: smartgrep group add <name> <term1,term2,term3...>')
    console.error('Example: smartgrep group add payments charge,bill,invoice,transaction')
    process.exit(1)
  }

  const groupName = args[0].toLowerCase()
  const termsString = args[1]
  const terms = termsString.split(',').map(t => t.trim()).filter(t => t)

  if (terms.length === 0) {
    console.error('Please provide at least one term for the group')
    process.exit(1)
  }

  // Load existing config
  const config = loadConfig(projectPath)
  
  // Initialize customGroups if not exists
  if (!config.customGroups) {
    config.customGroups = {}
  }

  // Add the new group
  config.customGroups[groupName] = terms

  // Save config using Bun's API
  const configPath = getConfigPath(projectPath)
  await Bun.write(configPath, JSON.stringify(config, null, 2))

  console.log(`✅ Added custom group "${groupName}" with ${terms.length} terms:`)
  console.log(`   Terms: ${terms.join(', ')}`)
  console.log(`   Usage: smartgrep group ${groupName}`)
}

async function handleGroupRemove(projectPath: string, args: string[]) {
  if (args.length < 1) {
    console.error('Usage: smartgrep group remove <name>')
    console.error('Example: smartgrep group remove payments')
    process.exit(1)
  }

  const groupName = args[0].toLowerCase()
  
  // Load existing config
  const config = loadConfig(projectPath)
  
  if (!config.customGroups || !config.customGroups[groupName]) {
    console.error(`❌ Custom group "${groupName}" not found`)
    console.error('Use "smartgrep group list" to see available groups')
    process.exit(1)
  }

  // Remove the group
  delete config.customGroups[groupName]

  // Clean up empty customGroups object
  if (Object.keys(config.customGroups).length === 0) {
    delete config.customGroups
  }

  // Save config using Bun's API
  const configPath = getConfigPath(projectPath)
  await Bun.write(configPath, JSON.stringify(config, null, 2))

  console.log(`✅ Removed custom group "${groupName}"`)
}

function getConfigPath(projectPath: string): string {
  return `${projectPath}/.curatorconfig.json`
}

async function handleGroupSearchCommand(
  service: SemanticService,
  projectPath: string,
  groupName: string,
  extraArgs: string[]
) {
  const config = loadConfig(projectPath)
  const customGroups = parseCustomGroups(config.customGroups || {})
  
  if (!groupExists(groupName, customGroups)) {
    console.error(`Unknown concept group: "${groupName}"`)
    console.error('\nAvailable groups:')
    const formattedList = getFormattedGroupList(customGroups)
    console.log(formattedList)
    process.exit(1)
  }
  
  const conceptGroup = getGroupTerms(groupName, customGroups)
  
  // Search using the concept group
  await handleGroupSearch(
    service,
    projectPath,
    groupName,
    conceptGroup,
    extraArgs
  )
}

// Helper functions for advanced search patterns
async function searchWithAnd(
  service: SemanticService,
  terms: string[],
  options: any
): Promise<SearchResult[]> {
  // Get results for first term
  let results = service.search(terms[0], options)

  // Filter to only include results that match ALL terms
  for (let i = 1; i < terms.length; i++) {
    const termResults = service.search(terms[i], options)
    const termFiles = new Set(
      termResults.map((r) => `${r.info.location.file}:${r.info.location.line}`)
    )

    results = results.filter((r) =>
      termFiles.has(`${r.info.location.file}:${r.info.location.line}`)
    )
  }

  return results
}

async function searchWithNot(
  service: SemanticService,
  excludeTerm: string,
  options: any
): Promise<SearchResult[]> {
  // Get all results without the exclude term
  const allResults = service.search('', { ...options, maxResults: 1000 })
  const excludeResults = service.search(excludeTerm, options)

  const excludeSet = new Set(
    excludeResults.map(
      (r) => `${r.info.location.file}:${r.info.location.line}:${r.info.term}`
    )
  )

  return allResults.filter(
    (r) =>
      !excludeSet.has(
        `${r.info.location.file}:${r.info.location.line}:${r.info.term}`
      )
  )
}

async function searchWithRegex(
  service: SemanticService,
  pattern: string,
  options: any
): Promise<SearchResult[]> {
  try {
    const regex = new RegExp(pattern)
    // Search with empty query to get all results, then filter by regex
    const allResults = service.search('', { ...options, maxResults: 1000 })
    return allResults.filter((r) => regex.test(r.info.term))
  } catch (e) {
    console.error(`Invalid regex pattern: ${pattern}`)
    return []
  }
}

function sortResults(results: SearchResult[], sortBy: string): SearchResult[] {
  switch (sortBy) {
    case 'usage':
      return [...results].sort(
        (a, b) => (b.usageCount || 0) - (a.usageCount || 0)
      )
    case 'name':
      return [...results].sort((a, b) => a.info.term.localeCompare(b.info.term))
    case 'file':
      return [...results].sort((a, b) =>
        a.info.location.file.localeCompare(b.info.location.file)
      )
    default: // relevance
      return results // Already sorted by relevance
  }
}

function displayResultsCompact(query: string, results: SearchResult[]) {
  console.log(`\n🔍 "${query}": ${results.length} results\n`)

  results.forEach((result) => {
    const { info } = result
    const uses = result.usageCount ? ` (${result.usageCount})` : ''
    console.log(
      `${info.term}${uses} → ${info.location.file}:${info.location.line}:${info.location.column}`
    )
  })
}

async function handleIndex(service: SemanticService, projectPath: string) {
  console.log(`📂 Indexing codebase at: ${projectPath}`)
  await service.indexCodebase(projectPath)
  console.log('✨ Indexing complete!')
}

async function handleGroupSearch(
  service: SemanticService,
  projectPath: string,
  groupName: string,
  conceptGroup: string[],
  args: string[]
) {
  // Load index
  const loaded = await service.loadIndex(projectPath)
  if (!loaded) {
    console.log('No semantic index found. Building...')
    await service.indexCodebase(projectPath)
  }

  // Parse additional options (filters, sorting, etc.)
  let typeFilter: string[] | undefined
  let fileFilter: string[] | undefined
  let maxResults = 50
  let sortBy: 'relevance' | 'usage' | 'name' | 'file' = 'relevance'
  let outputFormat: 'pretty' | 'json' | 'compact' = 'pretty'
  let showContext = true

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--type' && args[i + 1]) {
      typeFilter = args[++i].split(',')
    } else if (arg === '--file' && args[i + 1]) {
      fileFilter = args[++i].split(',')
    } else if (arg === '--max' && args[i + 1]) {
      maxResults = parseInt(args[++i])
    } else if (arg === '--sort' && args[i + 1]) {
      sortBy = args[++i] as any
    } else if (arg === '--json') {
      outputFormat = 'json'
    } else if (arg === '--compact') {
      outputFormat = 'compact'
    } else if (arg === '--no-context') {
      showContext = false
    }
  }

  // Search using the concept group
  let results = service.searchGroup(conceptGroup)

  // Apply filters if provided
  if (typeFilter || fileFilter) {
    results = results.filter((r) => {
      if (typeFilter && !typeFilter.includes(r.info.type)) return false
      if (
        fileFilter &&
        !fileFilter.some((pattern) => r.info.location.file.includes(pattern))
      )
        return false
      return true
    })
  }

  // Sort results
  results = sortResults(results, sortBy)

  // Limit results
  results = results.slice(0, maxResults)

  // Display results based on format
  switch (outputFormat) {
    case 'json':
      console.log(JSON.stringify(results, null, 2))
      break
    case 'compact':
      displayResultsCompact(`group:${groupName}`, results)
      break
    default:
      displayGroupResults(groupName, conceptGroup, results, showContext)
  }
}

async function handleReferences(
  service: SemanticService,
  projectPath: string,
  term: string
) {
  // Load index
  const loaded = await service.loadIndex(projectPath)
  if (!loaded) {
    console.log('No semantic index found. Building...')
    await service.indexCodebase(projectPath)
  }

  // Get impact analysis
  const analysis = service.getImpactAnalysis(term)

  if (analysis.directReferences.length === 0) {
    console.log(`\n❌ No references found for "${term}"`)
    return
  }

  // Brief summary with counts
  const typeSummary = Object.entries(analysis.byType)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
    .join(', ')

  console.log(
    `\n📍 ${analysis.directReferences.length} References to "${term}" (${typeSummary}):\n`
  )

  // Show references grouped by file with actual code
  const byFile: Record<string, CrossReference[]> = {}
  analysis.directReferences.forEach((ref) => {
    const file = ref.fromLocation.file
    if (!byFile[file]) byFile[file] = []
    byFile[file].push(ref)
  })

  // Sort files by path for consistent output
  const sortedFiles = Object.keys(byFile).sort()

  for (const file of sortedFiles) {
    const refs = byFile[file]
    const shortPath = file.split('/').slice(-2).join('/')
    console.log(`${shortPath}:`)

    // Sort references by line number
    refs.sort((a, b) => a.fromLocation.line - b.fromLocation.line)

    refs.forEach((ref) => {
      const lineNum = ref.fromLocation.line.toString().padStart(4)
      const typeIcon = getReferenceIcon(ref.referenceType)
      console.log(`  ${lineNum}: ${ref.context.trim()}`)
      console.log(`        ${typeIcon} ${ref.referenceType}`)
    })
    console.log('')
  }
}

async function handleSearch(
  service: SemanticService,
  projectPath: string,
  args: string[]
) {
  // Try to load existing index
  const loaded = await service.loadIndex(projectPath)
  if (!loaded) {
    console.log('No semantic index found. Building...')
    await service.indexCodebase(projectPath)
  }

  // Parse search arguments
  let query = ''
  let typeFilter: string[] | undefined
  let fileFilter: string[] | undefined
  let maxResults = 50
  let searchMode: 'fuzzy' | 'exact' | 'regex' = 'fuzzy'
  let showContext = true
  let sortBy: 'relevance' | 'usage' | 'name' | 'file' = 'relevance'
  let outputFormat: 'pretty' | 'json' | 'compact' = 'pretty'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--type' && args[i + 1]) {
      typeFilter = args[++i].split(',')
    } else if (arg === '--file' && args[i + 1]) {
      fileFilter = args[++i].split(',')
    } else if (arg === '--max' && args[i + 1]) {
      maxResults = parseInt(args[++i])
    } else if (arg === '--exact') {
      searchMode = 'exact'
    } else if (arg === '--regex') {
      searchMode = 'regex'
    } else if (arg === '--no-context') {
      showContext = false
    } else if (arg === '--sort' && args[i + 1]) {
      sortBy = args[++i] as any
    } else if (arg === '--json') {
      outputFormat = 'json'
    } else if (arg === '--compact') {
      outputFormat = 'compact'
    } else if (!arg.startsWith('--')) {
      query = arg
    }
  }

  if (!query) {
    console.error('Please provide a search query')
    process.exit(1)
  }

  // Handle different search patterns
  let results: SearchResult[] = []

  // Note: Concept groups are now handled by the 'group' command
  if (query.includes('|')) {
    // OR pattern: term1|term2|term3
    const terms = query.split('|').map((t) => t.trim())
    results = service.searchGroup(terms)
  } else if (query.includes('&')) {
    // AND pattern: term1&term2 (must contain all)
    const terms = query.split('&').map((t) => t.trim())
    results = await searchWithAnd(service, terms, {
      type: typeFilter,
      files: fileFilter,
      maxResults,
    })
  } else if (query.startsWith('!')) {
    // NOT pattern: !term (exclude results containing term)
    results = await searchWithNot(service, query.substring(1), {
      type: typeFilter,
      files: fileFilter,
      maxResults,
    })
  } else if (
    searchMode === 'regex' ||
    (query.startsWith('/') && query.endsWith('/'))
  ) {
    // Regex pattern: /pattern/
    const pattern = query.startsWith('/') ? query.slice(1, -1) : query
    results = await searchWithRegex(service, pattern, {
      type: typeFilter,
      files: fileFilter,
      maxResults,
    })
  } else {
    // Normal search with mode
    results = service.search(query, {
      type: typeFilter,
      files: fileFilter,
      maxResults,
      exact: searchMode === 'exact',
    })
  }

  // Sort results based on preference
  results = sortResults(results, sortBy)

  // Display results based on format
  switch (outputFormat) {
    case 'json':
      console.log(JSON.stringify(results, null, 2))
      break
    case 'compact':
      displayResultsCompact(query, results)
      break
    default:
      displayResults(query, results, undefined, showContext)
  }
}

function displayGroupResults(
  groupName: string,
  conceptGroup: string[],
  results: SearchResult[],
  showContext: boolean = true
) {
  if (results.length === 0) {
    console.log(`\nNo results found for concept group "${groupName}"`)
    return
  }

  const groupIcon = getGroupIcon(groupName)
  console.log(`\n${groupIcon} Concept Group: "${groupName}"`)
  console.log(
    `🔍 Searching for: ${conceptGroup.slice(0, 5).join(', ')}${
      conceptGroup.length > 5 ? ', ...' : ''
    }`
  )
  console.log(`📊 Found ${results.length} results\n`)

  // Continue with same display logic as displayResults
  displayResultsBody(results, showContext)
}

function displayResults(
  query: string,
  results: SearchResult[],
  conceptGroup?: string[],
  showContext: boolean = true
) {
  if (results.length === 0) {
    console.log(`No results found for "${query}"`)
    return
  }

  console.log(
    `\n🔍 Search: "${query}" ${
      conceptGroup ? `(concept group: ${conceptGroup.join(', ')})` : ''
    }`
  )
  console.log(`📊 Found ${results.length} results\n`)

  displayResultsBody(results, showContext)
}

function displayResultsBody(
  results: SearchResult[],
  showContext: boolean = true
) {
  if (results.length === 0) {
    console.log('No results found')
    return
  }

  // Group by type
  const grouped = results.reduce((acc, result) => {
    const type = result.info.type
    if (!acc[type]) acc[type] = []
    acc[type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  // Display each group
  for (const [type, items] of Object.entries(grouped)) {
    const icon = getTypeIcon(type)
    console.log(`${icon} ${type.toUpperCase()} (${items.length})`)

    items.slice(0, 10).forEach((result) => {
      const info = result.info
      const relevance = (result.relevanceScore * 100).toFixed(0)
      const shortPath = info.location.file.split('/').slice(-2).join('/')

      // Show term with usage count if available
      const termDisplay = result.usageCount
        ? `${info.term} (${result.usageCount} uses)`
        : info.term

      console.log(
        `├── ${termDisplay.padEnd(30)} → ${shortPath}:${info.location.line}:${
          info.location.column
        }`
      )

      // Show enhanced context based on type
      if (showContext) {
        // Show function/class signatures with better formatting
        if (type === 'function' || type === 'class') {
          console.log(`│   ${info.context.trim()}`)

          // Show surrounding context if available
          if (info.surroundingLines && info.surroundingLines.length > 0) {
            console.log(`│   ┌─ Context:`)
            info.surroundingLines.slice(0, 3).forEach((line) => {
              console.log(`│   │ ${line.trim()}`)
            })
          }

          // Show related terms found nearby
          if (info.relatedTerms && info.relatedTerms.length > 0) {
            console.log(
              `│   📎 Related: ${info.relatedTerms.slice(0, 5).join(', ')}`
            )
          }
        }

        // Show context for strings and comments
        if (type === 'string' || type === 'comment') {
          const contextPreview = info.context.trim()
          console.log(`│   "${contextPreview}"`)

          // Show where this string appears
          if (info.surroundingLines && info.surroundingLines.length > 0) {
            const surroundingPreview = info.surroundingLines.find((line) =>
              line.includes(info.term)
            )
            if (surroundingPreview && surroundingPreview !== info.context) {
              console.log(`│   In: ${surroundingPreview.trim()}`)
            }
          }
        }

        // Show imports with what they import
        if (type === 'import') {
          console.log(`│   ${info.context.trim()}`)
        }

        // Show sample usages for functions and classes
        if (
          (type === 'function' || type === 'class') &&
          result.sampleUsages &&
          result.sampleUsages.length > 0
        ) {
          console.log(`│   `)
          console.log(`│   📍 Used ${result.usageCount} times:`)
          result.sampleUsages.slice(0, 3).forEach((usage, idx) => {
            const usageFile = usage.fromLocation.file
              .split('/')
              .slice(-2)
              .join('/')
            console.log(
              `│   ${idx + 1}. ${usageFile}:${usage.fromLocation.line} (${
                usage.referenceType
              })`
            )
            console.log(`│      ${usage.context.trim()}`)
          })
          if (result.usageCount > 3) {
            console.log(`│      ... and ${result.usageCount - 3} more`)
          }
        }
      }
    })

    if (items.length > 10) {
      console.log(`└── ... and ${items.length - 10} more`)
    }
    console.log('')
  }

  // Show usage tip
  if (results.length > 20) {
    console.log('💡 Tip: Use filters to narrow results:')
    console.log('   smartgrep "auth" --type function')
    console.log('   smartgrep "error" --file "*.service.*"')
    console.log('   smartgrep "user" --max 20\n')
  }
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    function: '📁',
    class: '📦',
    variable: '📄',
    constant: '🔤',
    string: '💬',
    comment: '📝',
    import: '📥',
    file: '🗂️',
  }
  return icons[type] || '📄'
}

function showHelp() {
  console.log(`
🔍 Smart Grep - Semantic Code Search with Cross-References

Usage:
  smartgrep <query>                Search for a term or pattern
  smartgrep --index                Rebuild the semantic index
  smartgrep refs <term>            Show where a term is referenced

🏷️ Group Commands:
  smartgrep group list             List all available concept groups
  smartgrep group <name>           Search using a concept group
  smartgrep group add <name> <terms>   Add custom concept group
  smartgrep group remove <name>    Remove custom concept group

🎯 Search Patterns:
  term1|term2|term3               OR search - find any of these terms
  term1&term2                     AND search - must contain all terms
  !term                           NOT search - exclude this term
  /regex/                         Regex search - match pattern
  "exact phrase"                  Exact match (or use --exact)

🔧 Search Options:
  --type <types>     Filter by type (function,class,string,variable,etc.)
                     Can combine: --type function,class
  --file <patterns>  Filter by file patterns (supports wildcards)
  --max <number>     Maximum results to show (default: 50)
  --exact            Exact match only (no fuzzy matching)
  --regex            Treat query as regex pattern
  --no-context       Hide surrounding context
  --sort <by>        Sort by: relevance|usage|name|file
  --json             Output as JSON
  --compact          Compact output format

📊 Information Displayed:
  • Function signatures with parameters
  • Usage counts and sample usage locations
  • Surrounding code context (2-3 lines)
  • Related terms found nearby
  • Full cross-reference information
  • Exact line and column positions

🏷️ Concept Groups:
  smartgrep group auth        Authentication & security patterns
  smartgrep group service     Service classes and patterns
  smartgrep group error       Error handling patterns
  smartgrep group flow        Data flow and streaming
  ...and more! Use "smartgrep group list" to see all available groups

🎨 Custom Groups:
  smartgrep group add payments charge,bill,invoice,transaction
  smartgrep group payments --type function    # Search your custom group
  smartgrep group remove payments             # Remove when no longer needed

💡 Examples:
  smartgrep "authenticateUser"                  # Find function with usage info
  smartgrep "addCrossReference|getReferences"   # Find any of these functions
  smartgrep "error&string"                      # Find error-related strings
  smartgrep "!test" --type function             # Functions not containing 'test'
  smartgrep "/add.*Reference/" --regex          # Regex pattern search
  smartgrep group auth --sort usage             # Auth code sorted by usage
  smartgrep "CuratorService" --json             # Machine-readable output
  smartgrep refs "processPayment"               # Full impact analysis
  smartgrep group service --type class --max 10 # Top 10 service classes
  smartgrep group add api endpoint,route,handler,controller  # Add custom group

📍 Pro Tips:
  • The tool shows function signatures, surrounding context, and related code
  • Cross-references include the actual code making the reference
  • Use --no-context for a cleaner view when browsing many results
  • Combine filters for precise searches: --type function --file "*.service.*"
  • Create project-specific groups to match your domain and architecture

The tool indexes your entire codebase on first use.
Subsequent searches are instant using the cached semantic index.
Custom groups are saved to .curatorconfig.json in your project root.
`)
}


function getReferenceIcon(type: string): string {
  const icons: Record<string, string> = {
    call: '📞',
    import: '📥',
    extends: '⬆️',
    implements: '🔗',
    instantiation: '✨',
    'type-reference': '🏷️',
  }
  return icons[type] || '🔍'
}

function getGroupIcon(group: string): string {
  const icons: Record<string, string> = {
    // Authentication & Security
    auth: '🔐',
    security: '🛡️',

    // Data & Storage
    database: '🗄️',
    cache: '💾',

    // API & Communication
    api: '🌐',

    // Error & Status
    error: '⚠️',

    // Users & Entities
    user: '👤',

    // Business Logic
    payment: '💳',

    // Configuration & Settings
    config: '⚙️',

    // Testing & Quality
    test: '🧪',

    // Async & Concurrency
    async: '⏳',

    // Architecture & Structure
    service: '🔧',
    flow: '🌊',
    architecture: '🏗️',

    // Code Organization
    import: '📦',
    interface: '📋',

    // State & Data Flow
    state: '💡',
    event: '📡',

    // Infrastructure & Operations
    logging: '📝',

    // Development Workflow
    build: '🔨',
    deploy: '🚀',
  }
  return icons[group] || '📂'
}

// Run the CLI
main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
