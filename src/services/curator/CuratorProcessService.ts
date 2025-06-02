/**
 * Curator Process Service
 * Manages spawning and communication with Claude CLI instances
 */

import { spawn, ChildProcess } from 'child_process'
import { existsSync, mkdirSync, appendFileSync } from 'fs'
import { dirname, join } from 'path'
import { execSync } from 'child_process'
import type {
  CoreService,
  CuratorQuery,
  CuratorResponse,
  ServiceStatus,
} from '../../shared/types/core.js'

/**
 * Configuration for curator process
 */
interface CuratorProcessConfig {
  /** Path to Claude CLI (auto-detected if not provided) */
  claudePath?: string

  /** Path to Node.js binary (auto-detected if not provided) */
  nodePath?: string

  /** Maximum turns for conversation */
  maxTurns?: number

  /** Inactivity timeout in milliseconds */
  inactivityTimeout?: number

  /** Session directory */
  sessionDir?: string
}

/**
 * Service for managing Claude CLI processes
 */
export class CuratorProcessService implements CoreService {
  private config: Required<CuratorProcessConfig>
  private claudeCliPath: string
  private nodePath: string
  private currentTimeout: number
  private lastToolUsed: string | null = null

  constructor(config: CuratorProcessConfig = {}) {
    this.config = {
      claudePath: config.claudePath || this.findClaudeCli(),
      nodePath: config.nodePath || this.findNodeBinary(),
      maxTurns: config.maxTurns || 25,
      inactivityTimeout: config.inactivityTimeout || 120000, // 2 minutes
      sessionDir: config.sessionDir || '.curator',
    }

    this.claudeCliPath = this.config.claudePath
    this.nodePath = this.config.nodePath
    this.currentTimeout = this.config.inactivityTimeout
  }

  /**
   * Get dynamic timeout based on tool being used
   */
  private getDynamicTimeout(toolName: string | null): number {
    // Tool-specific timeouts
    const toolTimeouts: Record<string, number> = {
      Task: 600000, // 10 minutes for Task tool
      Bash: 300000, // 5 minutes for Bash commands
      Edit: 60000, // 1 minute for edits
      MultiEdit: 90000, // 1.5 minutes for multi-edits
      Write: 60000, // 1 minute for writes
      Read: 120000, // 2 minutes for reads (increased from 30s)
      Grep: 60000, // 1 minute for grep
      Glob: 60000, // 1 minute for glob
      LS: 60000, // 1 minute for ls (increased from 30s)
    }

    if (toolName && toolTimeouts[toolName]) {
      return toolTimeouts[toolName]
    }

    // Default timeout
    return this.config.inactivityTimeout
  }

  /**
   * Ask the curator a question
   */
  async ask(query: CuratorQuery): Promise<CuratorResponse> {
    const startTime = Date.now()

    // Get or create session
    const sessionFile = this.getSessionFile(query.projectPath)
    const existingSession = await this.getExistingSession(
      sessionFile,
      query.newSession
    )

    // Prepare the question with context if needed
    const question = await this.prepareQuestion(query)

    // Spawn the curator process
    const output = await this.spawnCurator(
      query.projectPath,
      question,
      existingSession
    )

    // Parse the response
    const content = this.parseResponse(output)

    // Extract session ID for continuity
    const sessionId =
      this.extractSessionId(output) || existingSession || 'new-session'

    // Save session ID if new
    if (sessionId && sessionId !== existingSession) {
      console.error(
        `[CuratorProcess] Session ID changed: "${existingSession}" -> "${sessionId}"`
      )
      await this.saveSession(sessionFile, sessionId)
    } else if (sessionId === existingSession) {
      console.error(
        `[CuratorProcess] Session resumed successfully: "${sessionId}"`
      )
    }

    return {
      content: content,
      sessionId,
      metadata: {
        duration: Date.now() - startTime,
      },
    }
  }

