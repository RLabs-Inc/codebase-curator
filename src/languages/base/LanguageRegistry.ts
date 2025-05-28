/**
 * Language Registry
 * Singleton for managing language plugins
 */

import type { Language, LanguagePlugin, LanguageRegistry as ILanguageRegistry } from '../../types/language'
import { extname } from 'path'

export class LanguageRegistry implements ILanguageRegistry {
  private static instance: LanguageRegistry
  
  /** Map of language name to plugin */
  private plugins: Map<string, LanguagePlugin> = new Map()
  
  /** Map of file extension to language name */
  private extensionMap: Map<string, string> = new Map()
  
  /** Private constructor for singleton pattern */
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  static getInstance(): LanguageRegistry {
    if (!this.instance) {
      this.instance = new LanguageRegistry()
    }
    return this.instance
  }
  
  /**
   * Register a new language plugin
   */
  register(plugin: LanguagePlugin): void {
    const langName = plugin.language.name.toLowerCase()
    
    // Check for duplicate registration
    if (this.plugins.has(langName)) {
      console.warn(`[LanguageRegistry] Language "${plugin.language.name}" is already registered. Overwriting.`)
    }
    
    // Register the plugin
    this.plugins.set(langName, plugin)
    
    // Map extensions to language
    plugin.language.extensions.forEach(ext => {
      // Normalize extension (remove leading dot if present)
      const normalizedExt = ext.startsWith('.') ? ext.slice(1) : ext
      this.extensionMap.set(normalizedExt, langName)
    })
    
    console.log(`[LanguageRegistry] Registered language: ${plugin.language.displayName}`)
  }
  
  /**
   * Get plugin by language name
   */
  getPlugin(language: string): LanguagePlugin | null {
    return this.plugins.get(language.toLowerCase()) || null
  }
  
  /**
   * Get plugin by file extension
   */
  getPluginByExtension(ext: string): LanguagePlugin | null {
    // Normalize extension
    const normalizedExt = ext.startsWith('.') ? ext.slice(1) : ext
    const langName = this.extensionMap.get(normalizedExt)
    
    if (!langName) {
      return null
    }
    
    return this.plugins.get(langName) || null
  }
  
  /**
   * Get plugin for a file path
   */
  getPluginForFile(filePath: string): LanguagePlugin | null {
    const ext = extname(filePath).slice(1) // Remove the dot
    return this.getPluginByExtension(ext)
  }
  
  /**
   * Get all registered languages
   */
  getAllLanguages(): Language[] {
    return Array.from(this.plugins.values()).map(p => p.language)
  }
  
  /**
   * Get combined file pattern for all languages
   */
  getCombinedFilePattern(): string {
    const allExtensions = new Set<string>()
    
    this.plugins.forEach(plugin => {
      plugin.language.extensions.forEach(ext => {
        allExtensions.add(ext)
      })
    })
    
    if (allExtensions.size === 0) {
      // No languages registered, return a pattern that matches nothing
      return '**/*.{___no_match___}'
    }
    
    const extensions = Array.from(allExtensions).join(',')
    return `**/*.{${extensions}}`
  }
  
  /**
   * Check if a file is supported by any registered language
   */
  isFileSupported(filePath: string): boolean {
    return this.getPluginForFile(filePath) !== null
  }
  
  /**
   * Get all registered file extensions
   */
  getRegisteredExtensions(): string[] {
    return Array.from(this.extensionMap.keys())
  }
  
  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.plugins.clear()
    this.extensionMap.clear()
  }
  
  /**
   * Get registry statistics
   */
  getStats(): {
    languageCount: number
    extensionCount: number
    languages: string[]
  } {
    return {
      languageCount: this.plugins.size,
      extensionCount: this.extensionMap.size,
      languages: Array.from(this.plugins.keys())
    }
  }
}