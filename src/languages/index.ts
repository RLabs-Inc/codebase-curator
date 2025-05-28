/**
 * Language System Exports
 * Central export point for the language plugin system
 */

export { BaseLanguageAnalyzer } from './base/BaseLanguageAnalyzer'
export { LanguageRegistry } from './base/LanguageRegistry'

// Language plugins
export { TypeScriptAnalyzer } from './plugins/typescript'

// Initialize default languages
import { LanguageRegistry } from './base/LanguageRegistry'
import { TypeScriptAnalyzer } from './plugins/typescript'

/**
 * Initialize the language registry with default languages
 * This is called automatically when the module is imported
 */
export function initializeLanguages(rootPath: string = process.cwd()): void {
  const registry = LanguageRegistry.getInstance()
  
  // Clear any existing registrations
  registry.clear()
  
  // Register TypeScript/JavaScript
  const tsAnalyzer = new TypeScriptAnalyzer({ rootPath })
  registry.register(tsAnalyzer)
  
  console.log('[Languages] Initialized with:', registry.getStats())
}

// Auto-initialize with current directory
// This can be called again with a specific root path if needed
initializeLanguages()