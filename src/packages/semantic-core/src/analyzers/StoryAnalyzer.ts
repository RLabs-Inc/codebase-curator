/**
 * Story Analyzer - Extracts narrative patterns from codebase strings
 * 
 * Every codebase tells a story through its strings. This analyzer finds
 * the narrative arc hidden in error messages, logs, and state transitions.
 */

import type { SearchResult, SemanticInfo } from '../types'

export interface CodebaseStory {
  flows: ProcessFlow[]
  actors: StoryActor[]
  conflicts: ConflictPattern[]
  states: StateTransition[]
  patterns: NarrativePattern[]
}

export interface ProcessFlow {
  name: string
  stages: FlowStage[]
  variations: FlowVariation[]
}

export interface FlowStage {
  pattern: string
  examples: string[]
  nextStages: string[]
  errorStages: string[]
}

export interface FlowVariation {
  condition: string
  alternativePath: FlowStage[]
}

export interface StoryActor {
  name: string
  type: 'user' | 'service' | 'database' | 'file' | 'external'
  interactions: string[]
  patterns: string[]
}

export interface ConflictPattern {
  category: string
  triggers: string[]
  resolutions: string[]
  frequency: number
}

export interface StateTransition {
  fromState: string
  toState: string
  triggers: string[]
  count: number
}

export interface NarrativePattern {
  type: 'initialization' | 'processing' | 'validation' | 'completion' | 'error'
  patterns: string[]
  metadata?: Record<string, any>
}

export class StoryAnalyzer {
  // Common narrative patterns across languages/domains
  private narrativeKeywords = {
    initialization: [
      /^(start|init|begin|load|creat|open|establish|setup|boot)/i,
      /ing\s+(up|connection|server|service|client)/i,
    ],
    processing: [
      /^(process|handl|execut|run|perform|calculat|transform|send|fetch)/i,
      /ing\s+(request|data|message|event|job|task)/i,
    ],
    validation: [
      /^(validat|check|verif|ensure|confirm|assert|test)/i,
      /(valid|invalid|correct|incorrect|allowed|forbidden)/i,
    ],
    completion: [
      /^(complet|finish|done|success|succeed|sav|stor|wrote|sent)/i,
      /(successful|successfully|completed|finished|saved|stored)/i,
    ],
    error: [
      /^(error|fail|cannot|unable|invalid|missing|required|expected)/i,
      /(exception|timeout|refused|denied|unauthorized|forbidden)/i,
    ],
  }

