/**
 * Story Command - Extract and display codebase narratives
 */

import type { CodebaseStory } from '@codebase-curator/semantic-core'
import chalk from 'chalk'

export class StoryDisplay {
  /**
   * Display the complete codebase story in a beautiful format
   */
  displayStory(story: CodebaseStory): void {
    console.log()
    
    // Header
    this.displayHeader(story)
    
    // Process flows
    if (story.flows.length > 0) {
      this.displayFlows(story.flows)
    }
    
    // Error scenarios
    if (story.errors.length > 0) {
      this.displayErrors(story.errors)
    }
    
    // System boundaries
    if (story.boundaries.length > 0) {
      this.displayBoundaries(story.boundaries)
    }
    
    // Recurring patterns
    if (story.patterns.length > 0) {
      this.displayPatterns(story.patterns)
    }
    
    // Summary
    this.displaySummary(story)
  }
  
  private displayHeader(story: CodebaseStory): void {
    const { totalStrings, coveredFiles, confidence } = story.metadata
    
    console.log(chalk.bold.cyan('╔═══════════════════════════════════════════════════════════════╗'))
    console.log(chalk.bold.cyan('║') + '                  📖 CODEBASE STORY ANALYSIS                  ' + chalk.bold.cyan('║'))
    console.log(chalk.bold.cyan('╠═══════════════════════════════════════════════════════════════╣'))
    console.log(chalk.bold.cyan('║') + ` Analyzed: ${chalk.yellow(totalStrings)} strings across ${chalk.yellow(coveredFiles)} files              ` + chalk.bold.cyan('║'))
    console.log(chalk.bold.cyan('║') + ` Confidence: ${this.getConfidenceBar(confidence)} ${chalk.gray(`(${Math.round(confidence * 100)}%)`)}                  ` + chalk.bold.cyan('║'))
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════╝'))
    console.log()
  }
  
  private displayFlows(flows: CodebaseStory['flows']): void {
    console.log(chalk.bold.green('🔄 PROCESS FLOWS'))
    console.log(chalk.green('─'.repeat(60)))
    
    flows.slice(0, 5).forEach((flow, idx) => {
      console.log()
      console.log(chalk.bold(`${idx + 1}. ${flow.name}`) + chalk.gray(` (${flow.frequency} occurrences)`))
      console.log(`   Files: ${chalk.dim(flow.fileLocations.slice(0, 3).join(', '))}`)
      console.log()
      
      // Display flow steps
      flow.steps.forEach((step, stepIdx) => {
        const prefix = this.getStepIcon(step.type)
        const connector = stepIdx < flow.steps.length - 1 ? '│' : ' '
        
        console.log(`   ${prefix} ${this.truncate(step.text, 50)}`)
        if (stepIdx < flow.steps.length - 1) {
          console.log(`   ${connector}`)
        }
      })
      
      // Show variations if any
      if (flow.variations.length > 0) {
        console.log(chalk.dim(`\n   📌 ${flow.variations.length} variations detected`))
      }
    })
    
    if (flows.length > 5) {
      console.log(chalk.dim(`\n   ... and ${flows.length - 5} more flows`))
    }
    console.log()
  }
  
  private displayErrors(errors: CodebaseStory['errors']): void {
    console.log(chalk.bold.red('⚠️  ERROR SCENARIOS'))
    console.log(chalk.red('─'.repeat(60)))
    
    // Group by category
    const byCategory = this.groupBy(errors, 'category')
    
    Object.entries(byCategory).forEach(([category, categoryErrors]) => {
      console.log()
      console.log(chalk.bold(`${this.getCategoryIcon(category as any)} ${category.toUpperCase()}`))
      
      categoryErrors.slice(0, 3).forEach(error => {
        console.log()
        console.log(`   Trigger: ${chalk.yellow(this.truncate(error.trigger, 40))}`)
        console.log(`   Error:   ${chalk.red(this.truncate(error.error, 40))}`)
        if (error.recovery) {
          console.log(`   Recovery: ${chalk.green(this.truncate(error.recovery, 40))}`)
        }
        console.log(chalk.dim(`   Found in ${error.frequency} locations`))
      })
    })
    console.log()
  }
  
  private displayBoundaries(boundaries: CodebaseStory['boundaries']): void {
    console.log(chalk.bold.blue('🌐 SYSTEM BOUNDARIES'))
    console.log(chalk.blue('─'.repeat(60)))
    
    const byType = this.groupBy(boundaries, 'type')
    
    Object.entries(byType).forEach(([type, typeBoundaries]) => {
      console.log()
      console.log(chalk.bold(`${this.getBoundaryIcon(type as any)} ${type.toUpperCase()}`))
      
      typeBoundaries.slice(0, 5).forEach(boundary => {
        const ops = [...new Set(boundary.usage.map(u => u.operation).filter(Boolean))]
        console.log(`   • ${boundary.identifier} ${ops.length > 0 ? chalk.gray(`[${ops.join(', ')}]`) : ''}`)
      })
    })
    console.log()
  }
  
