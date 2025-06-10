/**
 * Story Extractor - Extracts narrative patterns from codebase strings
 */

import type { 
  CodebaseStory, 
  ProcessFlow, 
  ErrorScenario, 
  SystemBoundary,
  RecurringPattern,
  ExtractedString,
  FlowStep,
  CodeLocation,
  BoundaryUsage
} from '../types/story'
import { UNIVERSAL_PATTERNS } from '../types/story'
import type { SearchResult } from '../types'

export class StoryExtractor {
  /**
   * Extract story from search results (all strings in codebase)
   */
  extractStory(searchResults: SearchResult[]): CodebaseStory {
    // Convert search results to extracted strings
    const strings = this.prepareStrings(searchResults)
    
    // Extract different story elements
    const flows = this.extractFlows(strings)
    const errors = this.extractErrorScenarios(strings)
    const boundaries = this.extractBoundaries(strings)
    const patterns = this.extractPatterns(strings)
    
    return {
      flows,
      errors,
      boundaries,
      patterns,
      metadata: {
        extractedAt: Date.now(),
        totalStrings: strings.length,
        coveredFiles: new Set(strings.map(s => s.location.file)).size,
        confidence: this.calculateConfidence(flows, errors, boundaries),
      },
    }
  }
  
  private prepareStrings(results: SearchResult[]): ExtractedString[] {
    return results
      .filter(r => r.info.type === 'string' || r.info.type === 'comment')
      .map(r => ({
        value: r.info.term,
        location: {
          file: r.info.location.file,
          line: r.info.location.line,
          column: r.info.location.column,
          function: this.extractFunctionName(r.info),
        },
        type: r.info.type,
        context: r.info.context,
        metadata: r.info.metadata,
      }))
  }
  
  /**
   * Extract process flows from strings
   */
  private extractFlows(strings: ExtractedString[]): ProcessFlow[] {
    const flows: ProcessFlow[] = []
    
    // Group strings by location proximity
    const locationGroups = this.groupByLocation(strings)
    
    locationGroups.forEach((group, groupId) => {
      // Look for temporal sequences
      const temporalStrings = group.filter(s => 
        this.hasTemporalMarker(s.value)
      )
      
      if (temporalStrings.length >= 3) {
        const flow = this.buildFlowFromStrings(temporalStrings, groupId)
        if (flow) flows.push(flow)
      }
    })
    
    // Merge similar flows
    return this.mergeSimilarFlows(flows)
  }
  
  /**
   * Extract error scenarios
   */
  private extractErrorScenarios(strings: ExtractedString[]): ErrorScenario[] {
    const errors: ErrorScenario[] = []
    const errorMap = new Map<string, ErrorScenario>()
    
    strings.forEach(str => {
      if (this.isErrorString(str.value)) {
        const category = this.categorizeError(str.value)
        const key = `${category}:${this.normalizeError(str.value)}`
        
        if (!errorMap.has(key)) {
          errorMap.set(key, {
            id: this.generateId('error'),
            category,
            trigger: this.findErrorTrigger(str, strings),
            error: str.value,
            recovery: this.findErrorRecovery(str, strings),
            frequency: 1,
            locations: [str.location],
          })
        } else {
          const existing = errorMap.get(key)!
          existing.frequency++
          existing.locations.push(str.location)
        }
      }
    })
    
    return Array.from(errorMap.values())
      .sort((a, b) => b.frequency - a.frequency)
  }
  
  /**
   * Extract system boundaries
   */
  private extractBoundaries(strings: ExtractedString[]): SystemBoundary[] {
    const boundaries = new Map<string, SystemBoundary>()
    
    strings.forEach(str => {
      const boundaryInfo = this.detectBoundary(str.value)
      if (boundaryInfo) {
        const key = `${boundaryInfo.type}:${boundaryInfo.identifier}`
        
        if (!boundaries.has(key)) {
          boundaries.set(key, {
            id: this.generateId('boundary'),
            type: boundaryInfo.type,
            identifier: boundaryInfo.identifier,
            protocol: boundaryInfo.protocol,
            usage: [{
              context: str.context,
              location: str.location,
              operation: boundaryInfo.operation,
            }],
          })
        } else {
          boundaries.get(key)!.usage.push({
            context: str.context,
            location: str.location,
            operation: boundaryInfo.operation,
          })
        }
      }
    })
    
    return Array.from(boundaries.values())
  }
  
