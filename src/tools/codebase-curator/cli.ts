#!/usr/bin/env bun

/**
 * Codebase Curator CLI - Human-friendly interface
 * Provides conversational AI assistance for codebase understanding
 */

import { createCuratorService } from '../../services/curator/CuratorService'
import { resolve, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import * as readline from 'readline'

interface CLIArgs {
  path: string
  command:
    | 'overview'
    | 'ask'
    | 'feature'
    | 'change'
    | 'chat'
    | 'memory'
    | 'clear'
  output?: 'json' | 'summary' | 'detailed'
  help?: boolean
  question?: string
  feature?: string
  change?: string
  newSession?: boolean
  interactive?: boolean
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
      // Format: <command> [path] [extra args]
      result.command = firstArg as CLIArgs['command']

      if (positionalArgs.length > 1) {
        // Check if second arg is a path or part of the command input
        const secondArg = positionalArgs[1]

        // If it looks like a path (starts with ./ or / or exists as directory)
        if (
          secondArg.startsWith('./') ||
          secondArg.startsWith('/') ||
          existsSync(secondArg)
        ) {
          result.path = secondArg
          // Remaining args are the input
          if (positionalArgs.length > 2) {
            const input = positionalArgs.slice(2).join(' ')
            if (result.command === 'ask') result.question = input
            else if (result.command === 'feature') result.feature = input
            else if (result.command === 'change') result.change = input
          }
        } else {
          // No path specified, use current directory and all args are input
          result.path = process.cwd()
          const input = positionalArgs.slice(1).join(' ')
          if (result.command === 'ask') result.question = input
          else if (result.command === 'feature') result.feature = input
          else if (result.command === 'change') result.change = input
        }
      } else {
        // No additional args, use current directory
        result.path = process.cwd()
      }
    } else {
      // First arg is not a command, assume it's a path
      result.path = firstArg
      // Default command based on remaining args
      if (positionalArgs.length === 1) {
        result.command = 'overview'
      }
    }
  }

  // Debug
  if (process.env.DEBUG_ARGS) {
    console.error('DEBUG parseArgs result:', result)
  }

  return result
}

function isValidCommand(cmd: string): boolean {
  return [
    'overview',
    'ask',
    'feature',
    'change',
    'chat',
    'memory',
    'clear',
  ].includes(cmd)
}

