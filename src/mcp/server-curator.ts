import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import path from 'path'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
} from 'fs'
import { spawn, execSync } from 'child_process'

import { ImportMapper } from '../algorithms/importMapper'
import { FrameworkDetector } from '../algorithms/frameworkDetector'
import { FileOrganizationAnalyzer } from '../algorithms/fileOrganizationAnalyzer'
import { PatternAggregator } from '../algorithms/patternAggregator'
import { CodeSimilarityAnalyzer } from '../algorithms/codeSimilarityAnalyzer'
import { ContextManager } from '../services/contextManager'

// Environment variable for default project path
const DEFAULT_PROJECT_PATH = process.env.CODEBASE_CURATOR_PATH || process.cwd()

// Path to the codebase-curator installation
const CURATOR_TOOL_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..'
)

// Find Claude CLI executable
let CLAUDE_CLI_PATH = 'claude' // Default to PATH lookup

// Try to find Claude CLI in common locations
const homeDir = process.env.HOME || process.env.USERPROFILE || ''
const claudePaths = [
  path.join(homeDir, '.claude/local/claude'), // User-agnostic path
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
  'C:\\Program Files\\Claude\\claude.exe', // Windows
  process.env.CLAUDE_CLI_PATH, // Allow override via env var
].filter(Boolean)

for (const claudePath of claudePaths) {
  if (claudePath && existsSync(claudePath)) {
    CLAUDE_CLI_PATH = claudePath
    break
  }
}

// Find Node.js executable
let NODE_PATH = 'node' // Default to PATH lookup

// Try to find Node in common locations
const nodePaths = [
  process.env.NODE_PATH_BINARY, // Allow override via env var - check this first
]

// Check fnm installations
try {
  const fnmPath = path.join(homeDir, '.local/share/fnm/node-versions')
  if (existsSync(fnmPath)) {
    const fnmVersions = readdirSync(fnmPath)
      .map((v) => path.join(fnmPath, v, 'installation/bin/node'))
      .filter(existsSync)
    nodePaths.push(...fnmVersions)
  }
} catch (e) {}

// Check nvm installations
try {
  const nvmPath = path.join(homeDir, '.nvm/versions/node')
  if (existsSync(nvmPath)) {
    const nvmVersions = readdirSync(nvmPath)
      .map((v) => path.join(nvmPath, v, 'bin/node'))
      .filter(existsSync)
    nodePaths.push(...nvmVersions)
  }
} catch (e) {}

// Add system-wide installations
nodePaths.push(
  '/usr/local/bin/node',
  '/usr/bin/node',
  '/opt/homebrew/bin/node',
  'C:\\Program Files\\nodejs\\node.exe', // Windows
  'C:\\Program Files (x86)\\nodejs\\node.exe' // Windows 32-bit
)

for (const nodePath of nodePaths) {
  if (nodePath && existsSync(nodePath)) {
    NODE_PATH = nodePath
    break
  }
}

// Store session IDs per project path
const curatorSessions: Map<string, string> = new Map()

// Global context manager instance for caching
const contextManager = new ContextManager({
  ttl: 3600000, // 1 hour cache
  maxSize: 200, // 200MB max cache
  compressionEnabled: true,
})

// Check Claude CLI availability once at startup
let IS_CLAUDE_CLI_AVAILABLE = false

function checkClaudeCLI(): boolean {
  try {
    // For now, skip the version check that's causing issues
    // Just check if the path exists
    console.error(`[Claude CLI] Checking path: ${CLAUDE_CLI_PATH}`)
    if (existsSync(CLAUDE_CLI_PATH)) {
      console.error(`[Claude CLI] Found at: ${CLAUDE_CLI_PATH}`)
      return true // Skip version check
    }
    console.error(`[Claude CLI] Not found at: ${CLAUDE_CLI_PATH}`)
    return false
  } catch (e) {
    console.error(`[Claude CLI] Error checking:`, e)
    return false
  }
}

// Helper to resolve project path
function resolveProjectPath(inputPath?: string): string {
  if (!inputPath) {
    return DEFAULT_PROJECT_PATH
  }
  if (!path.isAbsolute(inputPath)) {
    return path.resolve(DEFAULT_PROJECT_PATH, inputPath)
  }
  return inputPath
}

