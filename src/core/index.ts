/**
 * Core Service Layer
 * Exports all core services for the curator
 */

export { CuratorService, createCuratorService } from './CuratorService'
export { CuratorProcessService } from './CuratorProcessService'
export { SessionService } from './SessionService'
export { CodebaseStreamerBun } from './CodebaseStreamerBun'
export type { StreamBatch, StreamOptions } from './CodebaseStreamerBun'

// Re-export core types
export type {
  CoreService,
  CuratorOptions,
  CuratorQuery,
  CuratorResponse,
  FeatureRequest,
  ChangeRequest,
  ServiceStatus,
} from '../types/core'
