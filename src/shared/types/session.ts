/**
 * Session Types
 * Types for managing curator sessions and history
 */

/**
 * Session data structure
 */
export interface Session {
  /** Unique session ID */
  id: string

  /** Project path this session is for */
  projectPath: string

  /** Creation timestamp */
  createdAt: number

  /** Last accessed timestamp */
  lastAccessedAt: number

  /** Session metadata */
  metadata?: {
    questionsAsked?: number
    toolsUsed?: string[]
    [key: string]: any
  }
}

/**
 * Session history entry
 */
export interface SessionHistoryEntry {
  /** Timestamp */
  timestamp: number

  /** Type of interaction */
  type: 'question' | 'overview' | 'feature' | 'integration' | 'change'

  /** The query */
  query: string

  /** Response summary */
  responseSummary?: string
}