// Get safe curator directory (handles permission issues in MCP environment)
function getSafeCuratorDir(projectPath: string): string {
  // First try project-local .curator directory
  const projectCuratorDir = path.join(projectPath, '.curator')
  try {
    if (!existsSync(projectCuratorDir)) {
      mkdirSync(projectCuratorDir, { recursive: true })
    }
    // Test if we can write
    const testFile = path.join(projectCuratorDir, '.test')
    writeFileSync(testFile, 'test')
    unlinkSync(testFile)
    return projectCuratorDir
  } catch (error) {
    // Fallback to home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || ''
    const safeName = projectPath.replace(/[^a-zA-Z0-9]/g, '_')
    const fallbackDir = path.join(homeDir, '.codebase-curator', 'projects', safeName)
    
    try {
      if (!existsSync(fallbackDir)) {
        mkdirSync(fallbackDir, { recursive: true })
      }
      return fallbackDir
    } catch (err) {
      console.error(`[Curator] Cannot create curator directory:`, err)
      throw new Error('Cannot create curator directory. Check permissions.')
    }
  }
}

// Get or create curator session file
function getCuratorSessionFile(projectPath: string): string {
  const curatorDir = getSafeCuratorDir(projectPath)
  return path.join(curatorDir, 'session.txt')
}

// Run initial analysis to get codebase overview
async function getCodebaseOverview(projectPath: string) {
  const [imports, frameworks, organization, patterns] = await Promise.all([
    new ImportMapper(projectPath).analyze().catch(() => null),
    new FrameworkDetector(projectPath).detect().catch(() => null),
    new FileOrganizationAnalyzer(projectPath).analyze().catch(() => null),
    new PatternAggregator(projectPath).analyze().catch(() => null),
  ])

  return {
    projectPath,
    imports: imports?.summary || null,
    frameworks: frameworks?.summary || null,
    organization: organization?.patterns || null,
    patterns: patterns?.statistics || null,
  }
}

// Create a concise summary for the initial prompt to avoid truncation
function createConciseSummary(overview: any): string {
  const summary = {
    projectPath: overview.projectPath,
    stats: {
      totalFiles: overview.imports?.totalFiles || 0,
      externalDeps: overview.imports?.externalDependencies || 0,
      internalImports: overview.imports?.internalImports || 0,
    },
    tech: {
      frameworks:
        overview.frameworks?.frameworks?.slice(0, 3).map((f: any) => f.name) ||
        [],
      languages: overview.frameworks?.languages?.slice(0, 3) || [],
      buildTools: overview.frameworks?.buildTools?.slice(0, 3) || [],
    },
    structure: {
      topFolders:
        overview.organization?.structure?.topLevelDirs?.slice(0, 5) || [],
      depth: overview.organization?.structure?.depth || 0,
    },
  }

  return JSON.stringify(summary, null, 2)
}

