/**
 * Story Integration for Smart Grep
 * Practical story elements that help Claudes understand code faster
 */

import type { SearchResult, SemanticInfo } from '@codebase-curator/semantic-core'
import chalk from 'chalk'

export interface PracticalStory {
  flows: ProcessFlow[]        // "This leads to that"
  errorPaths: ErrorPath[]     // "What can go wrong"
  boundaries: Boundary[]      // "Who we talk to"
  patterns: Pattern[]         // "What repeats"
}

export interface ProcessFlow {
  name: string
  steps: string[]
  frequency: number
  mainPath: string[]
  errorPath?: string[]
}

export interface ErrorPath {
  trigger: string
  error: string
  recovery?: string
  frequency: number
}

export interface Boundary {
  type: 'api' | 'database' | 'file' | 'config'
  identifier: string
  usage: string[]
}

export interface Pattern {
  type: 'retry' | 'validation' | 'state-change' | 'lifecycle'
  examples: string[]
}

export class StoryIntegration {
  /**
   * Add story context to compact search results
   */
  enhanceCompactResults(query: string, results: SearchResult[], story: PracticalStory): string {
    const output: string[] = []
    
    // Regular compact header
    output.push(`🔍 SMARTGREP: "${query}" (${results.length} results)`)
    
    // NEW: Add story context if relevant
    const relevantFlow = this.findRelevantFlow(query, story.flows)
    if (relevantFlow) {
      output.push(``)
      output.push(`📖 STORY CONTEXT:`)
      output.push(`   Part of: ${relevantFlow.name}`)
      output.push(`   Flow: ${relevantFlow.steps.map(s => this.truncate(s, 20)).join(' → ')}`)
      
      const stepIndex = relevantFlow.steps.findIndex(s => 
        s.toLowerCase().includes(query.toLowerCase())
      )
      if (stepIndex > 0) {
        output.push(`   Comes after: "${this.truncate(relevantFlow.steps[stepIndex - 1], 40)}"`)
      }
      if (stepIndex < relevantFlow.steps.length - 1) {
        output.push(`   Leads to: "${this.truncate(relevantFlow.steps[stepIndex + 1], 40)}"`)
      }
    }
    
    // Check if it's an error term
    const errorContext = this.findErrorContext(query, story.errorPaths)
    if (errorContext.length > 0) {
      output.push(``)
      output.push(`⚠️ ERROR PATTERNS:`)
      errorContext.slice(0, 3).forEach(err => {
        output.push(`   • ${err.trigger} → ${err.error}`)
        if (err.recovery) {
          output.push(`     ↻ Recovery: ${err.recovery}`)
        }
      })
    }
    
    // Continue with regular results...
    return output.join('\n')
  }
  
  /**
   * Add story navigation to full results
   */
  enhanceFullResults(query: string, results: SearchResult[], story: PracticalStory): string {
    // At the end of full results, add story navigation
    const output: string[] = []
    
    output.push(`\n🗺️ STORY NAVIGATION:`)
    
    // Show where this fits in the bigger picture
    const flows = this.findAllFlowsContaining(query, story.flows)
    if (flows.length > 0) {
      output.push(`\n📖 Appears in ${flows.length} process flows:`)
      flows.forEach(flow => {
        output.push(`   • ${flow.name}: ${this.getFlowPosition(query, flow)}`)
      })
    }
    
    // Show related boundaries
    const boundaries = this.findRelatedBoundaries(results, story.boundaries)
    if (boundaries.length > 0) {
      output.push(`\n🌐 External connections:`)
      boundaries.forEach(boundary => {
        output.push(`   • ${this.getBoundaryIcon(boundary.type)} ${boundary.identifier}`)
      })
    }
    
    // Suggest story exploration
    output.push(`\n💡 Explore the full story:`)
    output.push(`   ${chalk.cyan(`smartgrep story "${query}"`)} - See complete narrative`)
    output.push(`   ${chalk.cyan(`smartgrep story --flows`)} - See all process flows`)
    
    return output.join('\n')
  }
  
