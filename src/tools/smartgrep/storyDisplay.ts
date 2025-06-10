/**
 * Story Display - Beautiful narrative visualization for code stories
 */

import chalk from 'chalk'
import type { CodebaseStory, ProcessFlow, StoryActor, ConflictPattern } from '@codebase-curator/semantic-core'

export class StoryDisplay {
  displayStory(story: CodebaseStory): string {
    const output: string[] = []
    
    // Header
    output.push(this.createHeader())
    
    // Process Flows - The main narrative
    if (story.flows.length > 0) {
      output.push(this.displayFlows(story.flows))
    }
    
    // Actors - The cast
    if (story.actors.length > 0) {
      output.push(this.displayActors(story.actors))
    }
    
    // Conflicts - What can go wrong
    if (story.conflicts.length > 0) {
      output.push(this.displayConflicts(story.conflicts))
    }
    
    // State Machine - The transitions
    if (story.states.length > 0) {
      output.push(this.displayStates(story.states))
    }
    
    // Patterns - The recurring themes
    if (story.patterns.length > 0) {
      output.push(this.displayPatterns(story.patterns))
    }
    
    return output.join('\n\n')
  }
  
  private createHeader(): string {
    const width = 70
    const title = '📚 THE CODEBASE STORY'
    const padding = Math.floor((width - title.length) / 2)
    
    return [
      chalk.cyan('═'.repeat(width)),
      chalk.cyan('║') + ' '.repeat(padding) + chalk.bold.white(title) + ' '.repeat(width - padding - title.length - 2) + chalk.cyan('║'),
      chalk.cyan('═'.repeat(width)),
    ].join('\n')
  }
  
  private displayFlows(flows: ProcessFlow[]): string {
    const output: string[] = []
    
    output.push(chalk.blue('┌─ 🌊 PROCESS FLOWS ─────────────────────────────┐'))
    
    flows.forEach((flow, index) => {
      output.push(chalk.blue('│'))
      output.push(chalk.blue('│ ') + chalk.bold.white(`📖 ${flow.name}`))
      output.push(chalk.blue('│'))
      
      // Display flow as a beautiful diagram
      flow.stages.forEach((stage, i) => {
        const isLast = i === flow.stages.length - 1
        const narrativeType = this.getNarrativeIcon(stage.pattern)
        
        // Main stage
        output.push(chalk.blue('│   ') + narrativeType + ' ' + chalk.yellow(this.truncateString(stage.pattern, 50)))
        
        // Show connections
        if (!isLast) {
          if (stage.errorStages.length > 0) {
            output.push(chalk.blue('│   ') + '  ├─❌ ' + chalk.red(this.truncateString(stage.errorStages[0], 45)))
          }
          output.push(chalk.blue('│   ') + '  ↓')
        }
      })
      
      if (index < flows.length - 1) {
        output.push(chalk.blue('│'))
        output.push(chalk.blue('├' + '─'.repeat(48)))
      }
    })
    
    output.push(chalk.blue('└' + '─'.repeat(48) + '┘'))
    
    return output.join('\n')
  }
  
  private displayActors(actors: StoryActor[]): string {
    const output: string[] = []
    
    output.push(chalk.green('┌─ 🎭 THE ACTORS ────────────────────────────────┐'))
    
    // Group actors by type
    const grouped = actors.reduce((acc, actor) => {
      if (!acc[actor.type]) acc[actor.type] = []
      acc[actor.type].push(actor)
      return acc
    }, {} as Record<string, StoryActor[]>)
    
    Object.entries(grouped).forEach(([type, typeActors]) => {
      output.push(chalk.green('│'))
      output.push(chalk.green('│ ') + chalk.bold(this.getActorTypeDisplay(type)))
      
      typeActors.forEach(actor => {
        output.push(chalk.green('│   ') + '• ' + chalk.white(actor.name))
        // Show sample interactions
        const samples = actor.interactions.slice(0, 2)
        samples.forEach(interaction => {
          output.push(chalk.green('│     ') + chalk.gray(this.truncateString(interaction, 40)))
        })
      })
    })
    
    output.push(chalk.green('└' + '─'.repeat(48) + '┘'))
    
    return output.join('\n')
  }
  