function showHelp() {
  console.log(`
🤖 Codebase Curator CLI - Your AI Codebase Assistant

Usage: curator <command> [path] [options]

Commands:
  overview     Get a comprehensive overview of the codebase architecture
  ask          Ask a specific question about the codebase
  feature      Get detailed guidance for implementing a new feature
  change       Get focused action plan for a specific change or fix
  chat         Start an interactive chat session with the curator
  memory       Show what the curator remembers about your codebase
  clear        Clear the curator's memory and start fresh

Options:
  -o, --output <format>  Output format: summary (default), detailed, or json
  --new-session         Start fresh without previous context
  -i, --interactive     Interactive mode for multi-turn conversations
  -h, --help            Show this help message

Examples:
  # Get codebase overview
  curator overview
  curator overview ./my-project
  
  # Ask questions
  curator ask "How does the authentication system work?"
  curator ask ./backend "What are the main API endpoints?"
  
  # Plan features
  curator feature "Add real-time notifications"
  curator feature ./app "Implement user profile management" --output detailed
  
  # Get implementation guidance
  curator change "Fix the memory leak in data processing"
  curator change "Refactor the payment service for better error handling"
  
  # Interactive chat
  curator chat
  curator chat ./project --new-session
  
  # Memory management
  curator memory                  # Show accumulated knowledge
  curator clear                   # Start fresh

💡 Pro Tips:
  • The curator learns from each interaction, building deeper understanding
  • Use 'chat' mode for complex discussions requiring back-and-forth
  • Output defaults to current directory if no path specified
  • Curator memory persists across sessions for better context
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

async function startInteractiveChat(
  curator: any,
  projectPath: string,
  newSession: boolean = false
) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n💬 You: ',
  })

  console.log('\n🤖 Curator Chat Session')
  console.log('═'.repeat(50))
  console.log(
    'Type your questions, "exit" to quit, or "clear" to start fresh\n'
  )

  // Get initial overview if new session
  if (newSession) {
    console.log('📊 Getting codebase overview...')
    const overview = await curator.getOverview(projectPath, true)
    console.log(
      "\n🤖 Curator: I've analyzed your codebase. Here's what I found:"
    )
    console.log(overview.slice(0, 500) + '...')
    console.log('\nFeel free to ask me anything about your code!')
  }

  rl.prompt()

  rl.on('line', async (line) => {
    const input = line.trim()

    if (input.toLowerCase() === 'exit') {
      console.log('\n👋 Thanks for chatting! Your session has been saved.')
      rl.close()
      return
    }

    if (input.toLowerCase() === 'clear') {
      await curator.clearCuratorSession({ projectPath })
      console.log('\n🧹 Session cleared! Starting fresh.')
      rl.prompt()
      return
    }

    if (input) {
      console.log('\n🤖 Curator: Let me analyze that...')
      try {
        const response = await curator.askCurator({
          question: input,
          projectPath,
          newSession: false,
        })
        console.log('\n' + response.content)
      } catch (error) {
        console.error(
          '\n❌ Error:',
          error instanceof Error ? error.message : error
        )
      }
    }

    rl.prompt()
  })

  rl.on('close', () => {
    process.exit(0)
  })
}

async function main() {
  const args = parseArgs()

  if (args.help || (!args.command && !args.path)) {
    showHelp()
    process.exit(0)
  }

  // Default to current directory if no path provided
  const projectPath = args.path || process.cwd()
  const resolvedPath = resolve(projectPath)

  if (!existsSync(resolvedPath)) {
    console.error(`❌ Error: Path "${resolvedPath}" does not exist`)
    process.exit(1)
  }

  // Create curator service
  const curator = createCuratorService({})

  try {
    await curator.initialize()

    let output: string = ''

    // Handle different commands
    switch (args.command) {
      case 'overview':
        console.log(`\n🔍 Analyzing ${resolvedPath}...\n`)
        output = await curator.getOverview(resolvedPath, args.newSession)
        console.log(output)
        break

      case 'ask':
        if (!args.question) {
          console.error('❌ Error: Please provide a question')
          console.log('\nExample: curator ask "How does authentication work?"')
          process.exit(1)
        }
        console.log(`\n🔍 Analyzing ${resolvedPath}...\n`)
        const response = await curator.askCurator({
          question: args.question,
          projectPath: resolvedPath,
          newSession: args.newSession,
        })
        console.log(response.content)
        break

      case 'feature':
        if (!args.feature) {
          console.error('❌ Error: Please provide a feature description')
          console.log('\nExample: curator feature "Add user notifications"')
          process.exit(1)
        }
        console.log(`\n🔍 Planning feature for ${resolvedPath}...\n`)
        output = await curator.addNewFeature({
          feature: args.feature,
          projectPath: resolvedPath,
        })
        console.log(output)
        break

      case 'change':
        if (!args.change) {
          console.error('❌ Error: Please provide a change description')
          console.log(
            '\nExample: curator change "Fix memory leak in data processing"'
          )
          process.exit(1)
        }
        console.log(`\n🔍 Planning change for ${resolvedPath}...\n`)
        output = await curator.implementChange({
          change: args.change,
          projectPath: resolvedPath,
        })
        console.log(output)
        break

      case 'chat':
        await startInteractiveChat(curator, resolvedPath, args.newSession)
        return // Don't cleanup, let chat handle it

      case 'memory':
        console.log(`\n🧠 Curator Memory for ${resolvedPath}\n`)
        const memory = await curator.getCuratorMemory(resolvedPath)
        console.log(memory)
        break

      case 'clear':
        console.log(`\n🧹 Clearing curator memory for ${resolvedPath}...`)
        await curator.clearSession(resolvedPath)
        console.log('✅ Memory cleared! Next interaction will start fresh.')
        break

      default:
        console.error(`❌ Unknown command: ${args.command}`)
        showHelp()
        process.exit(1)
    }

    // Save output if requested
    if (output && args.output === 'json') {
      const saved = await saveToCurator(
        {
          data: output,
          command: args.command,
          timestamp: new Date().toISOString(),
        },
        args.command,
        resolvedPath
      )
      console.log(`\n💾 Output saved to: ${saved}`)
    }

    await curator.cleanup()
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
