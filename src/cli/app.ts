#!/usr/bin/env bun

/**
 * Codebase Curator CLI - Thin presentation layer
 * Uses the core curator service for all functionality
 */

import { createCuratorService } from '../core'
import { resolve, join } from 'path'
import { existsSync, mkdirSync } from 'fs'

interface CLIArgs {
  path: string
  command: 'overview' | 'ask' | 'feature' | 'change'
  output?: 'json' | 'summary' | 'detailed'
  help?: boolean
  question?: string
  feature?: string
  change?: string
  newSession?: boolean
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const result: CLIArgs = {
    path: '',
    command: 'overview',
    output: 'summary',
    help: false,
    question: '',
    feature: '',
    change: '',
    newSession: false,
  }

  // First, extract all flags and options
  const positionalArgs: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg.startsWith('-')) {
      // Handle flags and options
      switch (arg) {
        case '-h':
        case '--help':
          result.help = true
          break
        case '-o':
        case '--output':
          const format = args[++i]
          if (
            format === 'json' ||
            format === 'summary' ||
            format === 'detailed'
          ) {
            result.output = format
          }
          break
        case '-q':
        case '--question':
          const question = args[++i]
          result.question = question
          break
        case '-f':
        case '--feature':
          const feature = args[++i]
          result.feature = feature
          break
        case '-c':
        case '--change':
          const change = args[++i]
          result.change = change
          break
        case '--new-session':
          result.newSession = true
          break
      }
    } else {
      // Collect positional arguments
      positionalArgs.push(arg)
    }
  }

  // Now parse positional arguments based on expected format: <command> <path> [extra args]
  if (positionalArgs.length > 0) {
    // First positional arg could be command or path
    const firstArg = positionalArgs[0]

    if (isValidCommand(firstArg)) {
      // Format: <command> <path> [extra args]
      result.command = firstArg as CLIArgs['command']

      if (positionalArgs.length > 1) {
        result.path = positionalArgs[1]

        // For curator commands, handle additional arguments
        if (
          ['ask', 'feature', 'change'].includes(result.command) &&
          positionalArgs.length > 2
        ) {
          const input = positionalArgs.slice(2).join(' ')
          if (result.command === 'ask') result.question = input
          else if (result.command === 'feature') result.feature = input
          else if (result.command === 'change') result.change = input
        }
      }
    } else {
      // Format: <path> (command defaults to 'all')
      result.path = firstArg
    }
  }

  // Debug
  if (process.env.DEBUG_ARGS) {
    console.error('DEBUG parseArgs result:', result)
  }

  return result
}

function isValidCommand(cmd: string): boolean {
  return ['ask', 'feature', 'change'].includes(cmd)
}

function showHelp() {
  console.log(`
🤖 Codebase Curator CLI - v2.3

Usage: codebase-curator <command> <path> [options]

Curator Commands:
  ask          Ask the curator a question about the codebase
  feature      Get guidance for adding a new feature
  change       Get guidance for implementing a change/fix

Options:
  -o, --output <format>  Output format: json, summary (default), or detailed
  --new-session         Start a new curator session (for ask command)
  -h, --help            Show this help message

Examples:
  # Curator commands
  codebase-curator ask ./my-project "How does authentication work?"
  codebase-curator feature ./my-project "Add user profile management"
  codebase-curator change ./my-project "Fix memory leak in data processing"
`)
}

async function saveToCurator(
  result: any,
  command: string,
  projectPath: string
) {
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
  const curator = createCuratorService({})

  try {
    await curator.initialize()

    console.log(`🔍 Analyzing ${resolvedPath}...`)

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