// Parse streaming JSON output
function parseStreamingJSON(output: string): any {
  const lines = output.trim().split('\n')
  let result = null
  let lastAssistantMessage = null
  let errorMessage = null

  for (const line of lines) {
    try {
      const json = JSON.parse(line)
      if (json.type === 'result') {
        // Handle both success and error results
        if (json.subtype === 'error_max_turns') {
          errorMessage =
            'Curator reached maximum conversation turns. Try asking a more specific question.'
        } else if (json.result) {
          result = json.result
        }
      } else if (json.type === 'assistant' && json.message) {
        // Handle the nested message structure
        const msg = json.message
        if (msg.content && msg.content.length > 0) {
          const textContent = msg.content.find((c: any) => c.type === 'text')
          if (textContent) {
            lastAssistantMessage = textContent.text
          }
        }
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  // Return error message if we hit an error, otherwise result or last message
  return errorMessage || result || lastAssistantMessage
}

// Spawn a curator Claude instance for overview
async function spawnCuratorForOverview(projectPath: string): Promise<string> {
  // Always start fresh for overviews to get the most current state
  const question = 'overview' // Simple trigger for our detection
  return spawnCurator(projectPath, question, false)
}

// Spawn a curator Claude instance
async function spawnCurator(
  projectPath: string,
  question: string,
  useExistingSession: boolean = true
): Promise<string> {
  const sessionFile = getCuratorSessionFile(projectPath)
  const existingSession =
    existsSync(sessionFile) && useExistingSession
      ? readFileSync(sessionFile, 'utf-8').trim()
      : null

  // Get initial overview
  const overview = await getCodebaseOverview(projectPath)

  // Check if this is a special command
  const isOverviewRequest =
    question.toLowerCase().includes('overview') ||
    question.toLowerCase().includes('what is this') ||
    question.toLowerCase().includes('understand this codebase')

  const isAddFeatureRequest =
    question.toLowerCase().includes('add') &&
    (question.toLowerCase().includes('feature') ||
      question.toLowerCase().includes('implement'))

  const isIntegrationRequest =
    question.toLowerCase().includes('where') &&
    (question.toLowerCase().includes('integrate') ||
      question.toLowerCase().includes('add') ||
      question.toLowerCase().includes('put'))

  // Create specialized prompts based on request type
  let specializedPrompt = ''

  if (isOverviewRequest) {
    specializedPrompt = `
## Hey Claude! Tell me how this codebase actually works 🎯

Forget the theory - I need to understand this codebase so I can ship code without breaking everything.

**The survival guide I need:**
1. **What it does** - The real purpose, not the marketing pitch
2. **How it flows** - Where data comes in, how it moves, where it goes out
3. **Where things live** - The actual organization that emerged (not what they planned)
4. **The patterns** - What approaches they consistently use (discovered, not prescribed)
5. **The surprises** - Tech debt, weird decisions, "don't touch this" areas

**Let the codebase speak for itself.** Use all the analysis tools to discover what's really there. Don't assume web app patterns, microservice patterns, or any patterns - let them emerge.

**Smart exploration tips:**
- Multi-read related files together for context
- Follow the data/event flows when you spot them
- Look for what's actually connected vs what just exists
- Check tests - they reveal intended behavior

Give me enough to work effectively, filtered through "what would I need on day one?" 

And save those insights! Update memory.md so future-us benefits from current-us's discoveries. 🧠
`
  } else if (isAddFeatureRequest) {
    specializedPrompt = `
## Alright Claude, let's add a feature that actually fits in! 🚀

We both know the hardest part isn't writing code - it's writing code that belongs. Help me understand how THIS codebase grows.

**Investigation needed:**
1. **Find the patterns** - How do similar features actually work here? Not theory - real examples
2. **Trace the flows** - How will data/events move through this feature?
3. **Spot the integration** - Where does this naturally connect to existing code?
4. **Reveal the conventions** - What unwritten rules make code "feel right" here?

**Discover, don't assume:**
- Multi-read similar features to see patterns emerge
- Follow data flows from entry to exit
- Check how existing features connect and communicate
- Look at tests to understand expected behavior

**Guide me with specifics:**
- "Features like this live here because..."
- "They handle data flow using this pattern..."
- "Integration typically happens through..."
- Code examples from THIS codebase, not generic patterns

Remember: We're archaeologists discovering how to extend an existing civilization, not architects imposing new structures.
`
  } else if (isIntegrationRequest) {
    specializedPrompt = `
## Yo Claude, how do things connect in this codebase? 🔌

Integration is where architecture meets reality. Help me understand the actual connection patterns.

**Map the territory:**
1. **Entry points** - Where does data/control flow enter the system?
2. **Connection patterns** - How do components actually talk to each other?
3. **Extension points** - Where is the codebase designed to grow?
4. **The flow paths** - How do features connect to the main data/event flows?

**Emergence over assumption:**
- Read actual integration points together
- Trace how existing features plugged in
- Follow the data - where does it flow through?
- Look for natural extension points, not forced ones

**Show me what you discover:**
- "Most features connect through..."
- "Data typically flows from X → Y → Z"
- "The codebase naturally extends at..."
- "Avoid connecting at... because..."

We're looking for the paths of least resistance - where the codebase WANTS to be extended, not where we can force connections.
`
  }

  // Create the curator's context
  const curatorContext = `Hey! You're the Codebase Curator for this project. Another Claude needs your help understanding this codebase so they can actually ship code without breaking everything.

You know how it is - we need the REAL story, not the idealized version. Show them how things actually work here.

${specializedPrompt}

## YOUR TOOLBOX 🛠️

**File ninjas:**
- Read: Grab any file (use multi-file reads - way faster!)
- Grep: Find stuff across the codebase
- Glob: Find files by pattern
- LS: See what's in a directory

**Analysis powers** (run these with Bash + --curator flag):
\`\`\`bash
bun run ${CURATOR_TOOL_PATH}/src/cli.ts imports . --curator
bun run ${CURATOR_TOOL_PATH}/src/cli.ts frameworks . --curator
bun run ${CURATOR_TOOL_PATH}/src/cli.ts organization . --curator
bun run ${CURATOR_TOOL_PATH}/src/cli.ts patterns . --curator
bun run ${CURATOR_TOOL_PATH}/src/cli.ts similarity . --curator
bun run ${CURATOR_TOOL_PATH}/src/cli.ts all . --curator
\`\`\`
These save results to .curator/[type]-[timestamp].json - just Read the file after.

## THE GOLDEN RULE 🏆

**Always use tools before answering!** Seriously. Even if you think you know - verify with tools. We've all been burned by assumptions.

Good patterns:
- Run analysis first, then dive into specific files
- Multi-read related files together
- When in doubt, run ALL analyses
- Check the actual implementations, not just the pretty interfaces

Remember: You're helping another Claude not create tomorrow's tech debt. Be real, be specific, be helpful.

## PERFORMANCE TIP: Multi-File Reads

The Read tool supports reading MULTIPLE files in ONE call - this is 3-5x faster and gives better context!

**ALWAYS batch related files together:**
- Read types + implementations together
- Read tests + source files together  
- Read all files in a pattern analysis together
- Read all related components/services together

**Example:** When analyzing the import mapper, don't do separate reads. Instead, combine them:
Read multiple files: ['src/types/index.ts', 'src/algorithms/importMapper.ts', 'tests/importMapper.test.ts']

This gives you complete context in one operation!

## POWER TIP: Task Agents for Complex Analysis

The Task tool lets you launch autonomous agents for parallel analysis! Use it when:
- You need to explore multiple hypotheses simultaneously
- Searching for patterns across many files
- Analyzing different aspects of the codebase in parallel
- You're not sure what you're looking for

**Example**: Analyzing a feature implementation:
\`\`\`
Task: "Find all authentication implementations" 
Task: "Analyze error handling patterns"
Task: "Search for similar feature patterns"
\`\`\`

All three agents work in parallel and report back comprehensive findings!

## YOUR WORKFLOW 📋

1. **Check your notes** - Read .curator/memory.md (might have gold from last time)
2. **Run fresh analysis** - Even if you have notes, verify things haven't changed
3. **Dig deeper** - Use findings to guide specific file reads
4. **Connect the dots** - Combine memory + analysis + file reads
5. **Save insights** - Update memory.md with new discoveries (append, don't nuke)
6. **Be specific** - Give file paths, line numbers, actual code examples

Pro tip: The codebase changes. Your memory might be stale. Always verify with fresh analysis! 🔍

Initial Codebase Overview:
${createConciseSummary(overview)}`

  // Build command args
  const args = []

  // For existing sessions, resume
  if (existingSession) {
    args.push('--resume', existingSession, '--print', question)
  } else {
    // For new sessions, include the curator context in the prompt itself
    const fullPrompt = `${curatorContext}

USER QUESTION: ${question}`
    args.push('--print', fullPrompt)
  }

  // Add other options
  args.push(
    '--allowedTools',
    "Read,Grep,Glob,LS,Bash,Write('.curator/'),Edit('.curator/memory.md')",
    '--output-format',
    'stream-json',
    '--max-turns',
    '25',
    '--verbose'
  )

  return new Promise((resolve, reject) => {
    // Use node explicitly to avoid bun module resolution issues
    const claudeScript = CLAUDE_CLI_PATH.endsWith('claude')
      ? path.join(
          path.dirname(CLAUDE_CLI_PATH),
          'node_modules/@anthropic-ai/claude-code/cli.js'
        )
      : CLAUDE_CLI_PATH // If custom path points directly to cli.js

    console.error(`[Curator] Spawning claude with cwd: ${projectPath}`)
    console.error(`[Curator] Session: ${existingSession || 'new'}`)
    console.error(`[Curator] Args count: ${args.length}`)
    console.error(`[Curator] Node binary: ${NODE_PATH}`)
    console.error(`[Curator] Claude script: ${claudeScript}`)

    // Check if the claude script exists
    if (!existsSync(claudeScript)) {
      console.error(`[Curator] Claude script not found at: ${claudeScript}`)
      // Try alternative path
      const altScript = path.join(
        path.dirname(CLAUDE_CLI_PATH),
        '../lib/node_modules/@anthropic-ai/claude-code/cli.js'
      )
      if (existsSync(altScript)) {
        console.error(`[Curator] Found alternative script at: ${altScript}`)
        throw new Error(`Claude CLI script not found. Try using: ${altScript}`)
      }
      throw new Error(`Claude CLI script not found at: ${claudeScript}`)
    }

    // Clean environment to avoid bun/node conflicts
    const cleanEnv = { ...process.env }
    delete cleanEnv.BUN_INSTALL
    delete cleanEnv.NODE_PATH

    const claude = spawn(NODE_PATH, [claudeScript, ...args], {
      cwd: projectPath,
      env: {
        ...cleanEnv,
        // Disable MCP for the curator to avoid database issues
        CLAUDE_CODE_NO_MCP: '1',
      },
      shell: false, // Important: don't use shell to avoid parsing issues
      stdio: ['pipe', 'pipe', 'pipe'], // Explicitly set stdio
    })

    console.error(`[Curator] Process spawned with PID: ${claude.pid}`)
    
    // Prevent MaxListenersExceeded warnings
    claude.stdout.setMaxListeners(20)
    claude.stderr.setMaxListeners(20) 
    claude.stdin.setMaxListeners(20)

    // Close stdin as we're not sending any input
    claude.stdin.end()

    // Activity-based timeout - resets when we receive data
    let timeout: NodeJS.Timeout
    const INACTIVITY_TIMEOUT = 120000 // 2 minutes of inactivity - complex questions need thinking time

    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        console.error(
          '[Curator] Inactivity timeout - no data received for 30s, killing process'
        )
        claude.kill()
      }, INACTIVITY_TIMEOUT)
    }

    // Start the initial timeout
    resetTimeout()

    let output = ''
    let error = ''

    claude.stdout.on('data', (data) => {
      const chunk = data.toString()
      output += chunk
      console.error(`[Curator stdout chunk]: ${chunk.substring(0, 100)}...`)
      // Reset timeout on new data
      resetTimeout()
    })

    claude.stderr.on('data', (data) => {
      const chunk = data.toString()
      error += chunk
      console.error(`[Curator stderr]: ${chunk}`)
    })

    claude.on('error', (err) => {
      console.error(`[Curator] Spawn error:`, err)
      reject(new Error(`Failed to spawn Claude: ${err.message}`))
    })

    claude.on('close', (code) => {
      clearTimeout(timeout) // Clear the timeout
      console.error(`[Curator] Process exited with code: ${code}`)
      console.error(`[Curator] Total output length: ${output.length}`)
      console.error(`[Curator] Total error length: ${error.length}`)

      // Code 143 is SIGTERM from our timeout, which is expected
      if (code !== 0 && code !== null && code !== 143) {
        reject(new Error(`Claude exited with code ${code}: ${error}`))
      } else {
        // Try to parse what we got, even if there was an error or timeout
        console.error(`[Curator] Parsing streaming JSON...`)
        const result = parseStreamingJSON(output)
        console.error(`[Curator] Parsed result: ${result ? 'found' : 'null'}`)

        // Extract session ID for future use
        const sessionMatch = output.match(/"session_id":\s*"([^"]+)"/)
        if (sessionMatch) {
          const sessionId = sessionMatch[1]
          writeFileSync(sessionFile, sessionId)
          console.error(`[Curator] Saved session: ${sessionId}`)
        }

        // Handle different cases
        if (code === 143 && result) {
          // Timeout but we got a response
          resolve(`${result}\n\n[Note: Response was truncated due to timeout]`)
        } else if (result && error) {
          resolve(
            `${result}\n\n[Note: Claude encountered an error: ${error.substring(
              0,
              200
            )}...]`
          )
        } else {
          resolve(result || 'No response from curator')
        }
      }
    })
  })
}

