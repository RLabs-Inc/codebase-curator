/**
 * Core Service Types
 * Central types for the unified service layer
 */

import type { CacheOptions } from './context'

/**
 * Configuration options for the curator service
 */
export interface CuratorOptions {
  /** Project path to analyze (defaults to cwd) */
  projectPath?: string
  
  /** Enable caching (defaults to true) */
  cacheEnabled?: boolean
  
  /** Cache configuration options */
  cache?: CacheOptions
  
  /** Enable session persistence (defaults to true) */
  sessionPersistence?: boolean
  
  /** Claude CLI path (auto-detected if not provided) */
  claudePath?: string
  
  /** Maximum memory for analysis (in MB) */
  maxMemory?: number
}

/**
 * Analysis request structure
 */
export interface AnalysisRequest {
  /** Type of analysis to perform */
  type: 'imports' | 'frameworks' | 'organization' | 'patterns' | 'similarity' | 'all'
  
  /** Project path to analyze */
  projectPath: string
  
  /** Analysis-specific options */
  options?: AnalysisOptions
}

/**
 * Analysis-specific options
 */
export interface AnalysisOptions {
  /** Files/directories to exclude */
  exclude?: string[]
  
  /** Files/directories to include */
  include?: string[]
  
  /** Output format */
  format?: 'json' | 'summary' | 'detailed'
  
  /** Analysis-specific settings */
  settings?: Record<string, any>
}

/**
 * Unified analysis result
 */
export interface AnalysisResult<T = any> {
  /** Analysis type */
  type: string
  
  /** Timestamp of analysis */
  timestamp: number
  
  /** Project path analyzed */
  projectPath: string
  
  /** Analysis data */
  data: T
  
  /** Summary for display */
  summary?: string
  
  /** Any errors encountered */
  errors?: string[]
  
  /** Performance metrics */
  metrics?: {
    duration: number
    filesAnalyzed: number
    memoryUsed?: number
  }
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
  
  /** Cache statistics */
  cache?: {
    enabled: boolean
    size: number
    hits: number
    misses: number
  }
  
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