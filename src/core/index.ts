/**
 * Core Service Layer
 * Exports all core services for the curator
 */

export { CuratorService, createCuratorService } from './CuratorService'
export { AnalysisService } from './AnalysisService'
export { CuratorProcessService } from './CuratorProcessService'
export { SessionService } from './SessionService'

// Re-export core types
export type {
  CoreService,
  CuratorOptions,
  AnalysisRequest,
  AnalysisResult,
  CuratorQuery,
  CuratorResponse,
  FeatureRequest,
  ChangeRequest,
  ServiceStatus
} from '../types/core'