  /**
   * The main story command display
   */
  displayStory(query: string | undefined, story: PracticalStory): string {
    const output: string[] = []
    
    // Beautiful header
    output.push(this.createStoryHeader(query))
    
    // Process flows - THE MOST USEFUL PART
    if (story.flows.length > 0) {
      output.push(this.displayFlows(story.flows, query))
    }
    
    // Error scenarios - SUPER USEFUL
    if (story.errorPaths.length > 0) {
      output.push(this.displayErrorScenarios(story.errorPaths))
    }
    
    // External boundaries - ARCHITECTURAL UNDERSTANDING
    if (story.boundaries.length > 0) {
      output.push(this.displayBoundaries(story.boundaries))
    }
    
    // Patterns - BEHAVIORAL INSIGHTS
    if (story.patterns.length > 0) {
      output.push(this.displayPatterns(story.patterns))
    }
    
    return output.join('\n\n')
  }
  
  private displayFlows(flows: ProcessFlow[], highlightQuery?: string): string {
    const output: string[] = []
    
    output.push(chalk.blue('╔══════════════════════════════════════════════════╗'))
    output.push(chalk.blue('║') + chalk.bold.white('         🌊 PROCESS FLOWS                    ') + chalk.blue('║'))
    output.push(chalk.blue('╚══════════════════════════════════════════════════╝'))
    
    // Sort by frequency (most common flows first)
    flows.sort((a, b) => b.frequency - a.frequency).slice(0, 5).forEach(flow => {
      output.push(``)
      output.push(chalk.bold(`📖 ${flow.name}`) + chalk.gray(` (occurs ${flow.frequency} times)`))
      
      // Display main flow
      output.push(this.drawFlowDiagram(flow.mainPath, flow.errorPath, highlightQuery))
    })
    
    return output.join('\n')
  }
  
  private drawFlowDiagram(mainPath: string[], errorPath?: string[], highlight?: string): string {
    const output: string[] = []
    
    mainPath.forEach((step, index) => {
      const isHighlighted = highlight && step.toLowerCase().includes(highlight.toLowerCase())
      const isLast = index === mainPath.length - 1
      
      const stepDisplay = isHighlighted 
        ? chalk.yellow.bold(`▶ ${step}`) 
        : `  ${step}`
      
      output.push(stepDisplay)
      
      if (!isLast) {
        output.push(`  ↓`)
      }
      
      // Show error branch at appropriate step
      if (errorPath && index === Math.floor(mainPath.length / 2)) {
        output.push(`  ├─❌ ${chalk.red(errorPath[0])}`)
        if (errorPath.length > 1) {
          output.push(`  │   └─ ${chalk.yellow(errorPath[1])}`)
        }
      }
    })
    
    return output.join('\n')
  }
  
  private displayErrorScenarios(errors: ErrorPath[]): string {
    const output: string[] = []
    
    output.push(chalk.red('╔══════════════════════════════════════════════════╗'))
    output.push(chalk.red('║') + chalk.bold.white('         ⚠️  WHAT CAN GO WRONG               ') + chalk.red('║'))
    output.push(chalk.red('╚══════════════════════════════════════════════════╝'))
    
    // Group by category
    const categorized = this.categorizeErrors(errors)
    
    Object.entries(categorized).forEach(([category, categoryErrors]) => {
      output.push(``)
      output.push(chalk.bold(`${this.getErrorIcon(category)} ${category.toUpperCase()}`))
      
      categoryErrors.slice(0, 3).forEach(error => {
        output.push(`   ${chalk.red('▸')} ${error.error}`)
        if (error.trigger) {
          output.push(`     ${chalk.gray('When:')} ${error.trigger}`)
        }
        if (error.recovery) {
          output.push(`     ${chalk.green('Recovery:')} ${error.recovery}`)
        }
      })
    })
    
    return output.join('\n')
  }
  