  /**
   * Spawn a curator process
   */
  private async spawnCurator(
    projectPath: string,
    question: string,
    existingSession: string | null
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Build command arguments
      const args = this.buildArgs(question, existingSession)

      console.error(`[CuratorProcess] Spawning Claude with cwd: ${projectPath}`)
      console.error(`[CuratorProcess] Session: ${existingSession || 'new'}`)
      console.error(`[CuratorProcess] Session ID full: "${existingSession}"`)
      console.error(`[CuratorProcess] Claude path: ${this.claudeCliPath}`)
      console.error(
        `[CuratorProcess] Question preview: ${question.substring(0, 100)}...`
      )

      // Debug: Show exact args for session resume
      if (existingSession) {
        console.error(
          `[CuratorProcess] Resume args: -p --resume "${existingSession}" <question>`
        )
        console.error(`[CuratorProcess] Full args array:`, JSON.stringify(args))
      }

      // Just use the Claude path as found by findClaudeCli()
      const claudeCommand = this.claudeCliPath

      // Check if Claude exists
      if (!existsSync(claudeCommand)) {
        console.error(`[CuratorProcess] Claude not found at: ${claudeCommand}`)
        reject(new Error(`Claude CLI not found at: ${claudeCommand}`))
        return
      }

      // Log the exact command being executed
      console.error(
        `[CuratorProcess] Executing command: ${claudeCommand} ${args.join(' ')}`
      )

      // Try using bun to execute claude since it was installed with bun
      const bunPath = process.env.BUN_INSTALL
        ? `${process.env.BUN_INSTALL}/bin/bun`
        : 'bun'

      // Log the full command with bun
      const fullCommand = `${bunPath} x claude ${args
        .map((a) => (a.includes(' ') ? `"${a}"` : a))
        .join(' ')}`
      console.error(`[CuratorProcess] Full command: ${fullCommand}`)

      // Use bun x to run claude with proper module resolution
      const claude = spawn(bunPath, ['x', 'claude', ...args], {
        cwd: projectPath,
        env: process.env, // Keep full environment including MCP
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      console.error(`[CuratorProcess] Process spawned with PID: ${claude.pid}`)

      // Set up listeners
      this.setupProcessListeners(claude, resolve, reject)
    })
  }

  /**
   * Build command arguments
   */
  private buildArgs(
    question: string,
    existingSession: string | null
  ): string[] {
    const args: string[] = []

    if (existingSession) {
      args.push('-p', '--resume', existingSession, question)
    } else {
      args.push('-p', question)
    }

    args.push(
      '--allowedTools',
      "Read,Grep,Glob,LS,Bash,Write('.curator/'),Edit('.curator/memory.md'),Task",
      '--output-format',
      'stream-json',
      '--max-turns',
      String(this.config.maxTurns),
      '--verbose'
    )

    return args
  }

