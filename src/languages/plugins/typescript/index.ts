/**
 * TypeScript/JavaScript Language Plugin
 * Handles .ts, .tsx, .js, .jsx, .mjs, .cjs files
 */

import { BaseLanguageAnalyzer } from '../../base/BaseLanguageAnalyzer'
import type { 
  Language, 
  LanguagePluginOptions,
  ImportStatement,
  FunctionDefinition,
  ClassDefinition
} from '../../../types/language'
import type { Framework } from '../../../types/framework'
import type { CodePattern } from '../../../types/patterns'
import Bun from 'bun'

export class TypeScriptAnalyzer extends BaseLanguageAnalyzer {
  language: Language = {
    name: 'typescript',
    displayName: 'TypeScript/JavaScript',
    extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    importPatterns: [
      // ES6 imports: import { x } from 'y'
      /(?:import|export)\s+(?:type\s+)?(?:(\*\s+as\s+\w+)|(\w+)|({[^}]+}))\s+from\s+['"]([^'"]+)['"]/g,
      // CommonJS: const x = require('y')
      /(?:const|let|var)\s+(?:(\w+)|({[^}]+}))\s*=\s*require\s*\(['"]([^'"]+)['"]\)/g,
      // Dynamic imports: import('x')
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ],
    exportPatterns: [
      // Named exports: export { x }
      /export\s+{([^}]+)}/g,
      // Default export: export default
      /export\s+default\s+/g,
      // Direct exports: export const/function/class
      /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g,
    ],
    functionPatterns: [
      // Function declarations
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
      // Arrow functions assigned to const/let/var
      /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
      // Method definitions in objects/classes
      /(\w+)\s*:\s*(?:async\s+)?(?:function\s*)?\([^)]*\)/g,
    ],
    classPatterns: [
      // Class declarations
      /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g,
    ],
    singleLineComment: '//',
    multiLineComment: {
      start: '/*',
      end: '*/'
    }
  }
  
  constructor(options: LanguagePluginOptions) {
    super(options)
  }
  
  /**
   * Parse imports using Bun's transpiler for accuracy
   */
  async parseImports(content: string, filePath: string): Promise<ImportStatement[]> {
    try {
      // Try using Bun's transpiler for accurate parsing
      const transpiler = new Bun.Transpiler({
        loader: this.getLoaderForFile(filePath),
        target: 'bun',
        trimUnusedImports: false,
      })
      
      const imports = transpiler.scanImports(content)
      
      return imports.map((imp: any) => ({
        source: imp.path,
        imports: this.extractImportNames(imp),
        isDefault: !!imp.default,
        isNamespace: !!imp.namespace,
        isExternal: this.isExternalImport(imp.path),
        line: this.getLineNumber(content, imp.start || 0)
      }))
    } catch (error) {
      // Fallback to regex parsing
      console.warn(`[TypeScript] Falling back to regex parsing for ${filePath}`)
      return this.parseImportsWithRegex(content)
    }
  }
  
  /**
   * Fallback regex-based import parsing
   */
  private parseImportsWithRegex(content: string): ImportStatement[] {
    const imports: ImportStatement[] = []
    const lines = content.split('\n')
    
    // Process entire content for multi-line imports
    // ES6 import patterns
    const importPatterns = [
      // import Default from 'module'
      /import\s+(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g,
      // import { Named } from 'module'  
      /import\s+(?:type\s+)?({[^}]+})\s+from\s+['"]([^'"]+)['"]/g,
      // import * as namespace from 'module'
      /import\s+(?:type\s+)?(\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g,
      // import Default, { Named } from 'module'
      /import\s+(?:type\s+)?(\w+)\s*,\s*({[^}]+})\s+from\s+['"]([^'"]+)['"]/g,
    ]
    
    importPatterns.forEach(regex => {
      let match
      while ((match = regex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length
        
        if (match.length === 3) {
          // Simple import (default, named, or namespace)
          const [, imported, source] = match
          if (imported.startsWith('*')) {
            // Namespace import
            imports.push({
              source,
              imports: [imported.replace(/\*\s+as\s+/, '').trim()],
              isDefault: false,
              isNamespace: true,
              isExternal: this.isExternalImport(source),
              line: lineNum
            })
          } else if (imported.startsWith('{')) {
            // Named imports
            imports.push({
              source,
              imports: this.parseNamedImports(imported),
              isDefault: false,
              isNamespace: false,
              isExternal: this.isExternalImport(source),
              line: lineNum
            })
          } else {
            // Default import
            imports.push({
              source,
              imports: [imported],
              isDefault: true,
              isNamespace: false,
              isExternal: this.isExternalImport(source),
              line: lineNum
            })
          }
        } else if (match.length === 4) {
          // Combined default and named import
          const [, defaultImport, namedImports, source] = match
          // Add default import
          imports.push({
            source,
            imports: [defaultImport],
            isDefault: true,
            isNamespace: false,
            isExternal: this.isExternalImport(source),
            line: lineNum
          })
          // Add named imports
          imports.push({
            source,
            imports: this.parseNamedImports(namedImports),
            isDefault: false,
            isNamespace: false,
            isExternal: this.isExternalImport(source),
            line: lineNum
          })
        }
      }
    })
    
    lines.forEach((line, index) => {
      
      // CommonJS requires
      const requireRegex = /(?:const|let|var)\s+(?:(\w+)|({[^}]+}))\s*=\s*require\s*\(['"]([^'"]+)['"]\)/g
      
      while ((match = requireRegex.exec(line)) !== null) {
        const [, defaultImport, destructured, source] = match
        
        imports.push({
          source,
          imports: defaultImport ? [defaultImport] : this.parseDestructured(destructured),
          isDefault: !!defaultImport,
          isNamespace: false,
          isExternal: this.isExternalImport(source),
          line: index + 1
        })
      }
      
      // Dynamic imports
      const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
      
      while ((match = dynamicImportRegex.exec(line)) !== null) {
        const [, source] = match
        
        imports.push({
          source,
          imports: ['*'],
          isDefault: false,
          isNamespace: false,
          isExternal: this.isExternalImport(source),
          line: index + 1
        })
      }
    })
    
    return imports
  }
  
  /**
   * Detect TypeScript/JavaScript frameworks
   */
  detectFrameworks(dependencies: string[], fileContents?: Map<string, string>): Framework[] {
    const frameworks: Framework[] = []
    
    // Framework detection rules
    const rules = [
      // Frontend frameworks
      { deps: ['react', 'react-dom'], name: 'React', category: 'frontend' as const },
      { deps: ['vue'], name: 'Vue', category: 'frontend' as const },
      { deps: ['@angular/core'], name: 'Angular', category: 'frontend' as const },
      { deps: ['svelte'], name: 'Svelte', category: 'frontend' as const },
      { deps: ['solid-js'], name: 'Solid', category: 'frontend' as const },
      
      // Backend frameworks
      { deps: ['express'], name: 'Express', category: 'backend' as const },
      { deps: ['fastify'], name: 'Fastify', category: 'backend' as const },
      { deps: ['koa'], name: 'Koa', category: 'backend' as const },
      { deps: ['@nestjs/core'], name: 'NestJS', category: 'backend' as const },
      { deps: ['hapi'], name: 'Hapi', category: 'backend' as const },
      
      // Full-stack frameworks
      { deps: ['next'], name: 'Next.js', category: 'fullstack' as const },
      { deps: ['nuxt'], name: 'Nuxt', category: 'fullstack' as const },
      { deps: ['@remix-run/react'], name: 'Remix', category: 'fullstack' as const },
      { deps: ['gatsby'], name: 'Gatsby', category: 'fullstack' as const },
      
      // Testing frameworks
      { deps: ['jest'], name: 'Jest', category: 'testing' as const },
      { deps: ['vitest'], name: 'Vitest', category: 'testing' as const },
      { deps: ['mocha'], name: 'Mocha', category: 'testing' as const },
      { deps: ['cypress'], name: 'Cypress', category: 'testing' as const },
      { deps: ['playwright'], name: 'Playwright', category: 'testing' as const },
    ]
    
    // Check each rule
    rules.forEach(rule => {
      if (rule.deps.some(dep => dependencies.includes(dep))) {
        frameworks.push({
          name: rule.name,
          category: rule.category,
          confidence: 100,
          language: 'TypeScript/JavaScript',
          indicators: rule.deps.filter(dep => dependencies.includes(dep))
        })
      }
    })
    
    return frameworks
  }
  
  /**
   * Extract code patterns from TypeScript/JavaScript code
   */
  extractPatterns(content: string, filePath: string): CodePattern[] {
    const patterns: CodePattern[] = []
    
    // Remove comments for cleaner analysis
    const cleanContent = this.removeComments(content)
    
    // Component patterns (React/Vue/Angular)
    const componentPatterns = [
      { regex: /export\s+default\s+function\s+(\w+Component)/, category: 'component' as const },
      { regex: /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*{[\s\S]*?return\s*\(/, category: 'component' as const },
      { regex: /class\s+(\w+)\s+extends\s+(?:React\.)?Component/, category: 'component' as const },
    ]
    
    componentPatterns.forEach(({ regex, category }) => {
      let match
      while ((match = regex.exec(cleanContent)) !== null) {
        patterns.push({
          name: match[1],
          category,
          occurrences: 1,
          files: [filePath],
          description: `${category} pattern found`
        })
      }
    })
    
    // Hook patterns
    if (cleanContent.includes('use')) {
      const hookRegex = /const\s+(\w+)\s*=\s*use(\w+)\(/g
      let match
      while ((match = hookRegex.exec(cleanContent)) !== null) {
        patterns.push({
          name: `use${match[2]}`,
          category: 'hook',
          occurrences: 1,
          files: [filePath],
          description: 'React hook usage pattern'
        })
      }
    }
    
    // API patterns
    const apiPatterns = [
      { regex: /app\.(get|post|put|delete|patch)\(['"]([^'"]+)/, category: 'api' as const },
      { regex: /router\.(get|post|put|delete|patch)\(['"]([^'"]+)/, category: 'api' as const },
    ]
    
    apiPatterns.forEach(({ regex, category }) => {
      let match
      while ((match = regex.exec(cleanContent)) !== null) {
        patterns.push({
          name: `${match[1].toUpperCase()} ${match[2]}`,
          category,
          occurrences: 1,
          files: [filePath],
          description: 'API endpoint pattern'
        })
      }
    })
    
    return patterns
  }
  
  /**
   * Helper methods
   */
  
  private getLoaderForFile(filePath: string): string {
    const ext = filePath.split('.').pop()
    switch (ext) {
      case 'ts': return 'ts'
      case 'tsx': return 'tsx'
      case 'jsx': return 'jsx'
      case 'mjs': return 'js'
      case 'cjs': return 'js'
      default: return 'js'
    }
  }
  
  private extractImportNames(imp: any): string[] {
    const names: string[] = []
    
    if (imp.default) {
      names.push(imp.default)
    }
    
    if (imp.names && Array.isArray(imp.names)) {
      names.push(...imp.names)
    }
    
    if (imp.namespace) {
      names.push(imp.namespace)
    }
    
    return names.length > 0 ? names : ['*']
  }
  
  private getLineNumber(content: string, position: number): number {
    const lines = content.substring(0, position).split('\n')
    return lines.length
  }
  
  private isExternalImport(source: string): boolean {
    return !source.startsWith('.') && !source.startsWith('/')
  }
  
  private parseNamedImports(namedImports: string): string[] {
    return namedImports
      .replace(/[{}]/g, '')
      .split(',')
      .map(s => s.trim())
      .map(s => {
        // Handle "import as alias" syntax
        const parts = s.split(/\s+as\s+/)
        return parts[0].trim()
      })
      .filter(Boolean)
  }
  
  private parseDestructured(destructured: string): string[] {
    return destructured
      .replace(/[{}]/g, '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
}