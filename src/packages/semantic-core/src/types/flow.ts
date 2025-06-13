/**
 * Flow Tracing Types
 * Types for tracing data flow through code
 */

export interface FlowNode {
  id: string
  type: 'input' | 'assignment' | 'parameter' | 'call' | 'return' | 'usage'
  location: {
    file: string
    line: number
    column: number
  }
  code: string
  term: string
  metadata?: {
    functionName?: string
    variableName?: string
    parameterIndex?: number
  }
  children: FlowNode[]
}

export interface FlowPath {
  startTerm: string
  nodes: FlowNode[]
  summary: {
    filesTraversed: string[]
    functionsInvolved: string[]
    totalSteps: number
  }
}