// Helper function to generate insights from analysis data
function generateInsights(imports: any, frameworks: any, organization: any, patterns: any): string {
  const insights = []
  
  // Dependency insights
  if (imports.circularDependencies?.length > 0) {
    insights.push(`- ⚠️ Found ${imports.circularDependencies.length} circular dependencies that may need refactoring`)
  }
  if (imports.orphanedFiles?.length > 0) {
    insights.push(`- 📝 ${imports.orphanedFiles.length} files appear to be unused or disconnected`)
  }
  
  // Framework insights
  if (frameworks.frameworks?.some((f: any) => f.category === 'frontend' && f.confidence > 80)) {
    insights.push('- 🎨 Strong frontend framework presence detected')
  }
  if (frameworks.frameworks?.some((f: any) => f.category === 'testing' && f.confidence > 70)) {
    insights.push('- ✅ Good test coverage infrastructure in place')
  }
  
  // Pattern insights
  const componentPatterns = patterns.patterns?.filter((p: any) => p.category === 'component')?.length || 0
  if (componentPatterns > 3) {
    insights.push(`- 🧩 Rich component architecture with ${componentPatterns} distinct patterns`)
  }
  
  return insights.length > 0 ? insights.join('\n') : '- Well-structured codebase with no major issues detected'
}

