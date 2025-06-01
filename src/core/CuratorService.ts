/**
 * Curator Service
 * Main orchestration service that coordinates all curator functionality
 */
import { CuratorProcessService } from './CuratorProcessService'
import { SessionService } from './SessionService'
import {
  getCuratorContext,
  OVERVIEW_PROMPT,
  ADD_FEATURE_PROMPT,
  IMPLEMENT_CHANGE_PROMPT,
  INTEGRATION_PROMPT,
  ADD_FEATURE_DIRECT_PROMPT,
  IMPLEMENT_CHANGE_DIRECT_PROMPT,
} from './CuratorPrompts'
import type {
  CoreService,
  CuratorOptions,
  ServiceStatus,
  CuratorQuery,
  CuratorResponse,
  FeatureRequest,
  ChangeRequest,
} from '../types/core'

/**
 * Main curator service that orchestrates all functionality
 */
export class CuratorService implements CoreService {
  private curatorProcess: CuratorProcessService
  private sessionService: SessionService
  private options: Required<CuratorOptions>
  private initialized = false
  private projectPath: string | null = null

  constructor(options: CuratorOptions = {}) {
    // Set default options
    this.options = {
      claudePath: options.claudePath as string,
      maxMemory: options.maxMemory || 512,
    } as Required<CuratorOptions>

    // Initialize services
    this.curatorProcess = new CuratorProcessService({
      claudePath: this.options.claudePath,
    })
    this.sessionService = new SessionService()
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    await Promise.all([this.sessionService.initialize?.()])

    this.initialized = true
  }

  /**
   * Get a comprehensive overview of the codebase
   */
  async getOverview(projectPath?: string, newSession?: boolean): Promise<string> {
    const path = this.getPath(projectPath)

    // Don't run analyses - let Curator Claude use the tools himself!
    // Just give him the project path and our sophisticated prompts

    // IMPORTANT: The overview builds the foundational understanding of the codebase.
    // By default, we reuse the existing session so all subsequent commands 
    // (ask_curator, add_new_feature, etc.) can build on this comprehensive context.
    // Only start fresh if explicitly requested or for a new project.

    // Ask curator for comprehensive overview
    const query: CuratorQuery = {
      question: getCuratorContext(OVERVIEW_PROMPT),
      projectPath: path,
      newSession: newSession || false, // Default: reuse existing session to preserve context
    }

    const response = await this.curatorProcess.ask(query)

    // Track in session history
    if (this.options.sessionPersistence) {
      const session = await this.sessionService.getOrCreateSession(path)
      this.sessionService.addToHistory(session.id, {
        timestamp: Date.now(),
        type: 'overview',
        query: 'get_codebase_overview',
        responseSummary: response.content.substring(0, 200) + '...',
      })
    }

    return response.content
  }

  /**
   * Ask a question about the codebase with dynamic prompt detection
   */
  async askCurator(query: CuratorQuery): Promise<CuratorResponse> {
    await this.initialize()

    const path = this.getPath(query.projectPath)

    // Detect request type based on keywords (matches original behavior)
    const question = query.question.toLowerCase()

    const isOverviewRequest =
      question.includes('overview') ||
      question.includes('what is this') ||
      question.includes('understand this codebase')

    const isAddFeatureRequest =
      question.includes('add') &&
      (question.includes('feature') || question.includes('implement'))

    const isIntegrationRequest =
      question.includes('where') &&
      (question.includes('integrate') ||
        question.includes('add') ||
        question.includes('put'))

    const isChangeRequest = question.includes('change')

    // Select appropriate specialized prompt
    let specializedPrompt = ''
    let promptType = 'general'

    if (isOverviewRequest) {
      specializedPrompt = OVERVIEW_PROMPT
      promptType = 'overview'
    } else if (isAddFeatureRequest) {
      specializedPrompt = ADD_FEATURE_PROMPT
      promptType = 'feature'
    } else if (isIntegrationRequest) {
      specializedPrompt = INTEGRATION_PROMPT
      promptType = 'integration'
    } else if (isChangeRequest) {
      specializedPrompt = IMPLEMENT_CHANGE_PROMPT
      promptType = 'change'
    } else {
      // Default: just pass through the question
      specializedPrompt = `USER QUESTION: ${query.question}`
    }

    // Build full prompt with curator context
    const fullPrompt = getCuratorContext(specializedPrompt)

    // Create the actual query with the full prompt
    const curatorQuery: CuratorQuery = {
      question: fullPrompt,
      projectPath: path,
      newSession: query.newSession,
    }

    // Get or create session
    let session = null
    if (this.options.sessionPersistence) {
      session = await this.sessionService.getOrCreateSession(
        path,
        query.sessionId
      )
      // Don't pass SessionService ID to curator - it manages its own Claude CLI sessions
      // curatorQuery.sessionId = session.id
    }

    // Ask the curator with the full prompt
    const response = await this.curatorProcess.ask(curatorQuery)

    // Update session
    if (session) {
      this.sessionService.updateSession(session.id, {
        metadata: {
          questionsAsked: (session.metadata?.questionsAsked || 0) + 1,
        },
      })

      await this.sessionService.addToHistory(session.id, {
        timestamp: Date.now(),
        type: promptType as
          | 'overview'
          | 'question'
          | 'feature'
          | 'integration'
          | 'change',
        query: query.question,
        responseSummary: response.content.substring(0, 200) + '...',
      })
    }

    return response
  }