  /**
   * Extract recurring patterns
   */
  private extractPatterns(strings: ExtractedString[]): RecurringPattern[] {
    const patterns: RecurringPattern[] = []
    
    // Retry patterns
    const retryPattern = this.findRetryPatterns(strings)
    if (retryPattern) patterns.push(retryPattern)
    
    // Validation patterns
    const validationPattern = this.findValidationPatterns(strings)
    if (validationPattern) patterns.push(validationPattern)
    
    // State change patterns
    const statePattern = this.findStatePatterns(strings)
    if (statePattern) patterns.push(statePattern)
    
    // Lifecycle patterns
    const lifecyclePattern = this.findLifecyclePatterns(strings)
    if (lifecyclePattern) patterns.push(lifecyclePattern)
    
    return patterns.filter(p => p.frequency > 2) // Only significant patterns
  }
  
  // Helper methods
  
  private groupByLocation(strings: ExtractedString[]): Map<string, ExtractedString[]> {
    const groups = new Map<string, ExtractedString[]>()
    
    strings.forEach(str => {
      // Group by file + function
      const key = `${str.location.file}:${str.location.function || 'global'}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(str)
    })
    
    return groups
  }
  
  private hasTemporalMarker(str: string): boolean {
    return (
      UNIVERSAL_PATTERNS.temporal.start.test(str) ||
      UNIVERSAL_PATTERNS.temporal.process.test(str) ||
      UNIVERSAL_PATTERNS.temporal.end.test(str)
    )
  }
  
  private isErrorString(str: string): boolean {
    return (
      UNIVERSAL_PATTERNS.failure.error.test(str) ||
      UNIVERSAL_PATTERNS.failure.invalid.test(str) ||
      UNIVERSAL_PATTERNS.failure.missing.test(str)
    )
  }
  
  private buildFlowFromStrings(strings: ExtractedString[], groupId: string): ProcessFlow | null {
    // Sort by line number
    const sorted = strings.sort((a, b) => a.location.line - b.location.line)
    
    // Build steps
    const steps: FlowStep[] = sorted.map((str, index) => ({
      text: str.value,
      type: this.getStepType(str.value),
      location: str.location,
      nextSteps: index < sorted.length - 1 ? [this.generateId('step')] : [],
      errorSteps: [],
    }))
    
    // Look for error branches
    this.findErrorBranches(steps, sorted)
    
    if (steps.length < 3) return null
    
    return {
      id: this.generateId('flow'),
      name: this.inferFlowName(steps),
      steps,
      frequency: 1,
      variations: [],
      fileLocations: [sorted[0].location.file],
    }
  }
  
  private getStepType(str: string): FlowStep['type'] {
    if (UNIVERSAL_PATTERNS.temporal.start.test(str)) return 'start'
    if (UNIVERSAL_PATTERNS.temporal.end.test(str)) return 'end'
    if (UNIVERSAL_PATTERNS.failure.error.test(str)) return 'error'
    if (/\?|if|when|check/i.test(str)) return 'decision'
    return 'process'
  }
  
  private inferFlowName(steps: FlowStep[]): string {
    // Try to infer from the strings
    const keywords = steps.map(s => s.text.toLowerCase())
    
    // Look for domain terms
    if (keywords.some(k => k.includes('payment'))) return 'Payment Flow'
    if (keywords.some(k => k.includes('auth'))) return 'Authentication Flow'
    if (keywords.some(k => k.includes('order'))) return 'Order Flow'
    if (keywords.some(k => k.includes('upload'))) return 'Upload Flow'
    if (keywords.some(k => k.includes('process'))) return 'Processing Flow'
    
    // Default: use first meaningful word
    const firstStep = steps[0].text
    const match = firstStep.match(/\b(\w+ing)\b/i)
    return match ? `${match[1]} Flow` : 'Process Flow'
  }
  
  private categorizeError(error: string): ErrorScenario['category'] {
    const lower = error.toLowerCase()
    
    if (/auth|permission|forbidden|unauthorized|token/i.test(lower)) return 'authentication'
    if (/valid|format|required|must|should|expect/i.test(lower)) return 'validation'
    if (/timeout|connection|network|unreachable|refused/i.test(lower)) return 'network'
    if (/database|query|transaction|constraint/i.test(lower)) return 'data'
    if (/memory|resource|system|crash|fatal/i.test(lower)) return 'system'
    
    return 'general'
  }
  
  private detectBoundary(str: string): {
    type: SystemBoundary['type']
    identifier: string
    protocol?: string
    operation?: string
  } | null {
    // API detection
    const apiMatch = str.match(/https?:\/\/([\w.-]+)/)
    if (apiMatch && !apiMatch[1].includes('localhost')) {
      return {
        type: 'api',
        identifier: apiMatch[1],
        protocol: 'http',
        operation: this.detectHttpMethod(str),
      }
    }
    
    // Database detection
    const dbMatch = str.match(/\b(SELECT|INSERT|UPDATE|DELETE)\b.*?\bFROM\s+(\w+)/i)
    if (dbMatch) {
      return {
        type: 'database',
        identifier: dbMatch[2].toLowerCase(),
        operation: dbMatch[1].toUpperCase(),
      }
    }
    
    // File detection
    const fileMatch = str.match(/["']([^"']+\.(json|xml|csv|txt|log|pdf|env))["']/)
    if (fileMatch) {
      return {
        type: 'file',
        identifier: fileMatch[1],
        protocol: 'file',
      }
    }
    
    // Config detection
    if (/process\.env\.(\w+)|ENV\[["'](\w+)["']\]/.test(str)) {
      const match = str.match(/process\.env\.(\w+)|ENV\[["'](\w+)["']\]/)
      return {
        type: 'config',
        identifier: match![1] || match![2],
      }
    }
    
    return null
  }
  
  private findRetryPatterns(strings: ExtractedString[]): RecurringPattern | null {
    const retryExamples = strings.filter(s => 
      /retry|attempt|tries|attempts remaining/i.test(s.value)
    )
    
    if (retryExamples.length < 3) return null
    
    return {
      id: this.generateId('pattern'),
      type: 'retry',
      description: 'Retry logic with attempts tracking',
      examples: retryExamples.slice(0, 5).map(s => ({
        text: s.value,
        location: s.location,
      })),
      frequency: retryExamples.length,
    }
  }
  
  private findValidationPatterns(strings: ExtractedString[]): RecurringPattern | null {
    const validationExamples = strings.filter(s =>
      /invalid|valid|required|must|should not|cannot be/i.test(s.value)
    )
    
    if (validationExamples.length < 3) return null
    
    return {
      id: this.generateId('pattern'),
      type: 'validation',
      description: 'Input validation and constraints',
      examples: validationExamples.slice(0, 5).map(s => ({
        text: s.value,
        location: s.location,
      })),
      frequency: validationExamples.length,
    }
  }
  
  private findStatePatterns(strings: ExtractedString[]): RecurringPattern | null {
    const stateExamples = strings.filter(s =>
      UNIVERSAL_PATTERNS.state.status.test(s.value)
    )
    
    if (stateExamples.length < 3) return null
    
    return {
      id: this.generateId('pattern'),
      type: 'state-change',
      description: 'State transitions and status tracking',
      examples: stateExamples.slice(0, 5).map(s => ({
        text: s.value,
        location: s.location,
      })),
      frequency: stateExamples.length,
    }
  }
  
  private findLifecyclePatterns(strings: ExtractedString[]): RecurringPattern | null {
    const lifecycleGroups = new Map<string, ExtractedString[]>()
    
    // Group by entity (user, order, session, etc.)
    strings.forEach(s => {
      const match = s.value.match(/\b(creat|add|new|updat|modif|delet|remov|destroy)(?:e|ing|ed)?\s+(\w+)/i)
      if (match) {
        const entity = match[2].toLowerCase()
        if (!lifecycleGroups.has(entity)) {
          lifecycleGroups.set(entity, [])
        }
        lifecycleGroups.get(entity)!.push(s)
      }
    })
    
    // Find entities with full lifecycle
    const fullLifecycles = Array.from(lifecycleGroups.entries())
      .filter(([_, examples]) => examples.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
    
    if (fullLifecycles.length === 0) return null
    
    const [topEntity, examples] = fullLifecycles[0]
    
    return {
      id: this.generateId('pattern'),
      type: 'lifecycle',
      description: `Entity lifecycle management (${topEntity})`,
      examples: examples.slice(0, 5).map(s => ({
        text: s.value,
        location: s.location,
      })),
      frequency: examples.length,
    }
  }
  
  private mergeSimilarFlows(flows: ProcessFlow[]): ProcessFlow[] {
    const merged = new Map<string, ProcessFlow>()
    
    flows.forEach(flow => {
      const key = this.getFlowSignature(flow)
      if (merged.has(key)) {
        const existing = merged.get(key)!
        existing.frequency++
        existing.fileLocations.push(...flow.fileLocations)
        // Merge variations if steps differ slightly
      } else {
        merged.set(key, flow)
      }
    })
    
    return Array.from(merged.values())
  }
  
  private getFlowSignature(flow: ProcessFlow): string {
    // Create a signature based on step types and key words
    return flow.steps
      .map(s => `${s.type}:${this.extractKeyword(s.text)}`)
      .join('->')
  }
  
  private extractKeyword(text: string): string {
    // Extract the most significant word
    const words = text.split(/\s+/)
    const keyword = words.find(w => 
      w.length > 3 && !/^(the|and|for|with|from|into)$/i.test(w)
    )
    return keyword?.toLowerCase() || 'step'
  }
  
  private findErrorTrigger(error: ExtractedString, allStrings: ExtractedString[]): string {
    // Look for strings before this error in the same scope
    const before = allStrings.filter(s =>
      s.location.file === error.location.file &&
      s.location.function === error.location.function &&
      s.location.line < error.location.line &&
      s.location.line > error.location.line - 10
    ).sort((a, b) => b.location.line - a.location.line)
    
    // Find the most likely trigger
    const trigger = before.find(s =>
      /check|validat|verif|if|when/i.test(s.value)
    )
    
    return trigger?.value || 'Unknown trigger'
  }
  
  private findErrorRecovery(error: ExtractedString, allStrings: ExtractedString[]): string | undefined {
    // Look for recovery strings after this error
    const after = allStrings.filter(s =>
      s.location.file === error.location.file &&
      s.location.function === error.location.function &&
      s.location.line > error.location.line &&
      s.location.line < error.location.line + 10
    ).sort((a, b) => a.location.line - b.location.line)
    
    // Find recovery patterns
    const recovery = after.find(s =>
      /retry|fallback|recover|rollback|default|try again/i.test(s.value)
    )
    
    return recovery?.value
  }
  
  private findErrorBranches(steps: FlowStep[], strings: ExtractedString[]): void {
    // For each step, look for nearby error strings
    steps.forEach((step, index) => {
      const nearbyErrors = strings.filter(s =>
        s.location.line > step.location!.line &&
        s.location.line < step.location!.line + 5 &&
        this.isErrorString(s.value)
      )
      
      if (nearbyErrors.length > 0) {
        // Add error branches
        nearbyErrors.forEach(error => {
          const errorStep: FlowStep = {
            text: error.value,
            type: 'error',
            location: error.location,
            nextSteps: [],
            errorSteps: [],
          }
          // Would need to properly integrate this into the flow
        })
      }
    })
  }
  
  private normalizeError(error: string): string {
    // Normalize for grouping similar errors
    return error
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/\d+/g, 'N')
      .replace(/\s+/g, ' ')
      .trim()
  }
  
  private detectHttpMethod(str: string): string | undefined {
    const match = str.match(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/i)
    return match ? match[1].toUpperCase() : undefined
  }
  
  private extractFunctionName(info: any): string | undefined {
    // Try to extract function name from context
    // This would need to be enhanced based on language
    const match = info.context.match(/function\s+(\w+)|(\w+)\s*\(/i)
    return match ? match[1] || match[2] : undefined
  }
  
  private calculateConfidence(
    flows: ProcessFlow[],
    errors: ErrorScenario[],
    boundaries: SystemBoundary[]
  ): number {
    // Calculate confidence based on pattern clarity
    let score = 0
    
    // More flows = better understanding
    if (flows.length > 0) score += 0.3
    if (flows.length > 5) score += 0.2
    
    // Error patterns add confidence
    if (errors.length > 0) score += 0.2
    if (errors.some(e => e.recovery)) score += 0.1
    
    // Clear boundaries add confidence
    if (boundaries.length > 0) score += 0.2
    
    return Math.min(score, 1)
  }
  
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }
}