  private displayConflicts(conflicts: ConflictPattern[]): string {
    const output: string[] = []
    
    output.push(chalk.red('┌─ ⚡ CONFLICTS & ERRORS ─────────────────────────┐'))
    
    // Sort by frequency
    conflicts.sort((a, b) => b.frequency - a.frequency)
    
    conflicts.slice(0, 5).forEach(conflict => {
      output.push(chalk.red('│'))
      output.push(chalk.red('│ ') + chalk.bold(this.getConflictIcon(conflict.category) + ' ' + 
        this.titleCase(conflict.category)) + chalk.gray(` (${conflict.frequency} occurrences)`))
      
      // Show top triggers
      conflict.triggers.slice(0, 3).forEach(trigger => {
        output.push(chalk.red('│   ') + '• ' + chalk.yellow(this.truncateString(trigger, 45)))
      })
    })
    
    output.push(chalk.red('└' + '─'.repeat(48) + '┘'))
    
    return output.join('\n')
  }
  
  private displayStates(states: any[]): string {
    const output: string[] = []
    
    output.push(chalk.magenta('┌─ 🔄 STATE TRANSITIONS ──────────────────────────┐'))
    
    // Create a simple state diagram
    const uniqueStates = new Set<string>()
    states.forEach(s => {
      uniqueStates.add(s.fromState)
      uniqueStates.add(s.toState)
    })
    
    output.push(chalk.magenta('│'))
    output.push(chalk.magenta('│ ') + chalk.bold('State Machine:'))
    
    // Show top transitions
    states.slice(0, 5).forEach(transition => {
      output.push(chalk.magenta('│   ') + 
        chalk.yellow(transition.fromState) + ' → ' + chalk.green(transition.toState) +
        chalk.gray(` (${transition.count}x)`))
    })
    
    output.push(chalk.magenta('└' + '─'.repeat(48) + '┘'))
    
    return output.join('\n')
  }
  
  private displayPatterns(patterns: any[]): string {
    const output: string[] = []
    
    output.push(chalk.cyan('┌─ 🎯 NARRATIVE PATTERNS ─────────────────────────┐'))
    
    patterns.forEach(pattern => {
      if (pattern.patterns.length > 0) {
        output.push(chalk.cyan('│'))
        output.push(chalk.cyan('│ ') + chalk.bold(this.getNarrativeIcon(pattern.type) + ' ' + 
          this.titleCase(pattern.type)) + chalk.gray(` (${pattern.patterns.length} instances)`))
        
        // Show examples
        pattern.patterns.slice(0, 3).forEach(example => {
          output.push(chalk.cyan('│   ') + '• ' + chalk.white(this.truncateString(example, 45)))
        })
      }
    })
    
    output.push(chalk.cyan('└' + '─'.repeat(48) + '┘'))
    
    return output.join('\n')
  }
  
  // Helper methods
  private getNarrativeIcon(text: string): string {
    const lower = text.toLowerCase()
    if (/start|init|begin|load/.test(lower)) return '🚀'
    if (/process|handl|execut/.test(lower)) return '⚙️'
    if (/validat|check|verif/.test(lower)) return '✓'
    if (/complet|finish|success/.test(lower)) return '✅'
    if (/error|fail|cannot/.test(lower)) return '❌'
    return '📍'
  }
  
  private getActorTypeDisplay(type: string): string {
    const displays: Record<string, string> = {
      service: '🌐 External Services',
      database: '💾 Data Stores',
      file: '📄 Files & Resources',
      user: '👤 Users & Roles',
      external: '🔗 External Systems',
    }
    return displays[type] || type
  }
  
  private getConflictIcon(category: string): string {
    const icons: Record<string, string> = {
      authentication: '🔐',
      validation: '⚠️',
      timeout: '⏱️',
      connectivity: '🔌',
      not_found: '❓',
      conflict: '💥',
      general: '❌',
    }
    return icons[category] || '❌'
  }
  
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength - 3) + '...'
  }
  
  private titleCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ')
  }
}

export const storyDisplay = new StoryDisplay()