  /**
   * Set up process listeners
   */
  private setupProcessListeners(
    claude: ChildProcess,
    resolve: (value: string) => void,
    reject: (reason: any) => void
  ): void {
    // Prevent MaxListenersExceeded warnings
    claude.stdout?.setMaxListeners(20)
    claude.stderr?.setMaxListeners(20)
    claude.stdin?.setMaxListeners(20)

    // Close stdin
    claude.stdin?.end()

    // Set up timeout
    let timeout: NodeJS.Timeout
    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout)
      // Use dynamic timeout based on last tool used
      const timeoutDuration = this.getDynamicTimeout(this.lastToolUsed)
      console.error(
        `[CuratorProcess] Setting timeout to ${timeoutDuration}ms (tool: ${
          this.lastToolUsed || 'default'
        })`
      )
      timeout = setTimeout(() => {
        console.error(
          `[CuratorProcess] Inactivity timeout after ${timeoutDuration}ms, killing process`
        )
        claude.kill()
      }, timeoutDuration)
    }

    resetTimeout()

    // Collect output
    let output = ''
    let error = ''

    claude.stdout?.on('data', (data) => {
      const chunk = data.toString()
      output += chunk

      // Parse and show real-time progress
      this.logRealTimeProgress(chunk)

      resetTimeout()
    })

    claude.stderr?.on('data', (data) => {
      const stderrChunk = data.toString()
      error += stderrChunk

      // Show ALL stderr for debugging
      console.error(`[Curator Claude stderr]: ${stderrChunk}`)

      resetTimeout() // Reset timeout on ANY stderr activity too
    })

    claude.on('error', (err) => {
      console.error('[CuratorProcess] Spawn error:', err)
      reject(new Error(`Failed to spawn Claude: ${err.message}`))
    })

    claude.on('close', (code) => {
      clearTimeout(timeout)
      console.error(`[CuratorProcess] Process exited with code: ${code}`)
      console.error(`[CuratorProcess] Total output length: ${output.length}`)
      console.error(`[CuratorProcess] Total error length: ${error.length}`)

      if (code !== 0 && code !== null && code !== 143) {
        console.error(`[CuratorProcess] Full error output: ${error}`)
        console.error(`[CuratorProcess] Full stdout output: ${output}`)
        reject(new Error(`Claude exited with code ${code}: ${error}`))
      } else if (output.trim().length === 0) {
        reject(new Error(`Claude produced no output. Error: ${error}`))
      } else {
        resolve(output)
      }
    })
  }

  /**
   * Parse streaming JSON output
   */
  private parseResponse(output: string): string {
    const lines = output.trim().split('\n')
    let result = null
    let lastAssistantMessage = null
    let errorMessage = null

    for (const line of lines) {
      try {
        const json = JSON.parse(line)
        if (json.type === 'result') {
          if (json.subtype === 'error_max_turns') {
            errorMessage =
              'Reached maximum conversation turns. Try a more specific question.'
          } else if (json.result) {
            result = json.result
          }
        } else if (json.type === 'assistant' && json.message) {
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

    return (
      errorMessage || result || lastAssistantMessage || 'No response received'
    )
  }

  /**
   * Extract session ID from output
   */
  private extractSessionId(output: string): string | null {
    const match = output.match(/"session_id":\s*"([^"]+)"/)
    return match ? match[1] : null
  }

  /**
   * Prepare question with context
   */
  private async prepareQuestion(query: CuratorQuery): Promise<string> {
    // For now, just return the question
    // Could enhance with context loading here
    return query.question
  }

  /**
   * Get session file path
   */
  private getSessionFile(projectPath: string): string {
    const curatorDir = this.getSafeCuratorDir(projectPath)
    return join(curatorDir, 'session.txt')
  }

  /**
   * Get existing session ID
   */
  private async getExistingSession(
    sessionFile: string,
    newSession?: boolean
  ): Promise<string | null> {
    if (newSession || !existsSync(sessionFile)) {
      return null
    }
    const file = Bun.file(sessionFile)
    const sessionId = (await file.text()).trim()
    console.error(
      `[CuratorProcess] Read session ID from file: "${sessionId}" (length: ${sessionId.length})`
    )
    return sessionId
  }

  /**
   * Save session ID
   */
  private async saveSession(
    sessionFile: string,
    sessionId: string
  ): Promise<void> {
    const dir = dirname(sessionFile)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    await Bun.write(sessionFile, sessionId)
  }

  /**
   * Get safe curator directory
   */
  private getSafeCuratorDir(projectPath: string): string {
    const projectCuratorDir = join(projectPath, this.config.sessionDir)

    try {
      if (!existsSync(projectCuratorDir)) {
        mkdirSync(projectCuratorDir, { recursive: true })
      }
      return projectCuratorDir
    } catch (error) {
      // Fallback to home directory
      const homeDir = process.env.HOME || process.env.USERPROFILE || ''
      const safeName = projectPath.replace(/[^a-zA-Z0-9]/g, '_')
      const fallbackDir = join(
        homeDir,
        '.codebase-curator',
        'projects',
        safeName
      )

      if (!existsSync(fallbackDir)) {
        mkdirSync(fallbackDir, { recursive: true })
      }
      return fallbackDir
    }
  }

  /**
   * Get Claude script path
   */
  private getClaudeScript(): string {
    // Find the actual CLI.js script, not just the 'claude' wrapper
    if (this.claudeCliPath.endsWith('.js')) {
      return this.claudeCliPath // Already points to the script
    }

    // Look for the actual Node script
    const possiblePaths = [
      join(
        dirname(this.claudeCliPath),
        'node_modules/@anthropic-ai/claude-code/cli.js'
      ),
      join(
        dirname(this.claudeCliPath),
        '../lib/node_modules/@anthropic-ai/claude-code/cli.js'
      ),
      // Bun installation path
      join(
        process.env.HOME || '',
        '.bun/install/global/node_modules/@anthropic-ai/claude-code/cli.js'
      ),
    ]

    for (const scriptPath of possiblePaths) {
      if (existsSync(scriptPath)) {
        console.error(`[CuratorProcess] Found Claude script at: ${scriptPath}`)
        return scriptPath
      }
    }

    // Fallback to the claude binary itself
    console.error(
      `[CuratorProcess] Could not find cli.js, using claude binary: ${this.claudeCliPath}`
    )
    return this.claudeCliPath
  }

  /**
   * Find Claude CLI path
   */
  private findClaudeCli(): string {
    // First, try to get the actual path using 'which'
    try {
      const claudePath = execSync('which claude', { encoding: 'utf-8' }).trim()
      if (claudePath) {
        // If it's an alias, resolve it
        if (claudePath.includes('aliased to')) {
          const match = claudePath.match(/aliased to (.+)/)
          if (match && match[1]) {
            const actualPath = match[1].trim()
            console.error(
              `[CuratorProcess] Claude CLI aliased to: ${actualPath}`
            )
            return actualPath
          }
        }
        console.error(`[CuratorProcess] Claude CLI found at: ${claudePath}`)
        return claudePath
      }
    } catch (e) {
      console.error(
        `[CuratorProcess] 'which claude' failed, trying other methods...`
      )
    }

    // Check common locations as fallback
    const locations = [
      join(process.env.HOME || '', '.claude/local/claude'),
      join(process.env.HOME || '', '.claude/local/bin/claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
    ]

    for (const loc of locations) {
      if (existsSync(loc)) {
        // Test if this claude actually works
        try {
          execSync(`${loc} --help`, { encoding: 'utf-8', stdio: 'pipe' })
          console.error(`[CuratorProcess] Found working Claude at: ${loc}`)
          return loc
        } catch {
          console.error(
            `[CuratorProcess] Found Claude at ${loc} but it doesn't execute properly`
          )
        }
      }
    }

    throw new Error(
      'Claude CLI not found. Please install it or provide the path.'
    )
  }

  /**
   * Find Node.js binary
   */
  private findNodeBinary(): string {
    try {
      return execSync('which node', { encoding: 'utf-8' }).trim()
    } catch {
      return 'node' // Hope it's in PATH
    }
  }

  /**
   * Write to activity log file
   */
  private writeToActivityLog(message: string): void {
    try {
      const logsDir = join(process.env.HOME || '', '.codebase-curator', 'logs')
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true })
      }

      const logFile = join(
        logsDir,
        `curator-activity-${new Date().toISOString().split('T')[0]}.log`
      )
      const timestamp = new Date().toISOString()
      appendFileSync(logFile, `[${timestamp}] ${message}\n`)
    } catch {
      // Ignore logging errors
    }
  }

  /**
   * Log real-time progress from Claude's stdout
   */
  private logRealTimeProgress(chunk: string): void {
    try {
      // Parse each line as potential JSON
      const lines = chunk.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        try {
          const json = JSON.parse(line)

          // Enhanced logging based on message type
          if (json.type === 'assistant' && json.message?.content) {
            // Parse assistant messages for text content
            const content = json.message.content
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === 'text' && item.text) {
                  // Show first 100 chars of text response
                  const preview = item.text
                    .substring(0, 100)
                    .replace(/\n/g, ' ')
                  const msg = `💬 "${preview}${
                    item.text.length > 100 ? '...' : ''
                  }"`
                  console.error(`[Curator Claude] ${msg}`)
                  this.writeToActivityLog(msg)
                } else if (item.type === 'tool_use') {
                  // Tool use in content
                  this.lastToolUsed = item.name // Track the tool being used
                  const toolInfo = this.formatToolUse(item.name, item.input)
                  const msg = `🔧 ${toolInfo}`
                  console.error(`[Curator Claude] ${msg}`)
                  this.writeToActivityLog(msg)
                }
              }
            }
          } else if (json.type === 'user' && json.message?.content) {
            // Show user messages (our prompts)
            const text =
              typeof json.message.content === 'string'
                ? json.message.content
                : json.message.content[0]?.text || ''
            if (text.trim()) {
              // Only log non-empty messages
              const preview = text.substring(0, 80).replace(/\n/g, ' ')
              console.error(
                `[Curator Claude] 📝 Received: "${preview}${
                  text.length > 80 ? '...' : ''
                }"`
              )
            }
          } else if (json.type === 'system' && json.subtype === 'init') {
            // Session initialization
            const sessionMsg = `🚀 Session started (${json.session_id?.substring(
              0,
              8
            )}...)`
            console.error(`[Curator Claude] ${sessionMsg}`)
            this.writeToActivityLog(sessionMsg)

            // Log where activity logs are saved
            const logsDir = join(
              process.env.HOME || '',
              '.codebase-curator',
              'logs'
            )
            console.error(`[Curator Claude] 📄 Activity logs: ${logsDir}`)

            if (json.tools && json.tools.length > 0) {
              const toolsMsg = `🛠️  Available tools: ${json.tools
                .filter((t: string) => !t.startsWith('mcp_'))
                .join(', ')}`
              console.error(`[Curator Claude] ${toolsMsg}`)
              this.writeToActivityLog(toolsMsg)
            }
          } else if (json.type === 'result') {
            // Final result
            if (json.subtype === 'error_max_turns') {
              console.error(
                `[Curator Claude] ⚠️  Max turns reached after ${json.num_turns} turns`
              )
            } else if (json.is_error) {
              console.error(
                `[Curator Claude] ❌ Error: ${json.result?.substring(
                  0,
                  100
                )}...`
              )
            } else {
              console.error(
                `[Curator Claude] ✅ Completed in ${json.duration_ms}ms (${
                  json.num_turns
                } turns, $${json.cost_usd?.toFixed(4) || '0'})`
              )
            }
          }
        } catch {
          // Not JSON - ignore
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  /**
   * Format tool use for logging
   */
  private formatToolUse(toolName: string, input: any): string {
    switch (toolName) {
      case 'Read':
        const files = Array.isArray(input.file_path)
          ? input.file_path
          : [input.file_path]
        return `Reading ${files.length} file(s): ${files
          .map((f: string) => f.split('/').pop())
          .join(', ')}`
      case 'Grep':
        return `Searching for "${input.pattern}" in ${input.path || 'project'}`
      case 'Glob':
        return `Finding files matching "${input.pattern}"`
      case 'LS':
        return `Listing ${input.path || 'current directory'}`
      case 'Edit':
        return `Editing ${input.file_path?.split('/').pop() || 'file'}`
      case 'Write':
        return `Writing to ${input.file_path?.split('/').pop() || 'file'}`
      case 'Task':
        return `Launching task: "${input.prompt?.substring(0, 50)}..."`
      case 'Bash':
        return `Running: ${input.command?.substring(0, 50)}${
          input.command?.length > 50 ? '...' : ''
        }`
      default:
        return `Using ${toolName}`
    }
  }

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    return {
      ready: true,
      claude: {
        available: existsSync(this.getClaudeScript()),
        path: this.claudeCliPath,
      },
    }
  }
}