// Helper function to generate quick start hints
function generateQuickStartHints(frameworks: any, organization: any): string {
  const hints = []
  
  // Package manager hints
  if (frameworks.buildTools?.includes('npm')) {
    hints.push('- Run `npm install` to install dependencies')
    hints.push('- Check `package.json` for available scripts')
  } else if (frameworks.buildTools?.includes('bun')) {
    hints.push('- Run `bun install` to install dependencies')
    hints.push('- This project uses Bun for fast TypeScript execution')
  }
  
  // Entry point hints
  if (organization.structure?.topLevelFiles?.includes('index.ts')) {
    hints.push('- Main entry point: `index.ts`')
  } else if (organization.structure?.topLevelDirs?.includes('src')) {
    hints.push('- Source code is in the `src/` directory')
  }
  
  return hints.length > 0 ? hints.join('\n') : '- Check README.md for setup instructions'
}

const server = new McpServer({
  name: 'codebase-curator',
  version: '2.1.0',
  description:
    'AI-powered codebase curator using Claude instances with session management',
})

// Tool: Get codebase overview
server.tool(
  'get_codebase_overview',
  'Get an emergent, comprehensive overview of the codebase that reflects its actual nature and patterns',
  {
    projectPath: z
      .string()
      .optional()
      .describe('The codebase path (defaults to current project)'),
  },
  async ({ projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath)

    if (!existsSync(absolutePath)) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Path does not exist: ${absolutePath}`,
          },
        ],
        isError: true,
      }
    }

    try {
      // Direct overview request - let the curator analyze and provide insights
      const response = await spawnCuratorForOverview(absolutePath)

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      }
    } catch (error) {
      console.error('[get_codebase_overview] Error:', error)
      console.error(
        '[get_codebase_overview] Error stack:',
        error instanceof Error ? error.stack : 'No stack'
      )
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

// Tool: Ask the curator a question
server.tool(
  'ask_curator',
  'Ask the codebase curator a question about the codebase architecture, patterns, or how to integrate new features',
  {
    question: z.string().describe('The question to ask the curator'),
    projectPath: z
      .string()
      .optional()
      .describe('The codebase path (defaults to current project)'),
    newSession: z
      .boolean()
      .optional()
      .default(false)
      .describe('Start a new curator session instead of resuming'),
  },
  async ({ question, projectPath, newSession }) => {
    const absolutePath = resolveProjectPath(projectPath)

    if (!existsSync(absolutePath)) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Path does not exist: ${absolutePath}`,
          },
        ],
        isError: true,
      }
    }

    // Check if Claude CLI is available
    console.error(
      `[ask_curator] IS_CLAUDE_CLI_AVAILABLE: ${IS_CLAUDE_CLI_AVAILABLE}`
    )
    console.error(
      `[ask_curator] Temporarily bypassing Claude CLI check for debugging`
    )
    /*
    if (!IS_CLAUDE_CLI_AVAILABLE) {
      return {
        content: [{
          type: 'text',
          text: 'Claude CLI is not available. Curator tools require Claude CLI to be installed and accessible.',
        }],
        isError: true,
      };
    }
    */

    try {
      console.error(`[Ask Curator] Processing question: ${question}`)
      console.error(`[Ask Curator] Project path: ${absolutePath}`)
      console.error(`[Ask Curator] New session: ${newSession}`)
      console.error(`[Ask Curator] Claude CLI path: ${CLAUDE_CLI_PATH}`)
      console.error(`[Ask Curator] Node path: ${NODE_PATH}`)

      // Ensure curator directory exists
      const curatorDir = path.join(absolutePath, '.curator')
      if (!existsSync(curatorDir)) {
        console.error(`[Ask Curator] Creating curator directory: ${curatorDir}`)
        mkdirSync(curatorDir, { recursive: true })

        // Create initial memory file
        const memoryFile = path.join(curatorDir, 'memory.md')
        if (!existsSync(memoryFile)) {
          writeFileSync(
            memoryFile,
            '# Codebase Curator Memory\n\n## Insights\n\n## Patterns Discovered\n\n## Architecture Notes\n\n'
          )
        }
      }

      console.error(`[Ask Curator] Calling spawnCurator...`)
      const response = await spawnCurator(absolutePath, question, !newSession)
      console.error(`[Ask Curator] Got response from curator`)

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      }
    } catch (error) {
      console.error(`[Ask Curator] Error:`, error)
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

// Tool: Clear curator session
server.tool(
  'clear_curator_session',
  "Clear the curator's session for a fresh start",
  {
    projectPath: z
      .string()
      .optional()
      .describe('The codebase path (defaults to current project)'),
  },
  async ({ projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath)
    const sessionFile = getCuratorSessionFile(absolutePath)

    try {
      if (existsSync(sessionFile)) {
        const oldSession = readFileSync(sessionFile, 'utf-8').trim()
        require('fs').unlinkSync(sessionFile)
        return {
          content: [
            {
              type: 'text',
              text: `Curator session cleared. Previous session was: ${oldSession}`,
            },
          ],
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: 'No existing curator session found.',
            },
          ],
        }
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error clearing session: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

// Tool: Get cache statistics
server.tool(
  'get_cache_stats',
  'Get cache statistics including hit rates and memory usage',
  {},
  async () => {
    const stats = contextManager.getCacheStats()
    return {
      content: [
        {
          type: 'text',
          text: `Cache Statistics:
- Cached Projects: ${stats.projects}
- Total Cache Size: ${stats.totalSize.toFixed(2)} MB
- Cached Analysis Types: ${JSON.stringify(stats.analysisTypes, null, 2)}`,
        },
      ],
    }
  }
)

// Tool: Get curator memory/insights
server.tool(
  'get_curator_memory',
  "Retrieve the curator's accumulated knowledge and insights about the codebase",
  {
    projectPath: z
      .string()
      .optional()
      .describe('The codebase path (defaults to current project)'),
  },
  async ({ projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath)
    const memoryFile = path.join(absolutePath, '.curator', 'memory.md')

    if (!existsSync(memoryFile)) {
      return {
        content: [
          {
            type: 'text',
            text: 'No curator memory found yet. Ask the curator some questions first!',
          },
        ],
      }
    }

    try {
      const memory = readFileSync(memoryFile, 'utf-8')
      return {
        content: [
          {
            type: 'text',
            text: memory,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading curator memory: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

// Tool: Run specific analysis
server.tool(
  'run_analysis',
  'Run a specific codebase analysis algorithm',
  {
    analysisType: z
      .enum(['imports', 'frameworks', 'organization', 'patterns', 'similarity'])
      .describe('Type of analysis to run'),
    projectPath: z
      .string()
      .optional()
      .describe('The codebase path (defaults to current project)'),
  },
  async ({ analysisType, projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath)

    if (!existsSync(absolutePath)) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Path does not exist: ${absolutePath}`,
          },
        ],
        isError: true,
      }
    }

    try {
      // Check cache first
      let result = await contextManager.getCachedAnalysis(
        absolutePath,
        analysisType
      )

      if (!result) {
        // Cache miss - run the analysis
        console.error(
          `[Curator] Cache miss for ${analysisType} at ${absolutePath}`
        )

        switch (analysisType) {
          case 'imports':
            result = await new ImportMapper(absolutePath).analyze()
            break
          case 'frameworks':
            result = await new FrameworkDetector(absolutePath).detect()
            break
          case 'organization':
            result = await new FileOrganizationAnalyzer(absolutePath).analyze()
            break
          case 'patterns':
            result = await new PatternAggregator(absolutePath).analyze()
            break
          case 'similarity':
            result = await new CodeSimilarityAnalyzer(absolutePath).analyze()
            break
        }

        // Cache the result
        await contextManager.setCachedAnalysis(
          absolutePath,
          analysisType,
          result
        )
        console.error(
          `[Curator] Cached ${analysisType} results for ${absolutePath}`
        )
      } else {
        console.error(
          `[Curator] Cache hit for ${analysisType} at ${absolutePath}`
        )
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error running analysis: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

// Tool: Add new feature - provides guidance for implementing new features
server.tool(
  'add_new_feature',
  'Get comprehensive guidance for adding a new feature to the codebase, including patterns to follow, integration points, and examples',
  {
    feature: z.string().describe('Description of the feature to add'),
    projectPath: z.string().optional().describe('The codebase path (defaults to current project)'),
  },
  async ({ feature, projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath)

    if (!existsSync(absolutePath)) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Path does not exist: ${absolutePath}`,
          },
        ],
        isError: true,
      }
    }

    try {
      // Craft a specific prompt for feature addition
      const featurePrompt = `I need to add a new feature: ${feature}. Please provide comprehensive guidance including:
1. Where in the codebase architecture this feature should be implemented
2. What existing patterns and conventions I should follow
3. Specific files that need to be created or modified
4. Integration points with existing code
5. Examples of similar features already in the codebase
6. Any architectural considerations or best practices specific to this codebase`

      const response = await spawnCurator(absolutePath, featurePrompt, true)

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      }
    } catch (error) {
      console.error('[add_new_feature] Error:', error)
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

// Tool: Implement change - provides guidance for implementing changes/fixes
server.tool(
  'implement_change', 
  'Get comprehensive guidance for implementing a change or fix in the codebase, including affected files, patterns to maintain, and impact analysis',
  {
    change: z.string().describe('Description of the change or fix to implement'),
    projectPath: z.string().optional().describe('The codebase path (defaults to current project)'),
  },
  async ({ change, projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath)

    if (!existsSync(absolutePath)) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Path does not exist: ${absolutePath}`,
          },
        ],
        isError: true,
      }
    }

    try {
      // Craft a specific prompt for change implementation
      const changePrompt = `I need to implement a change/fix: ${change}. 

Give me a **focused action plan**:
1. **The problem** - What's actually broken/needs changing (be specific)
2. **Files to modify** - Just the files and line ranges, not full code dumps
3. **The fix** - Show ONLY the code that changes (before/after)
4. **Impact check** - What else might break
5. **Test updates** - Which tests need attention

Skip the philosophy. Skip unchanged code. Just tell me what to change and why.`

      const response = await spawnCurator(absolutePath, changePrompt, true)

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      }
    } catch (error) {
      console.error('[implement_change] Error:', error)
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

// Main function
async function main() {
  // Debug Claude CLI detection
  console.error(`[Debug] Checking for Claude CLI...`)
  console.error(`[Debug] CLAUDE_CLI_PATH: ${CLAUDE_CLI_PATH}`)
  console.error(`[Debug] NODE_PATH: ${NODE_PATH}`)
  console.error(`[Debug] PATH: ${process.env.PATH}`)
  console.error(`[Debug] Claude exists: ${existsSync(CLAUDE_CLI_PATH)}`)
  console.error(`[Debug] Node exists: ${existsSync(NODE_PATH)}`)

  // Check Claude CLI availability once at startup
  IS_CLAUDE_CLI_AVAILABLE = checkClaudeCLI()

  if (!IS_CLAUDE_CLI_AVAILABLE) {
    console.error('Warning: Claude CLI not found at expected locations')
    console.error(`Attempted Claude paths: ${claudePaths.join(', ')}`)
    console.error(
      'The curator tools (ask_curator, get_codebase_overview) will not work without Claude CLI'
    )
    // Don't exit - let the server start anyway
  }

  if (!existsSync(NODE_PATH)) {
    console.error('Warning: Node.js not found at expected locations')
    console.error(`Attempted Node paths: ${nodePaths.join(', ')}`)
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error(`Codebase Curator MCP Server v2.1 running on stdio`)
  console.error(
    `Claude CLI: ${IS_CLAUDE_CLI_AVAILABLE ? 'Available ✓' : 'NOT FOUND ✗'}`
  )
  console.error(`Claude CLI path: ${CLAUDE_CLI_PATH}`)
  console.error(`Default project path: ${DEFAULT_PROJECT_PATH}`)
  console.error(`Session management: Enabled`)
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
