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
  // FlowTracer, // REMOVED
  DEFAULT_CONCEPT_GROUPS,
} from '@codebase-curator/semantic-core'
import type {
  SearchResult,
  CrossReference,
  ConceptGroupDefinition,
  SemanticInfo,
} from '@codebase-curator/semantic-core'
import { displayResultsForClaude } from './displays/claude-display.js'
import { CompactSummaryGenerator } from './displays/compactSummary.js'
// import { StoryDisplay } from './commands/story/storyCommand.js' // REMOVED
import { execSync } from 'child_process'

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

  // Handle changes command for impact analysis
  if (command === 'changes') {
    await handleChangesImpact(service, projectPath, args.slice(1))
    return
  }

  // REMOVED: flow and story commands
  // These features were removed to keep smartgrep focused on its core strength:
  // semantic code search with cross-references and pattern matching

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
    console.error(
      'Please specify a group action: list, add, remove, or <group-name>'
    )
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
      await handleGroupSearchCommand(
        service,
        projectPath,
        action,
        args.slice(1)
      )
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
    console.error(
      'Example: smartgrep group add payments charge,bill,invoice,transaction'
    )
    process.exit(1)
  }

  const groupName = args[0].toLowerCase()
  const termsString = args[1]
  const terms = termsString
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t)

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

  console.log(
    `✅ Added custom group "${groupName}" with ${terms.length} terms:`
  )
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
  process.stdout.write(`🔍 Searching for "${terms[0]}"...`)
  let results = await service.search(terms[0], options)
  process.stdout.write(' ✓\n')

  // Filter to only include results that match ALL terms
  for (let i = 1; i < terms.length; i++) {
    process.stdout.write(`🔍 Filtering by "${terms[i]}"...`)
    const termResults = await service.search(terms[i], options)
    const termFiles = new Set(
      termResults.map((r) => `${r.info.location.file}:${r.info.location.line}`)
    )

    results = results.filter((r) =>
      termFiles.has(`${r.info.location.file}:${r.info.location.line}`)
    )
    process.stdout.write(' ✓\n')
  }

  return results
}

async function searchWithNot(
  service: SemanticService,
  excludeTerm: string,
  options: any
): Promise<SearchResult[]> {
  // Get all results without the exclude term
  process.stdout.write(`🔍 Searching for all items...`)
  const allResults = await service.search('', { ...options, maxResults: 1000 })
  process.stdout.write(' ✓\n')

  process.stdout.write(`🔍 Finding items to exclude ("${excludeTerm}")...`)
  const excludeResults = await service.search(excludeTerm, options)
  process.stdout.write(' ✓\n')

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
    process.stdout.write(`🔍 Searching for regex pattern /${pattern}/...`)
    const allResults = await service.search('', {
      ...options,
      maxResults: 1000,
    })
    const filtered = allResults.filter((r) => regex.test(r.info.term))
    process.stdout.write(' ✓\n')
    return filtered
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
  // Check if index exists
  const hasExistingIndex = await service.loadIndex(projectPath)

  if (!hasExistingIndex) {
    // No index exists - do initial indexing
    console.log(`📂 Building initial index at: ${projectPath}`)

    const startTime = Date.now()
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let spinnerIndex = 0

    const interval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      process.stdout.write(
        `\r${spinner[spinnerIndex]} Indexing... (${elapsed}s)`
      )
      spinnerIndex = (spinnerIndex + 1) % spinner.length
    }, 100)

    try {
      await service.indexCodebase(projectPath)
      clearInterval(interval)
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      process.stdout.write('\r')
      console.log(`✨ Initial indexing complete! (${totalTime}s)`)
    } catch (error) {
      clearInterval(interval)
      process.stdout.write('\r')
      throw error
    }
  } else {
    // Index exists - do incremental update
    console.log(`📂 Updating index at: ${projectPath}`)

    const startTime = Date.now()
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let spinnerIndex = 0

    const interval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      process.stdout.write(
        `\r${spinner[spinnerIndex]} Checking for changes... (${elapsed}s)`
      )
      spinnerIndex = (spinnerIndex + 1) % spinner.length
    }, 100)

    try {
      const hadChanges = await service.updateIndex()
      clearInterval(interval)
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      process.stdout.write('\r')
      console.log(`✨ Index updated! (${totalTime}s)`)
    } catch (error) {
      clearInterval(interval)
      process.stdout.write('\r')
      throw error
    }
  }
}

