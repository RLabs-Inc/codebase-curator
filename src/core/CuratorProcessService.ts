/**
 * Curator Process Service
 * Manages spawning and communication with Claude CLI instances
 */

import { spawn, ChildProcess } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { execSync } from 'child_process'
import type { CoreService, CuratorQuery, CuratorResponse, ServiceStatus } from '../types/core'

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
  
  constructor(config: CuratorProcessConfig = {}) {
    this.config = {
      claudePath: config.claudePath || this.findClaudeCli(),
      nodePath: config.nodePath || this.findNodeBinary(),
      maxTurns: config.maxTurns || 25,
      inactivityTimeout: config.inactivityTimeout || 120000, // 2 minutes
      sessionDir: config.sessionDir || '.curator'
    }
    
    this.claudeCliPath = this.config.claudePath
    this.nodePath = this.config.nodePath
  }

  /**
   * Ask the curator a question
   */
  async ask(query: CuratorQuery): Promise<CuratorResponse> {
    const startTime = Date.now()
    
    // Get or create session
    const sessionFile = this.getSessionFile(query.projectPath)
    const existingSession = await this.getExistingSession(sessionFile, query.newSession)
    
    // Prepare the question with context if needed
    const question = await this.prepareQuestion(query)
    
    // Spawn the curator process
    const output = await this.spawnCurator(
      query.projectPath,
      question,
      existingSession
    )
    
    // Parse the response
    const response = this.parseResponse(output)
    
    // Extract session ID for continuity
    const sessionId = this.extractSessionId(output) || existingSession || 'new-session'
    
    // Save session ID if new
    if (sessionId && sessionId !== existingSession) {
      await this.saveSession(sessionFile, sessionId)
    }
    
    return {
      content: response,
      sessionId,
      metadata: {
        duration: Date.now() - startTime
      }
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
      
      // Get Claude script path
      const claudeScript = this.getClaudeScript()
      
      console.error(`[CuratorProcess] Spawning claude with cwd: ${projectPath}`)
      console.error(`[CuratorProcess] Session: ${existingSession || 'new'}`)
      
      // Clean environment
      const cleanEnv = { ...process.env }
      delete cleanEnv.BUN_INSTALL
      delete cleanEnv.NODE_PATH
      
      // Spawn the process
      const claude = spawn(this.nodePath, [claudeScript, ...args], {
        cwd: projectPath,
        env: {
          ...cleanEnv,
          CLAUDE_CODE_NO_MCP: '1' // Disable MCP for curator
        },
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      console.error(`[CuratorProcess] Process spawned with PID: ${claude.pid}`)
      
      // Set up listeners
      this.setupProcessListeners(claude, resolve, reject)
    })
  }

  /**
   * Build command arguments
   */
  private buildArgs(question: string, existingSession: string | null): string[] {
    const args: string[] = []
    
    if (existingSession) {
      args.push('--resume', existingSession, '--print', question)
    } else {
      args.push('--print', question)
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
      timeout = setTimeout(() => {
        console.error('[CuratorProcess] Inactivity timeout, killing process')
        claude.kill()
      }, this.config.inactivityTimeout)
    }
    
    resetTimeout()
    
    // Collect output
    let output = ''
    let error = ''
    
    claude.stdout?.on('data', (data) => {
      const chunk = data.toString()
      output += chunk
      console.error(`[CuratorProcess stdout]: ${chunk.substring(0, 100)}...`)
      resetTimeout()
    })
    
    claude.stderr?.on('data', (data) => {
      error += data.toString()
    })
    
    claude.on('error', (err) => {
      console.error('[CuratorProcess] Spawn error:', err)
      reject(new Error(`Failed to spawn Claude: ${err.message}`))
    })
    
    claude.on('close', (code) => {
      clearTimeout(timeout)
      console.error(`[CuratorProcess] Process exited with code: ${code}`)
      
      if (code !== 0 && code !== null && code !== 143) {
        reject(new Error(`Claude exited with code ${code}: ${error}`))
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
            errorMessage = 'Reached maximum conversation turns. Try a more specific question.'
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
    
    return errorMessage || result || lastAssistantMessage || 'No response received'
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
  private async getExistingSession(sessionFile: string, newSession?: boolean): Promise<string | null> {
    if (newSession || !existsSync(sessionFile)) {
      return null
    }
    const file = Bun.file(sessionFile)
    return (await file.text()).trim()
  }

  /**
   * Save session ID
   */
  private async saveSession(sessionFile: string, sessionId: string): Promise<void> {
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
      const fallbackDir = join(homeDir, '.codebase-curator', 'projects', safeName)
      
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
    if (this.claudeCliPath.endsWith('.js')) {
      return this.claudeCliPath
    }
    
    // Try to find the actual script
    const scriptPath = join(
      dirname(this.claudeCliPath),
      'node_modules/@anthropic-ai/claude-code/cli.js'
    )
    
    if (existsSync(scriptPath)) {
      return scriptPath
    }
    
    // Alternative path
    const altPath = join(
      dirname(this.claudeCliPath),
      '../lib/node_modules/@anthropic-ai/claude-code/cli.js'
    )
    
    if (existsSync(altPath)) {
      return altPath
    }
    
    throw new Error(`Claude CLI script not found. Looked for:
- ${this.claudeCliPath}
- ${scriptPath}
- ${altPath}`)
  }

  /**
   * Find Claude CLI path
   */
  private findClaudeCli(): string {
    // Check common locations first (more reliable than command -v)
    const locations = [
      join(process.env.HOME || '', '.claude/local/claude'),
      join(process.env.HOME || '', '.claude/local/bin/claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude'
    ]
    
    for (const loc of locations) {
      if (existsSync(loc)) {
        console.error(`[CuratorProcess] Found Claude at: ${loc}`)
        return loc
      }
    }
    
    // Fallback to command -v
    try {
      const claudePath = execSync('command -v claude', { encoding: 'utf-8' }).trim()
      if (claudePath && existsSync(claudePath)) {
        console.error(`[CuratorProcess] Found Claude via command -v: ${claudePath}`)
        return claudePath
      }
    } catch {
      // Fall through
    }
    
    throw new Error('Claude CLI not found. Please install it or provide the path.')
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
   * Get service status
   */
  getStatus(): ServiceStatus {
    return {
      ready: true,
      claude: {
        available: existsSync(this.getClaudeScript()),
        path: this.claudeCliPath
      }
    }
  }
}