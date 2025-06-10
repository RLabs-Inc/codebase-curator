/**
 * Story Types - Core types for narrative extraction from codebases
 */

export interface CodebaseStory {
  flows: ProcessFlow[]
  errors: ErrorScenario[]
  boundaries: SystemBoundary[]
  patterns: RecurringPattern[]
  metadata: StoryMetadata
}

export interface ProcessFlow {
  id: string
  name: string
  steps: FlowStep[]
  frequency: number
  variations: FlowVariation[]
  fileLocations: string[]
}

export interface FlowStep {
  text: string
  type: 'start' | 'process' | 'decision' | 'end' | 'error'
  location?: CodeLocation
  nextSteps: string[] // IDs of possible next steps
  errorSteps: string[] // IDs of error branches
}

export interface FlowVariation {
  condition: string
  alternativePath: FlowStep[]
}

export interface ErrorScenario {
  id: string
  category: 'validation' | 'authentication' | 'network' | 'data' | 'system' | 'general'
  trigger: string
  error: string
  recovery?: string
  frequency: number
  locations: CodeLocation[]
}

export interface SystemBoundary {
  id: string
  type: 'api' | 'database' | 'file' | 'config' | 'service'
  identifier: string
  protocol?: string // http, grpc, file://, etc.
  usage: BoundaryUsage[]
}

export interface BoundaryUsage {
  context: string
  location: CodeLocation
  operation?: string // GET, POST, SELECT, INSERT, etc.
}

export interface RecurringPattern {
  id: string
  type: 'retry' | 'validation' | 'state-change' | 'lifecycle' | 'permission' | 'cache'
  description: string
  examples: PatternExample[]
  frequency: number
}

export interface PatternExample {
  text: string
  location: CodeLocation
  context?: string
}

export interface CodeLocation {
  file: string
  line: number
  column?: number
  function?: string
}

export interface StoryMetadata {
  extractedAt: number
  totalStrings: number
  coveredFiles: number
  confidence: number // 0-1, based on pattern clarity
}

// Universal patterns that exist in all codebases
export const UNIVERSAL_PATTERNS = {
  temporal: {
    start: /\b(start|begin|init|create|open|establish|launch|boot)/i,
    process: /\b(process|handle|execute|perform|run|do|work)/i,
    end: /\b(end|finish|complete|done|close|terminate|cleanup)/i,
  },
  
  failure: {
    error: /\b(error|fail|failure|exception|problem|issue)/i,
    invalid: /\b(invalid|incorrect|wrong|bad|illegal|malformed)/i,
    missing: /\b(missing|not found|absent|unavailable|empty|null)/i,
  },
  
  success: {
    success: /\b(success|successful|succeeded|ok|good|valid)/i,
    complete: /\b(complete|completed|done|finished|ready)/i,
  },
  
  attempt: {
    try: /\b(try|attempt|trying|attempting)/i,
    retry: /\b(retry|retrying|reattempt)/i,
  },
  
  boundary: {
    api: /https?:\/\/(?!localhost|127\.0\.0\.1)|api\./i,
    database: /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i,
    file: /\.(json|xml|csv|txt|log|pdf|png|jpg|gif)["']?/i,
    config: /\b(process\.env|ENV|CONFIG|SETTING|SECRET|KEY|TOKEN)\b/i,
  },
  
  state: {
    status: /\b(status|state|phase|mode|stage)[:=]\s*["']?(\w+)/i,
    transition: /->|=>|→/,
  },
} as const

// Helper type for extracted strings with context
export interface ExtractedString {
  value: string
  location: CodeLocation
  type: string // from semantic index
  context: string // surrounding code
  metadata?: Record<string, any>
}