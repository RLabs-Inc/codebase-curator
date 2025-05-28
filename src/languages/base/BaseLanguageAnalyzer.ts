/**
 * Base Language Analyzer
 * Abstract class that all language plugins must extend
 */

import type { 
  Language, 
  LanguagePlugin, 
  LanguagePluginOptions,
  ImportStatement,
  FunctionDefinition,
  ClassDefinition
} from '../../types/language'
import type { Framework } from '../../types/framework'
import type { CodePattern } from '../../types/patterns'
import { loadConfig, mergeExclusions } from '../../utils/config'

export abstract class BaseLanguageAnalyzer implements LanguagePlugin {
  /** Language definition - must be implemented by subclasses */
  abstract language: Language
  
  /** Root path of the project being analyzed */
  protected rootPath: string
  
  /** File exclusion patterns */
  protected exclusions: string[]
  
  /** Language-specific configuration */
  protected config: Record<string, any>
  
  constructor(options: LanguagePluginOptions = {}) {
    this.rootPath = options.rootPath || process.cwd()
    
    // Load and merge exclusions
    const projectConfig = loadConfig(this.rootPath)
    this.exclusions = mergeExclusions(
      undefined,
      projectConfig.exclude,
      options.exclusions
    )
    
    // Merge language-specific config
    this.config = {
      ...projectConfig.languages?.[this.language.name.toLowerCase()],
      ...options.config
    }
  }
  
  /**
   * Parse import statements from source code
   * Must be implemented by language-specific plugins
   */
  abstract parseImports(content: string, filePath: string): ImportStatement[]
  
  /**
   * Detect frameworks from dependencies and code patterns
   * Must be implemented by language-specific plugins
   */
  abstract detectFrameworks(
    dependencies: string[], 
    fileContents?: Map<string, string>
  ): Framework[]
  
  /**
   * Extract code patterns from source
   * Must be implemented by language-specific plugins
   */
  abstract extractPatterns(content: string, filePath: string): CodePattern[]
  
  /**
   * Get glob pattern for finding source files
   * Default implementation uses language extensions
   */
  getFilePattern(): string {
    const exts = this.language.extensions.join(',')
    return `**/*.{${exts}}`
  }
  
  /**
   * Parse function definitions
   * Optional - can be overridden by language plugins
   */
  parseFunctions(content: string): FunctionDefinition[] {
    const functions: FunctionDefinition[] = []
    const lines = content.split('\n')
    
    this.language.functionPatterns.forEach(pattern => {
      let match
      const regex = new RegExp(pattern.source, pattern.flags + 'g')
      
      while ((match = regex.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length
        
        functions.push({
          name: match[1] || 'anonymous',
          params: this.extractParams(match[2] || ''),
          line: lineNumber,
          isAsync: match[0].includes('async'),
          isExported: match[0].includes('export')
        })
      }
    })
    
    return functions
  }
  
  /**
   * Parse class definitions
   * Optional - can be overridden by language plugins
   */
  parseClasses(content: string): ClassDefinition[] {
    const classes: ClassDefinition[] = []
    const lines = content.split('\n')
    
    this.language.classPatterns.forEach(pattern => {
      let match
      const regex = new RegExp(pattern.source, pattern.flags + 'g')
      
      while ((match = regex.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length
        
        classes.push({
          name: match[1] || 'anonymous',
          line: lineNumber,
          isExported: match[0].includes('export'),
          isAbstract: match[0].includes('abstract')
        })
      }
    })
    
    return classes
  }
  
  /**
   * Extract parameter names from a parameter string
   * Can be overridden for language-specific parsing
   */
  protected extractParams(paramString: string): string[] {
    if (!paramString.trim()) return []
    
    // Basic parameter extraction - can be overridden
    return paramString
      .split(',')
      .map(p => p.trim())
      .map(p => {
        // Extract parameter name (before : or =)
        const match = p.match(/^(\w+)/)
        return match ? match[1] : p
      })
      .filter(Boolean)
  }
  
  /**
   * Check if a line is a comment
   * Useful for filtering out commented code
   */
  protected isComment(line: string): boolean {
    const trimmed = line.trim()
    
    // Single line comment
    if (this.language.singleLineComment) {
      if (trimmed.startsWith(this.language.singleLineComment)) {
        return true
      }
    }
    
    // Multi-line comment (basic check - can be improved)
    if (this.language.multiLineComment) {
      if (trimmed.startsWith(this.language.multiLineComment.start) ||
          trimmed.endsWith(this.language.multiLineComment.end)) {
        return true
      }
    }
    
    return false
  }
  
  /**
   * Remove comments from content
   * Useful for cleaner pattern matching
   */
  protected removeComments(content: string): string {
    let result = content
    
    // Remove single-line comments
    if (this.language.singleLineComment) {
      const pattern = new RegExp(
        `${this.escapeRegex(this.language.singleLineComment)}.*$`,
        'gm'
      )
      result = result.replace(pattern, '')
    }
    
    // Remove multi-line comments
    if (this.language.multiLineComment) {
      const pattern = new RegExp(
        `${this.escapeRegex(this.language.multiLineComment.start)}[\\s\\S]*?${
          this.escapeRegex(this.language.multiLineComment.end)
        }`,
        'g'
      )
      result = result.replace(pattern, '')
    }
    
    return result
  }
  
  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}