  /**
   * Get guidance for adding a new feature
   */
  async addNewFeature(request: FeatureRequest): Promise<string> {
    const path = this.getPath(request.projectPath)

    // Create feature-specific prompt
    const prompt = this.getFeaturePrompt(
      request.feature,
      null // imports,
    )

    // Ask curator
    const query: CuratorQuery = {
      question: prompt,
      projectPath: path,
      newSession: false, // Continue in context
    }

    const response = await this.curatorProcess.ask(query)

    // Track in session
    if (this.options.sessionPersistence) {
      const session = await this.sessionService.getOrCreateSession(path)
      await this.sessionService.addToHistory(session.id, {
        timestamp: Date.now(),
        type: 'feature',
        query: request.feature,
        responseSummary: `Feature guidance: ${request.feature.substring(
          0,
          100
        )}...`,
      })
    }

    return response.content
  }

  /**
   * Get guidance for implementing a change
   */
  async implementChange(request: ChangeRequest): Promise<string> {
    const path = this.getPath(request.projectPath)

    // Create change-specific prompt
    const prompt = this.getChangePrompt(request.change, null, request.scope)

    // Ask curator
    const query: CuratorQuery = {
      question: prompt,
      projectPath: path,
      newSession: false,
    }

    const response = await this.curatorProcess.ask(query)

    // Track in session
    if (this.options.sessionPersistence) {
      const session = await this.sessionService.getOrCreateSession(path)
      await this.sessionService.addToHistory(session.id, {
        timestamp: Date.now(),
        type: 'change',
        query: request.change,
        responseSummary: `Change guidance: ${request.change.substring(
          0,
          100
        )}...`,
      })
    }

    return response.content
  }

  /**
   * Get curator memory/notes
   */
  async getCuratorMemory(projectPath?: string): Promise<string> {
    const path = this.getPath(projectPath)

    // Read memory file
    const memoryPath = `${path}/.curator/memory.md`

    try {
      const { readFileSync } = await import('fs')
      return readFileSync(memoryPath, 'utf-8')
    } catch {
      return 'No curator memory found for this project.'
    }
  }

  /**
   * Clear curator session
   */
  async clearSession(projectPath?: string): Promise<void> {
    const path = this.getPath(projectPath)

    if (this.options.sessionPersistence) {
      const sessions = this.sessionService.getProjectSessions(path)
      // Clear all sessions for this project
      for (const session of sessions) {
        this.sessionService.updateSession(session.id, {
          metadata: { cleared: true },
        })
      }
    }

    // Clear curator directory
    const { rmSync, existsSync } = await import('fs')
    const curatorDir = `${path}/.curator`

    if (existsSync(curatorDir)) {
      rmSync(curatorDir, { recursive: true, force: true })
    }
  }

  /**
   * Set the project path for all operations
   */
  setProjectPath(path: string): void {
    const { resolve } = require('path')
    const { existsSync } = require('fs')

    const resolvedPath = resolve(path)

    if (!existsSync(resolvedPath)) {
      throw new Error(`Project path does not exist: ${resolvedPath}`)
    }

    this.projectPath = resolvedPath
  }

  /**
   * Get the project path
   */
  getProjectPath(): string | null {
    return this.projectPath
  }

  /**
   * Get effective project path (set path or override)
   */
  private getPath(override?: string): string {
    if (override) {
      return override
    }

    if (this.projectPath) {
      return this.projectPath
    }

    throw new Error(
      'No project path set. Use setProjectPath() first or provide projectPath parameter.'
    )
  }

  /**
   * Get overview prompt
   */
  private getOverviewPrompt(): string {
    // Use the full curator context with the overview prompt
    return getCuratorContext(OVERVIEW_PROMPT)
  }

  /**
   * Get feature prompt (direct tool version)
   */
  private getFeaturePrompt(feature: string, analyses: any): string {
    // Use the direct prompt (simpler version)
    const directPrompt = ADD_FEATURE_DIRECT_PROMPT.replace('{feature}', feature)

    return getCuratorContext(directPrompt)
  }

  /**
   * Get change prompt (direct tool version)
   */
  private getChangePrompt(
    change: string,
    analyses: any,
    scope?: string[]
  ): string {
    // Use the direct prompt (simpler version)
    let directPrompt = IMPLEMENT_CHANGE_DIRECT_PROMPT.replace(
      '{change}',
      change
    )

    // Add scope if provided
    if (scope && scope.length > 0) {
      directPrompt = `SCOPE: ${scope.join(', ')}\n\n${directPrompt}`
    }

    return getCuratorContext(directPrompt)
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<ServiceStatus> {
    const [curatorStatus, sessionStatus] = await Promise.all([
      this.curatorProcess.getStatus?.() || { ready: true },
      this.sessionService.getStatus?.() || { ready: true },
    ])

    return {
      ready: this.initialized,
      claude: curatorStatus.claude,
      sessions: sessionStatus.sessions,
    }
  }

  /**
   * Cleanup all services
   */
  async cleanup(): Promise<void> {
    await Promise.all([this.sessionService.cleanup?.()])

    this.initialized = false
  }
}

/**
 * Factory function for creating curator service
 */
export function createCuratorService(options?: CuratorOptions): CuratorService {
  return new CuratorService(options)
}