  private displayPatterns(patterns: CodebaseStory['patterns']): void {
    console.log(chalk.bold.magenta('💫 RECURRING PATTERNS'))
    console.log(chalk.magenta('─'.repeat(60)))
    
    patterns.forEach(pattern => {
      console.log()
      console.log(chalk.bold(`${this.getPatternIcon(pattern.type)} ${pattern.description}`))
      console.log(chalk.gray(`   Found ${pattern.frequency} times`))
      
      // Show a few examples
      pattern.examples.slice(0, 2).forEach(example => {
        console.log(`   • ${chalk.dim(this.truncate(example.text, 50))}`)
      })
    })
    console.log()
  }
  
  private displaySummary(story: CodebaseStory): void {
    console.log(chalk.bold.cyan('📊 SUMMARY'))
    console.log(chalk.cyan('─'.repeat(60)))
    console.log()
    
    // Key insights
    const insights = this.generateInsights(story)
    
    console.log(chalk.bold('Key Insights:'))
    insights.forEach(insight => {
      console.log(`  ${chalk.green('▸')} ${insight}`)
    })
    
    console.log()
    console.log(chalk.dim('Use this story to understand:'))
    console.log(chalk.dim('  • How the system processes data'))
    console.log(chalk.dim('  • What errors to expect and handle'))
    console.log(chalk.dim('  • Which external systems are integrated'))
    console.log(chalk.dim('  • Common patterns and conventions'))
    console.log()
  }
  
  // Helper methods
  
  private getConfidenceBar(confidence: number): string {
    const filled = Math.round(confidence * 10)
    const empty = 10 - filled
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty))
  }
  
  private getStepIcon(type: CodebaseStory['flows'][0]['steps'][0]['type']): string {
    const icons = {
      start: '🟢',
      process: '⚙️ ',
      decision: '❓',
      end: '🏁',
      error: '❌',
    }
    return icons[type] || '•'
  }
  
  private getCategoryIcon(category: CodebaseStory['errors'][0]['category']): string {
    const icons = {
      validation: '✓',
      authentication: '🔐',
      network: '🌐',
      data: '💾',
      system: '⚠️',
      general: '❗',
    }
    return icons[category] || '•'
  }
  
  private getBoundaryIcon(type: CodebaseStory['boundaries'][0]['type']): string {
    const icons = {
      api: '🔌',
      database: '🗄️',
      file: '📁',
      config: '⚙️',
      service: '🔧',
    }
    return icons[type] || '•'
  }
  
  private getPatternIcon(type: CodebaseStory['patterns'][0]['type']): string {
    const icons = {
      retry: '🔁',
      validation: '✅',
      'state-change': '🔄',
      lifecycle: '♻️',
      permission: '🔐',
      cache: '💾',
    }
    return icons[type] || '•'
  }
  
  private truncate(str: string, maxLength: number): string {
    if (!str) return ''
    return str.length <= maxLength ? str : str.substring(0, maxLength - 3) + '...'
  }
  
  private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce((acc, item) => {
      const group = String(item[key])
      if (!acc[group]) acc[group] = []
      acc[group].push(item)
      return acc
    }, {} as Record<string, T[]>)
  }
  
  private generateInsights(story: CodebaseStory): string[] {
    const insights: string[] = []
    
    // Flow insights
    if (story.flows.length > 0) {
      const topFlow = story.flows[0]
      insights.push(`Primary process: ${topFlow.name} with ${topFlow.steps.length} steps`)
    }
    
    // Error insights
    if (story.errors.length > 0) {
      const errorCategories = [...new Set(story.errors.map(e => e.category))]
      const withRecovery = story.errors.filter(e => e.recovery).length
      insights.push(`${story.errors.length} error scenarios across ${errorCategories.length} categories (${withRecovery} with recovery)`)
    }
    
    // Boundary insights
    if (story.boundaries.length > 0) {
      const types = [...new Set(story.boundaries.map(b => b.type))]
      insights.push(`Integrates with ${story.boundaries.length} external systems (${types.join(', ')})`)
    }
    
    // Pattern insights
    if (story.patterns.length > 0) {
      const topPattern = story.patterns.sort((a, b) => b.frequency - a.frequency)[0]
      insights.push(`Most common pattern: ${topPattern.description} (${topPattern.frequency} occurrences)`)
    }
    
    return insights
  }
}