  private displayBoundaries(boundaries: Boundary[]): string {
    const output: string[] = []
    
    output.push(chalk.green('╔══════════════════════════════════════════════════╗'))
    output.push(chalk.green('║') + chalk.bold.white('         🌐 EXTERNAL DEPENDENCIES            ') + chalk.green('║'))
    output.push(chalk.green('╚══════════════════════════════════════════════════╝'))
    
    // Group by type
    const grouped = boundaries.reduce((acc, b) => {
      if (!acc[b.type]) acc[b.type] = []
      acc[b.type].push(b)
      return acc
    }, {} as Record<string, Boundary[]>)
    
    Object.entries(grouped).forEach(([type, items]) => {
      output.push(``)
      output.push(chalk.bold(`${this.getBoundaryIcon(type)} ${type.toUpperCase()}`))
      
      items.forEach(boundary => {
        output.push(`   • ${chalk.cyan(boundary.identifier)}`)
        // Show one example usage
        if (boundary.usage.length > 0) {
          output.push(`     ${chalk.gray(this.truncate(boundary.usage[0], 50))}`)
        }
      })
    })
    
    return output.join('\n')
  }
  
  // Helper methods
  private truncate(str: string, len: number): string {
    return str.length > len ? str.substring(0, len - 3) + '...' : str
  }
  
  private getBoundaryIcon(type: string): string {
    const icons = {
      api: '🌐',
      database: '💾',
      file: '📁',
      config: '⚙️',
    }
    return icons[type] || '📌'
  }
  
  private getErrorIcon(category: string): string {
    const icons = {
      validation: '⚠️',
      authentication: '🔐',
      network: '🔌',
      data: '💾',
      system: '⚡',
    }
    return icons[category] || '❌'
  }
  
  private categorizeErrors(errors: ErrorPath[]): Record<string, ErrorPath[]> {
    const categories: Record<string, ErrorPath[]> = {}
    
    errors.forEach(error => {
      let category = 'general'
      
      if (/auth|permission|forbidden/i.test(error.error)) category = 'authentication'
      else if (/valid|format|require/i.test(error.error)) category = 'validation'
      else if (/timeout|connect|network/i.test(error.error)) category = 'network'
      else if (/data|database|query/i.test(error.error)) category = 'data'
      else if (/system|memory|resource/i.test(error.error)) category = 'system'
      
      if (!categories[category]) categories[category] = []
      categories[category].push(error)
    })
    
    return categories
  }
  
  private findRelevantFlow(query: string, flows: ProcessFlow[]): ProcessFlow | undefined {
    return flows.find(flow => 
      flow.steps.some(step => step.toLowerCase().includes(query.toLowerCase()))
    )
  }
  
  private findErrorContext(query: string, errors: ErrorPath[]): ErrorPath[] {
    return errors.filter(err => 
      err.error.toLowerCase().includes(query.toLowerCase()) ||
      err.trigger.toLowerCase().includes(query.toLowerCase())
    )
  }
  
  private createStoryHeader(query?: string): string {
    const title = query ? `📚 STORY: "${query}"` : '📚 CODEBASE STORY'
    const width = 52
    const padding = Math.floor((width - title.length) / 2)
    
    return [
      chalk.cyan('═'.repeat(width)),
      ' '.repeat(padding) + chalk.bold.white(title),
      chalk.cyan('═'.repeat(width)),
    ].join('\n')
  }
  
  private getFlowPosition(query: string, flow: ProcessFlow): string {
    const index = flow.steps.findIndex(s => 
      s.toLowerCase().includes(query.toLowerCase())
    )
    if (index === 0) return 'starts the flow'
    if (index === flow.steps.length - 1) return 'completes the flow'
    return `step ${index + 1} of ${flow.steps.length}`
  }
  
  private findAllFlowsContaining(query: string, flows: ProcessFlow[]): ProcessFlow[] {
    return flows.filter(flow =>
      flow.steps.some(step => step.toLowerCase().includes(query.toLowerCase()))
    )
  }
  
  private findRelatedBoundaries(results: SearchResult[], boundaries: Boundary[]): Boundary[] {
    const files = new Set(results.map(r => r.info.location.file))
    
    return boundaries.filter(boundary =>
      boundary.usage.some(usage => 
        Array.from(files).some(file => usage.includes(file))
      )
    )
  }
}