async function handleGroupSearch(
  service: SemanticService,
  projectPath: string,
  groupName: string,
  conceptGroup: string[],
  args: string[]
) {
  // Load index
  process.stdout.write('📚 Loading semantic index...')
  const loaded = await service.loadIndex(projectPath)
  if (!loaded) {
    process.stdout.write(' not found\n')
    console.log('🔨 Building new index...')
    await handleIndex(service, projectPath)
  } else {
    process.stdout.write(' ✓\n')
  }

  // Parse additional options (filters, sorting, etc.)
  let typeFilter: Partial<SemanticInfo['type'][]> | undefined
  let fileFilter: string[] | undefined
  let maxResults = 50
  let sortBy: 'relevance' | 'usage' | 'name' | 'file' = 'relevance'
  let outputFormat: 'pretty' | 'json' | 'compact' | 'human' | 'claude' = 'claude'
  let showContext = true

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--type' && args[i + 1]) {
      typeFilter = args[++i].split(',') as unknown as Partial<
        SemanticInfo['type'][]
      >
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
    } else if (arg === '--human') {
      outputFormat = 'human'
    } else if (arg === '--no-context') {
      showContext = false
    } else if (arg === '--full') {
      outputFormat = 'pretty' // Full detailed output
    }
  }

  // Search using the concept group
  process.stdout.write(`🔍 Searching concept group "${groupName}"...`)
  let results = await service.searchGroup(conceptGroup)
  process.stdout.write(' ✓\n')

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
    case 'human':
      displayGroupResults(groupName, conceptGroup, results, showContext)
      break
    case 'claude':
      // Compact mode for Claudes (default)
      const compactGen = new CompactSummaryGenerator()
      console.log(compactGen.generate(`group:${groupName}`, results))
      break
    case 'pretty':
      // Full detailed output (when --full is used)
      displayResultsForClaude(`group:${groupName}`, results, conceptGroup, {
        humanMode: false,
        showContext,
        showFullPaths: true,
        showAllReferences: true,
        showRelevanceScores: true,
        showLanguageInfo: true,
        showMetadata: true,
        typeFilter,
        fileFilter,
      })
      break
    default:
      // Should not reach here, but use compact as fallback
      const fallbackGen = new CompactSummaryGenerator()
      console.log(fallbackGen.generate(`group:${groupName}`, results))
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
  process.stdout.write(`🔍 Analyzing references to "${term}"...`)
  const analysis = await service.getImpactAnalysis(term)
  process.stdout.write(' ✓\n')

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
  let typeFilter: Partial<SemanticInfo['type'][]> | undefined
  let fileFilter: string[] | undefined
  let maxResults = 50
  let searchMode: 'fuzzy' | 'exact' | 'regex' = 'fuzzy'
  let showContext = true
  let sortBy: 'relevance' | 'usage' | 'name' | 'file' = 'relevance'
  let outputFormat: 'pretty' | 'json' | 'compact' | 'human' | 'claude' =
    'claude'
  let fullOutput = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--type' && args[i + 1]) {
      typeFilter = args[++i].split(',') as unknown as Partial<
        SemanticInfo['type'][]
      >
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
    } else if (arg === '--human') {
      outputFormat = 'human'
    } else if (arg === '--full') {
      fullOutput = true
      outputFormat = 'pretty' // Use the current detailed format
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

  // Check for multi-word search (spaces but not special operators)
  const hasSpaces =
    query.includes(' ') &&
    !query.includes('|') &&
    !query.includes('&') &&
    !query.startsWith('!') &&
    !query.startsWith('/')

  if (hasSpaces) {
    // Multi-word search: Try AND first, then OR
    const words = query.split(/\s+/).filter((w) => w.length > 0)

    if (words.length > 1) {
      process.stdout.write(
        `🔍 Searching for all terms: ${words.join(' AND ')}...`
      )

      // First try AND search (all words must match)
      results = await searchWithAnd(service, words, {
        type: typeFilter,
        files: fileFilter,
        maxResults: maxResults * 2, // Get more results for filtering
      })

      process.stdout.write(' ✓\n')

      if (results.length === 0) {
        // Fall back to OR search
        console.log(`\n💡 No results with all terms. Searching for any term...`)
        results = await service.searchGroup(words)

        if (results.length > 0) {
          console.log(
            `✨ Found ${results.length} results with partial matches!\n`
          )
        }
      } else {
        console.log(
          `✅ Found ${results.length} results containing all terms!\n`
        )
      }
    } else {
      // Single word after trimming - fall through to normal search
      query = words[0]
    }
  }

  // Note: Concept groups are now handled by the 'group' command
  if (!hasSpaces && query.includes('|')) {
    // OR pattern: term1|term2|term3
    const terms = query.split('|').map((t) => t.trim())
    process.stdout.write(`🔍 Searching for any of: ${terms.join(', ')}...`)
    results = await service.searchGroup(terms)
    process.stdout.write(' ✓\n')
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
    process.stdout.write(`🔍 Searching for "${query}"...`)
    results = await service.search(query, {
      type: typeFilter,
      files: fileFilter,
      maxResults,
      exact: searchMode === 'exact',
    })
    process.stdout.write(' ✓\n')

    // If no results, try fallback strategies
    if (results.length === 0 && !searchMode) {
      const groups = getAvailableGroups(projectPath)

      // Priority 1: Try smart term splitting FIRST (most relevant to original query)
      if (canSmartSplit(query)) {
        console.log(`\n💡 No exact matches. Trying smart term splitting...`)
        const splitTerms = smartSplitTerms(query)

        if (splitTerms.length > 1) {
          console.log(`   Searching for: ${splitTerms.join(' OR ')}\n`)
          results = await service.searchGroup(splitTerms)

          if (results.length > 0) {
            console.log(
              `✨ Found ${results.length} results using split terms!\n`
            )

            // Note if any split term is also a concept group (but don't search it yet)
            const matchingGroups: typeof groups = []
            for (const term of splitTerms) {
              const termGroup = groups.find(
                (g) => g.name.toLowerCase() === term.toLowerCase()
              )
              if (termGroup) {
                console.log(
                  `   🎯 Note: "${term}" is also a concept group (${termGroup.emoji} ${termGroup.description})`
                )
                matchingGroups.push(termGroup)
              }
            }
          }
        }
      }

      // Priority 2: If still no results, check if query matches a concept group
      if (results.length === 0) {
        const matchingGroup = groups.find(
          (g) => g.name.toLowerCase() === query.toLowerCase()
        )

        if (matchingGroup) {
          console.log(
            `\n🎯 Still no matches, but "${query}" is a concept group!`
          )
          console.log(
            `   Using group search for: ${matchingGroup.emoji} ${matchingGroup.description}\n`
          )
          results = await service.searchGroup(matchingGroup.terms)

          if (results.length > 0) {
            console.log(
              `✨ Found ${results.length} results using ${matchingGroup.name} group!\n`
            )
          }
        }
      }

      // Priority 3: If STILL no results, try concept groups for split terms
      if (results.length === 0 && canSmartSplit(query)) {
        const splitTerms = smartSplitTerms(query)
        const groupTerms: string[] = []

        for (const term of splitTerms) {
          const termGroup = groups.find(
            (g) => g.name.toLowerCase() === term.toLowerCase()
          )
          if (termGroup) {
            console.log(
              `\n🎯 Last resort: "${term}" matches concept group ${termGroup.emoji} ${termGroup.description}`
            )
            groupTerms.push(...termGroup.terms)
          }
        }

        if (groupTerms.length > 0) {
          console.log(`   Searching concept group terms...\n`)
          results = await service.searchGroup([...new Set(groupTerms)]) // Remove duplicates

          if (results.length > 0) {
            console.log(
              `✨ Found ${results.length} results using concept groups for split terms!\n`
            )
          }
        }
      }
    }
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
    case 'human':
      displayResults(query, results, undefined, showContext)
      break
    case 'claude':
      // New compact mode for Claudes (default)
      // Try to get story context if available
      let story
      try {
        story = await service.getStoryForTerm(query)
      } catch {
        // Ignore story errors, continue without it
      }

      const compactGen = new CompactSummaryGenerator({ story })
      console.log(compactGen.generate(query, results))
      break
    case 'pretty':
      // Full detailed output (when --full is used)
      displayResultsForClaude(query, results, undefined, {
        humanMode: false,
        showContext,
        showFullPaths: true,
        showAllReferences: true,
        showRelevanceScores: true,
        showLanguageInfo: true,
        showMetadata: true,
        searchMode,
        typeFilter,
        fileFilter,
        // Track if we used a fallback strategy
        fallbackUsed:
          results.length > 0 &&
          searchMode === 'fuzzy' &&
          (canSmartSplit(query) ||
            getAvailableGroups(projectPath).some(
              (g) => g.name.toLowerCase() === query.toLowerCase()
            ))
            ? 'split'
            : undefined,
      })
      break
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
          if (result.usageCount && result.usageCount > 3) {
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

async function handleChangesImpact(
  service: SemanticService,
  projectPath: string,
  args: string[]
) {
  const isCompact = args.includes('--compact') || args.includes('-c')

  // Load index first
  if (!isCompact) {
    process.stdout.write('📚 Loading semantic index...')
  }
  const loaded = await service.loadIndex(projectPath)
  if (!loaded) {
    if (!isCompact) {
      process.stdout.write(' not found\n')
      console.log('🔨 Building new index...')
    }
    await handleIndex(service, projectPath)
  } else if (!isCompact) {
    process.stdout.write(' ✓\n')
  }

  // Get git changes
  try {
    // Get changed files with status
    const stagedRaw = execSync('git diff --cached --name-status', {
      cwd: projectPath,
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)

    const unstagedRaw = execSync('git diff --name-status', {
      cwd: projectPath,
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)

    // Parse file changes with their status
    const parseChanges = (lines: string[]) =>
      lines.map((line) => {
        const [status, ...pathParts] = line.split('\t')
        return {
          status: status[0] as 'M' | 'A' | 'D' | 'R',
          path: pathParts[0],
        }
      })

    const staged = parseChanges(stagedRaw)
    const unstaged = parseChanges(unstagedRaw)

    // Combine and deduplicate
    const allChangesMap = new Map<
      string,
      { status: 'M' | 'A' | 'D' | 'R'; path: string }
    >()
    staged.forEach((change) => {
      allChangesMap.set(change.path, change)
    })
    unstaged.forEach((change) => {
      if (!allChangesMap.has(change.path)) {
        allChangesMap.set(change.path, change)
      }
    })
    const allChanged = Array.from(allChangesMap.values())

    if (allChanged.length === 0) {
      if (!isCompact) {
        console.log('\n✨ No changes in working directory')
      }
      return
    }

    // Get branch info
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectPath,
      encoding: 'utf-8',
    }).trim()

    if (!isCompact) {
      console.log(`\n📊 Changes Impact Analysis`)
      console.log(`📍 Branch: ${branch}`)
      console.log(
        `📝 Status: ${staged.length} staged, ${unstaged.length} unstaged\n`
      )
    }

    // Analyze each changed file
    let totalImpact = 0
    const highImpactSymbols: {
      symbol: string
      file: string
      uses: number
      refs?: any[]
    }[] = []
    const impactedFiles = new Set<string>()

    for (const change of allChanged) {
      // Skip deleted files
      if (change.status === 'D') {
        if (!isCompact) {
          console.log(`🗑️  ${change.path} (deleted)`)
        }
        continue
      }

      // Get exported symbols from this file
      const symbols = await service.search('', {
        files: [change.path],
        type: ['function', 'class', 'interface'], // Skip generic variables
        maxResults: 100,
      })

      // Filter and deduplicate symbols
      const symbolMap = new Map<string, (typeof symbols)[0]>()
      symbols.forEach((s) => {
        // Skip generic names and duplicates
        if (
          s.info.term.length > 2 &&
          !['file', 'path', 'data', 'value', 'result', 'item'].includes(
            s.info.term
          )
        ) {
          const existing = symbolMap.get(s.info.term)
          if (!existing || (s.usageCount || 0) > (existing.usageCount || 0)) {
            symbolMap.set(s.info.term, s)
          }
        }
      })

      // Find high-impact symbols (with usage)
      const impactful = Array.from(symbolMap.values())
        .filter((s) => s.usageCount && s.usageCount > 0)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))

      if (impactful.length > 0 && !isCompact) {
        const statusIcon = change.status === 'A' ? '✨' : '📝'
        console.log(
          `${statusIcon} ${change.path} (${
            change.status === 'A' ? 'new' : 'modified'
          })`
        )

        // Show most-used symbols
        const toShow = impactful.slice(0, 3)
        for (const symbol of toShow) {
          const uses = symbol.usageCount || 0
          totalImpact += uses

          // Get sample references to show WHERE it's used
          if (uses >= 2) {
            const refs = await service.getImpactAnalysis(symbol.info.term)
            const externalRefs = refs.directReferences.filter(
              (ref) => ref.fromLocation.file !== change.path
            )

            externalRefs.forEach((ref) => {
              impactedFiles.add(ref.fromLocation.file)
            })

            console.log(
              `   ${getTypeIcon(symbol.info.type)} ${
                symbol.info.term
              } (${uses} refs)`
            )

            // Show EXACTLY where it's used - this is what Claudes need!
            if (uses <= 5) {
              // Show all references if there are few
              externalRefs.forEach((ref) => {
                const shortPath = ref.fromLocation.file.replace(
                  projectPath + '/',
                  ''
                )
                console.log(
                  `      ↳ ${shortPath}:${ref.fromLocation.line} (${ref.referenceType})`
                )
              })
            } else {
              // Show first 3 for high-use symbols
              externalRefs.slice(0, 3).forEach((ref) => {
                const shortPath = ref.fromLocation.file.replace(
                  projectPath + '/',
                  ''
                )
                console.log(
                  `      ↳ ${shortPath}:${ref.fromLocation.line} (${ref.referenceType})`
                )
              })
              console.log(`      ↳ ... and ${externalRefs.length - 3} more`)
            }

            if (uses > 5) {
              highImpactSymbols.push({
                symbol: symbol.info.term,
                file: change.path,
                uses,
                refs: externalRefs.slice(0, 5), // Keep some refs for summary
              })
            }
          }
        }

        // Add remaining count if significant
        const remaining = impactful
          .slice(3)
          .filter((s) => (s.usageCount || 0) >= 2)
        if (remaining.length > 0) {
          const remainingUses = remaining.reduce(
            (sum, s) => sum + (s.usageCount || 0),
            0
          )
          totalImpact += remainingUses
          console.log(
            `   ... +${remaining.length} more (${remainingUses} refs)`
          )
        }
        console.log('')
      } else if (impactful.length > 0 && isCompact) {
        // Still count for compact mode
        impactful.forEach((s) => {
          totalImpact += s.usageCount || 0
          if ((s.usageCount || 0) > 5) {
            highImpactSymbols.push({
              symbol: s.info.term,
              file: change.path,
              uses: s.usageCount || 0,
            })
          }
        })
      }
    }

    // Compact mode - actionable one-liner risk assessment
    if (isCompact) {
      if (totalImpact === 0) {
        console.log(
          `✅ ${branch}: ${allChanged.length} files | No external impact - safe to commit`
        )
      } else if (totalImpact < 10) {
        console.log(
          `🟡 ${branch}: ${
            allChanged.length
          } files → ${totalImpact} refs | Low impact - review: ${highImpactSymbols
            .map((s) => s.symbol)
            .join(', ')}`
        )
      } else if (totalImpact < 50) {
        console.log(
          `🟠 ${branch}: ${allChanged.length} files → ${totalImpact} refs in ${impactedFiles.size} files | Medium impact - test carefully`
        )
      } else {
        const topSymbol = highImpactSymbols[0]
        console.log(
          `🔴 ${branch}: ${allChanged.length} files → ${totalImpact} refs | HIGH IMPACT - ${topSymbol?.symbol} has ${topSymbol?.uses} refs!`
        )
      }
      return
    }

    // Regular mode - Claude-optimized output

    // Risk assessment
    const riskLevel =
      totalImpact === 0
        ? 'None'
        : totalImpact < 10
        ? 'Low'
        : totalImpact < 50
        ? 'Medium'
        : 'High'
    const riskIcon =
      totalImpact === 0
        ? '✅'
        : totalImpact < 10
        ? '🟡'
        : totalImpact < 50
        ? '🟠'
        : '🔴'

    console.log(`\n${riskIcon} Risk Level: ${riskLevel}`)
    console.log(
      `📊 ${allChanged.length} files changed → ${totalImpact} references across ${impactedFiles.size} files`
    )

    // For Claudes: Show CRITICAL breaking changes first
    const deletedFiles = allChanged.filter((c) => c.status === 'D')
    if (deletedFiles.length > 0) {
      console.log(`\n🚨 DELETED FILES - Check these aren't still imported:`)
      deletedFiles.forEach(({ path }) => {
        console.log(`   ${path}`)
      })
    }

    // Show test files that need to run
    const testFiles = Array.from(impactedFiles).filter(
      (f) => f.includes('test') || f.includes('spec')
    )
    if (testFiles.length > 0) {
      console.log(`\n🧪 Tests to run:`)
      testFiles.slice(0, 5).forEach((file) => {
        const shortPath = file.replace(projectPath + '/', '')
        console.log(`   bun test ${shortPath}`)
      })
    }

    if (impactedFiles.size > 0) {
      // Group affected files by directory
      const filesByDir = new Map<string, string[]>()
      Array.from(impactedFiles).forEach((file) => {
        const dir = file.substring(0, file.lastIndexOf('/'))
        if (!filesByDir.has(dir)) {
          filesByDir.set(dir, [])
        }
        filesByDir.get(dir)!.push(file)
      })

      console.log(`\n📁 Affected areas:`)
      Array.from(filesByDir.entries())
        .slice(0, 3)
        .forEach(([dir, files]) => {
          console.log(`   ${dir}/ (${files.length} files)`)
        })
    }

    // What to check before committing - this is what Claudes need!
    console.log(`\n⚡ Before committing, check:`)

    if (totalImpact === 0) {
      console.log(`   ✅ No external consumers - commit freely!`)
    } else {
      // Show the most important files to check
      const criticalFiles = Array.from(impactedFiles)
        .filter((f) => !f.includes('test') && !f.includes('spec'))
        .slice(0, 3)

      if (criticalFiles.length > 0) {
        console.log(`   📍 Key files using your changes:`)
        criticalFiles.forEach((file) => {
          const shortPath = file.replace(projectPath + '/', '')
          console.log(`      ${shortPath}`)
        })
      }

      // Specific things to verify
      if (highImpactSymbols.length > 0) {
        const topSymbol = highImpactSymbols[0]
        console.log(
          `   🔍 Verify: "${topSymbol.symbol}" still works correctly in its ${topSymbol.uses} usages`
        )
      }

      // Quick command to see details
      if (totalImpact > 20) {
        console.log(
          `   📋 For full details: smartgrep refs "${highImpactSymbols[0]?.symbol}"`
        )
      }
    }
  } catch (error: any) {
    if (error.message.includes('not a git repository')) {
      console.error('❌ Not in a git repository')
    } else {
      console.error(`❌ Git error: ${error.message}`)
    }
    process.exit(1)
  }
}

// REMOVED: Flow command handler
// Kept for potential future use but not exposed in CLI
/*
async function handleFlow(service: SemanticService, searchTerm: string) {
  // Load the index first
  const projectPath = process.cwd()
  const loaded = await service.loadIndex(projectPath)
  if (!loaded) {
    console.log('No semantic index found. Building...')
    await service.indexCodebase(projectPath)
  }

  console.log(`🌊 Tracing data flow for "${searchTerm}"...\n`)

  try {
    // Create flow tracer with the service's index
    const tracer = new FlowTracer(service.getIndex())

    // Trace the flow
    const flowPath = await tracer.traceFlow(searchTerm)

    if (flowPath.nodes.length === 0) {
      console.log(`❌ No occurrences of "${searchTerm}" found`)
      console.log('\n💡 Tips:')
      console.log(
        '  • Try a more specific term (e.g., "user.email" instead of "email")'
      )
      console.log(
        '  • Check if the term exists with: smartgrep "' + searchTerm + '"'
      )
      return
    }

    // Display the flow path
    console.log(tracer.formatFlowPath(flowPath))

    // Suggest related searches
    if (flowPath.summary.functionsInvolved.length > 0) {
      console.log('\n💡 Related searches:')
      const topFunctions = flowPath.summary.functionsInvolved.slice(0, 3)
      topFunctions.forEach((func) => {
        console.log(
          `  smartgrep refs "${func}"  # See all references to this function`
        )
      })
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error tracing flow: ${error.message}`)
      process.exit(1)
    }
  }
}
*/

// REMOVED: Story command handler
// Kept for potential future use but not exposed in CLI
/*
async function handleStory(service: SemanticService, projectPath: string) {
  console.log('📖 Extracting codebase story...\n')

  // Ensure index is up to date
  const updated = await service.updateIndex()
  if (updated) {
    console.log('✅ Index updated with latest changes\n')
  }

  try {
    // Extract story
    const story = await service.extractStory()

    // Display story
    const display = new StoryDisplay()
    display.displayStory(story)
  } catch (error: any) {
    console.error(`❌ Error extracting story: ${error.message}`)
    process.exit(1)
  }
}
*/

function showHelp() {
  console.log(`
🔍 Smart Grep - Semantic Code Search with Cross-References

Usage:
  smartgrep <query>                Search for a term or pattern
  smartgrep --index                Rebuild the semantic index
  smartgrep refs <term>            Show where a term is referenced
  smartgrep changes                Analyze impact of your uncommitted changes

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
  --human            Simplified output for human readers
  --full             Show full detailed results (default: compact summary)

📊 Information Displayed:
  DEFAULT (Compact Summary - Claude-Optimized):
  • Primary definition with signature (constructor/params)
  • Top 3 usage locations with code context
  • Breaking changes - what calls this code
  • Patterns detected (async, errors, related terms)
  • Smart next search suggestions
  
  WITH --full FLAG (Complete Details):
  • ALL usage locations and cross-references
  • Full surrounding code context
  • All related terms and metadata
  • Relationship graphs and statistics
  
  Use --human for human-friendly format
  Use --json for machine-readable output

🏷️ Concept Groups:
  smartgrep group auth        Authentication & security patterns
  smartgrep group service     Service classes and patterns
  smartgrep group error       Error handling patterns
  ...and more! Use "smartgrep group list" to see all available groups

🎨 Custom Groups:
  smartgrep group add payments charge,bill,invoice,transaction
  smartgrep group payments --type function    # Search your custom group
  smartgrep group remove payments             # Remove when no longer needed
  
  Why this is AMAZING: Define your project's vocabulary ONCE!
  After adding "payments" group, just type: smartgrep group payments
  Finds ALL payment code - no more guessing "was it charge or billing or invoice?"

💡 Examples:
  smartgrep "authenticateUser"                  # Find function with usage info
  smartgrep "addCrossReference|getReferences"   # Find any of these functions
  smartgrep "error&string"                      # Find error-related strings
  smartgrep "!test" --type function             # Functions not containing 'test'
  smartgrep "/add.*Reference/" --regex          # Regex pattern search
  smartgrep group auth --sort usage             # Auth code sorted by usage
  smartgrep "CuratorService" --json             # Machine-readable output
  smartgrep refs "processPayment"               # Full impact analysis
  smartgrep changes                             # Analyze uncommitted changes impact
  smartgrep changes --compact                   # One-line risk assessment
  smartgrep group service --type class --max 10 # Top 10 service classes
  smartgrep group add api endpoint,route,handler,controller  # Add custom group
  
  # Framework searches (IMPORTANT: use single quotes for $ symbols!)
  smartgrep '$state' --file "*.svelte"          # Svelte 5 runes
  smartgrep 'onMount' --file "*.svelte"         # Svelte lifecycle
  smartgrep 'defineProps' --file "*.vue"        # Vue composition API
  smartgrep '{#if' --file "*.svelte"            # Svelte directives

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

// Helper function to check if a term can be smart split
function canSmartSplit(term: string): boolean {
  // Check for camelCase
  if (/[a-z][A-Z]/.test(term)) return true
  // Check for snake_case or kebab-case
  if (/[_-]/.test(term)) return true
  // Check for dots (namespaced items)
  if (/\./.test(term) && !term.startsWith('.')) return true

  return false
}

// Smart split terms for camelCase, snake_case, kebab-case
function smartSplitTerms(term: string): string[] {
  const parts: string[] = []

  // Split camelCase
  let camelSplit = term.replace(/([a-z])([A-Z])/g, '$1|$2')

  // Split snake_case and kebab-case
  camelSplit = camelSplit.replace(/[_-]/g, '|')

  // Split dots (but not file extensions)
  camelSplit = camelSplit.replace(/\.(?![a-z]{2,4}$)/g, '|')

  // Split into parts and clean up
  const rawParts = camelSplit.split('|')
  for (const part of rawParts) {
    const cleaned = part.trim().toLowerCase()
    if (cleaned && cleaned.length > 1) {
      parts.push(cleaned)
    }
  }

  // Remove duplicates
  return [...new Set(parts)]
}

// Helper function to get all available groups
function getAvailableGroups(projectPath: string): ConceptGroupDefinition[] {
  const config = loadConfig(projectPath)
  const customGroups = parseCustomGroups(config.customGroups || {})

  // Combine default and custom groups
  const allGroups = { ...DEFAULT_CONCEPT_GROUPS, ...customGroups }

  // Return as array
  return Object.values(allGroups)
}

// Run the CLI
main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