  // State detection patterns
  private statePatterns = [
    /status:\s*["']?(\w+)/i,
    /state:\s*["']?(\w+)/i,
    /phase:\s*["']?(\w+)/i,
    /mode:\s*["']?(\w+)/i,
    /\bis\s+(\w+ing)\b/i, // "is processing", "is running"
  ]

  // Actor detection patterns
  private actorPatterns = {
    service: /https?:\/\/[\w.-]+|api\.[\w.-]+|\w+\.service\.\w+/i,
    database: /FROM\s+(\w+)|INSERT\s+INTO\s+(\w+)|UPDATE\s+(\w+)|DELETE\s+FROM\s+(\w+)/i,
    file: /\.(json|xml|csv|txt|log|conf|env|yaml|toml)["']?/i,
    user: /(user|customer|client|admin|guest)[\s_.-]?(id|email|name)?/i,
  }

  analyzeStory(searchResults: SearchResult[]): CodebaseStory {
    // Extract all strings
    const strings = this.extractStrings(searchResults)
    
    // Find narrative flows
    const flows = this.detectFlows(strings)
    
    // Identify actors
    const actors = this.identifyActors(strings)
    
    // Find conflicts (errors and their resolutions)
    const conflicts = this.findConflicts(strings)
    
    // Detect state transitions
    const states = this.detectStateTransitions(strings)
    
    // Categorize narrative patterns
    const patterns = this.categorizePatterns(strings)
    
    return {
      flows,
      actors,
      conflicts,
      states,
      patterns,
    }
  }

  private extractStrings(results: SearchResult[]): Array<{value: string, context: SemanticInfo}> {
    return results
      .filter(r => r.info.type === 'string')
      .map(r => ({
        value: r.info.term,
        context: r.info,
      }))
  }

  private detectFlows(strings: Array<{value: string, context: SemanticInfo}>): ProcessFlow[] {
    const flows: ProcessFlow[] = []
    const flowGroups = new Map<string, FlowStage[]>()
    
    // Group strings by file/function to find related flow stages
    strings.forEach(({ value, context }) => {
      const location = `${context.location.file}:${this.getFunctionContext(context)}`
      
      if (!flowGroups.has(location)) {
        flowGroups.set(location, [])
      }
      
      const narrativeType = this.getNarrativeType(value)
      if (narrativeType) {
        flowGroups.get(location)!.push({
          pattern: value,
          examples: [value],
          nextStages: [],
          errorStages: [],
        })
      }
    })
    
    // Analyze each group to find flows
    flowGroups.forEach((stages, location) => {
      if (stages.length >= 3) { // Need at least 3 stages for a flow
        const flow = this.buildFlowFromStages(stages, location)
        if (flow) flows.push(flow)
      }
    })
    
    return flows
  }

  private identifyActors(strings: Array<{value: string, context: SemanticInfo}>): StoryActor[] {
    const actors = new Map<string, StoryActor>()
    
    strings.forEach(({ value }) => {
      // Check for service actors (APIs)
      const serviceMatch = value.match(this.actorPatterns.service)
      if (serviceMatch) {
        const actorName = this.normalizeActorName(serviceMatch[0])
        if (!actors.has(actorName)) {
          actors.set(actorName, {
            name: actorName,
            type: 'service',
            interactions: [],
            patterns: [],
          })
        }
        actors.get(actorName)!.interactions.push(value)
      }
      
      // Check for database actors
      const dbMatch = value.match(this.actorPatterns.database)
      if (dbMatch) {
        const tableName = dbMatch[1] || dbMatch[2] || dbMatch[3] || dbMatch[4]
        if (tableName && !actors.has(tableName)) {
          actors.set(tableName, {
            name: tableName,
            type: 'database',
            interactions: [],
            patterns: [],
          })
        }
        if (tableName) actors.get(tableName)!.interactions.push(value)
      }
    })
    
    return Array.from(actors.values())
  }

  private findConflicts(strings: Array<{value: string, context: SemanticInfo}>): ConflictPattern[] {
    const conflicts = new Map<string, ConflictPattern>()
    
    strings.forEach(({ value }) => {
      const errorType = this.categorizeError(value)
      if (errorType) {
        if (!conflicts.has(errorType)) {
          conflicts.set(errorType, {
            category: errorType,
            triggers: [],
            resolutions: [],
            frequency: 0,
          })
        }
        const conflict = conflicts.get(errorType)!
        conflict.triggers.push(value)
        conflict.frequency++
      }
    })
    
    return Array.from(conflicts.values())
  }

  private detectStateTransitions(strings: Array<{value: string, context: SemanticInfo}>): StateTransition[] {
    const transitions = new Map<string, StateTransition>()
    const states = new Set<string>()
    
    // First pass: collect all states
    strings.forEach(({ value }) => {
      this.statePatterns.forEach(pattern => {
        const match = value.match(pattern)
        if (match && match[1]) {
          states.add(match[1].toLowerCase())
        }
      })
    })
    
    // Second pass: look for transitions
    const stateArray = Array.from(states)
    stateArray.forEach((fromState, i) => {
      stateArray.forEach((toState, j) => {
        if (i !== j) {
          const key = `${fromState}->${toState}`
          transitions.set(key, {
            fromState,
            toState,
            triggers: [],
            count: 0,
          })
        }
      })
    })
    
    return Array.from(transitions.values()).filter(t => t.count > 0)
  }

  private categorizePatterns(strings: Array<{value: string, context: SemanticInfo}>): NarrativePattern[] {
    const patterns = new Map<string, NarrativePattern>()
    
    Object.entries(this.narrativeKeywords).forEach(([type, keywords]) => {
      patterns.set(type, {
        type: type as any,
        patterns: [],
      })
      
      strings.forEach(({ value }) => {
        if (keywords.some(keyword => keyword.test(value))) {
          patterns.get(type)!.patterns.push(value)
        }
      })
    })
    
    return Array.from(patterns.values()).filter(p => p.patterns.length > 0)
  }

  // Helper methods
  private getNarrativeType(str: string): string | null {
    for (const [type, patterns] of Object.entries(this.narrativeKeywords)) {
      if (patterns.some(pattern => pattern.test(str))) {
        return type
      }
    }
    return null
  }

  private getFunctionContext(info: SemanticInfo): string {
    // Try to extract function name from context or surrounding lines
    const functionPattern = /function\s+(\w+)|(\w+)\s*\(/
    const match = info.context.match(functionPattern)
    return match ? match[1] || match[2] : 'global'
  }

  private normalizeActorName(actor: string): string {
    // Remove protocols, clean up service names
    return actor
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
  }

  private categorizeError(error: string): string {
    if (/auth|permission|unauthorized|forbidden/i.test(error)) return 'authentication'
    if (/validat|invalid|required|missing/i.test(error)) return 'validation'
    if (/timeout|deadline|expired/i.test(error)) return 'timeout'
    if (/connect|network|unreachable/i.test(error)) return 'connectivity'
    if (/not found|404|missing/i.test(error)) return 'not_found'
    if (/conflict|duplicate|already exists/i.test(error)) return 'conflict'
    return 'general'
  }

  private buildFlowFromStages(stages: FlowStage[], location: string): ProcessFlow | null {
    // Sort stages by narrative type order
    const typeOrder = ['initialization', 'validation', 'processing', 'completion', 'error']
    stages.sort((a, b) => {
      const aType = this.getNarrativeType(a.pattern) || 'unknown'
      const bType = this.getNarrativeType(b.pattern) || 'unknown'
      return typeOrder.indexOf(aType) - typeOrder.indexOf(bType)
    })
    
    // Link stages
    for (let i = 0; i < stages.length - 1; i++) {
      const currentType = this.getNarrativeType(stages[i].pattern)
      const nextType = this.getNarrativeType(stages[i + 1].pattern)
      
      if (nextType === 'error') {
        stages[i].errorStages.push(stages[i + 1].pattern)
      } else {
        stages[i].nextStages.push(stages[i + 1].pattern)
      }
    }
    
    return {
      name: this.inferFlowName(stages),
      stages,
      variations: [],
    }
  }

  private inferFlowName(stages: FlowStage[]): string {
    // Try to infer flow name from the strings
    const keywords = stages.map(s => s.pattern.toLowerCase())
    if (keywords.some(k => k.includes('payment'))) return 'Payment Flow'
    if (keywords.some(k => k.includes('auth'))) return 'Authentication Flow'
    if (keywords.some(k => k.includes('upload'))) return 'Upload Flow'
    if (keywords.some(k => k.includes('order'))) return 'Order Flow'
    return 'Process Flow'
  }
}

// Export a singleton instance
export const storyAnalyzer = new StoryAnalyzer()