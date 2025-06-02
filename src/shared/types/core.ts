/**
 * Core Service Types
 * Central types for the unified service layer
 */

/**
 * Configuration options for the curator service
 */
export interface CuratorOptions {
  /** Enable session persistence (defaults to true) */
  sessionPersistence?: boolean

  /** Claude CLI path (auto-detected if not provided) */
  claudePath?: string

  /** Maximum memory for analysis (in MB) */
  maxMemory?: number
}

/**
 * Curator query for natural language questions
 */
export interface CuratorQuery {
  /** The question to ask */
  question: string

  /** Project context */
  projectPath: string

  /** Optional session ID for continuity */
  sessionId?: string

  /** Whether to start a new session */
  newSession?: boolean
}

/**
 * Curator response
 */
export interface CuratorResponse {
  /** The response content */
  content: string

  /** Session ID for follow-up questions */
  sessionId: string

  /** Any tool calls made during response */
  toolCalls?: Array<{
    tool: string
    args: any
    result?: any
  }>

  /** Response metadata */
  metadata?: {
    duration: number
    tokensUsed?: number
  }
}

/**
 * Feature implementation request
 */
export interface FeatureRequest {
  /** Feature description */
  feature: string

  /** Target project */
  projectPath: string

  /** Additional context */
  context?: string
}

/**
 * Change implementation request
 */
export interface ChangeRequest {
  /** Change description */
  change: string

  /** Target project */
  projectPath: string

  /** Affected files/areas */
  scope?: string[]

  /** Additional context */
  context?: string
}

/**
 * Service status information
 */
export interface ServiceStatus {
  /** Whether service is ready */
  ready: boolean

  /** Claude CLI availability */
  claude?: {
    available: boolean
    version?: string
    path?: string
  }

  /** Active sessions */
  sessions?: {
    count: number
    active: string[]
  }
}

/**
 * Core service interface that all services implement
 */
export interface CoreService {
  /** Initialize the service */
  initialize?(): Promise<void>

  /** Cleanup resources */
  cleanup?(): Promise<void>

  /** Get service status */
  getStatus?(): ServiceStatus | Promise<ServiceStatus>
}
