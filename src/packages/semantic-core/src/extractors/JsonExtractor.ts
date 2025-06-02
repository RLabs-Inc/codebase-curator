/**
 * JSON Configuration Extractor
 * Extracts semantic information from JSON configuration files
 */

import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class JsonExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.(json|jsonc|json5)$/.test(filePath) || 
           filePath.endsWith('package.json') ||
           filePath.endsWith('tsconfig.json') ||
           filePath.endsWith('.eslintrc.json') ||
           filePath.endsWith('.prettierrc.json')
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []

    try {
      // Remove comments for JSONC files
      const cleanContent = this.removeComments(content)
      const data = JSON.parse(cleanContent)
      
      // Detect special config files
      const fileName = filePath.split('/').pop() || ''
      
      if (fileName === 'package.json') {
        this.extractPackageJson(data, filePath, definitions, references)
      } else if (fileName === 'tsconfig.json' || fileName === 'jsconfig.json') {
        this.extractTsConfig(data, filePath, definitions, references)
      } else {
        // Generic JSON extraction
        this.extractObject(data, filePath, definitions, references)
      }
      
    } catch (error) {
      // If JSON parsing fails, extract what we can
      this.extractRawStrings(content, filePath, definitions)
    }

    return { definitions, references }
  }

  private extractPackageJson(
    data: any,
    filePath: string,
    definitions: SemanticInfo[],
    references: CrossReference[]
  ): void {
    // Package metadata
    if (data.name) {
      definitions.push({
        term: data.name,
        type: 'module',
        location: { file: filePath, line: 1, column: 0 },
        context: `Package: ${data.name}`,
        surroundingLines: [`"name": "${data.name}"`],
        relatedTerms: ['package', 'npm'],
        language: 'json',
      })
    }

    // Scripts
    if (data.scripts) {
      Object.entries(data.scripts).forEach(([name, command]) => {
        definitions.push({
          term: `npm run ${name}`,
          type: 'function',
          location: { file: filePath, line: 1, column: 0 },
          context: String(command),
          surroundingLines: [`"${name}": "${command}"`],
          relatedTerms: ['script', 'npm', name],
          language: 'json',
        })
      })
    }

    // Dependencies
    const depTypes = ['dependencies', 'devDependencies', 'peerDependencies']
    for (const depType of depTypes) {
      if (!data[depType]) continue
      
      const deps = data[depType]
      for (const pkg in deps) {
        const version = deps[pkg]
        definitions.push({
          term: pkg,
          type: 'import',
          location: { file: filePath, line: 1, column: 0 },
          context: `${depType}: ${version}`,
          surroundingLines: [`"${pkg}": "${version}"`],
          relatedTerms: [depType, 'npm', 'package'],
          language: 'json',
        })

        // Create reference to the package
        references.push({
          targetTerm: pkg,
          referenceType: 'import',
          fromLocation: { file: filePath, line: 1, column: 0 },
          context: `${depType}: ${pkg}@${version}`,
        })
      }
    }

    // Main/module entry points
    ['main', 'module', 'browser'].forEach(field => {
      if (data[field]) {
        definitions.push({
          term: data[field],
          type: 'variable',
          location: { file: filePath, line: 1, column: 0 },
          context: `Entry point: ${field}`,
          surroundingLines: [`"${field}": "${data[field]}"`],
          relatedTerms: ['entry', field],
          language: 'json',
        })
      }
    })
  }

  private extractTsConfig(
    data: any,
    filePath: string,
    definitions: SemanticInfo[],
    references: CrossReference[]
  ): void {
    // Compiler options
    if (data.compilerOptions) {
      const opts = data.compilerOptions
      
      // Important settings
      const importantSettings = [
        'target', 'module', 'lib', 'jsx', 'strict',
        'esModuleInterop', 'skipLibCheck', 'moduleResolution'
      ]
      
      importantSettings.forEach(setting => {
        if (opts[setting] !== undefined) {
          definitions.push({
            term: `compilerOptions.${setting}`,
            type: 'constant',
            location: { file: filePath, line: 1, column: 0 },
            context: `${setting}: ${JSON.stringify(opts[setting])}`,
            surroundingLines: [`"${setting}": ${JSON.stringify(opts[setting])}`],
            relatedTerms: ['typescript', 'config', setting],
            language: 'json',
          })
        }
      })

      // Path mappings
      if (opts.paths) {
        for (const alias in opts.paths) {
          const paths = opts.paths[alias]
          definitions.push({
            term: alias,
            type: 'variable',
            location: { file: filePath, line: 1, column: 0 },
            context: `Path alias: ${alias} → ${paths}`,
            surroundingLines: [`"${alias}": ${JSON.stringify(paths)}`],
            relatedTerms: ['alias', 'import', 'path'],
            language: 'json',
          })
        }
      }
    }

    // Include/exclude patterns
    ['include', 'exclude'].forEach(field => {
      if (data[field]) {
        const patterns = Array.isArray(data[field]) ? data[field] : [data[field]]
        patterns.forEach(pattern => {
          definitions.push({
            term: pattern,
            type: 'string',
            location: { file: filePath, line: 1, column: 0 },
            context: `${field} pattern`,
            surroundingLines: [pattern],
            relatedTerms: ['pattern', field],
            language: 'json',
          })
        })
      }
    })
  }

  private extractObject(
    obj: any,
    filePath: string,
    definitions: SemanticInfo[],
    references: CrossReference[],
    path: string = ''
  ): void {
    if (!obj || typeof obj !== 'object') return

    for (const key in obj) {
      const value = obj[key]
      const currentPath = path ? `${path}.${key}` : key

      // Extract key as configuration setting
      if (this.isImportantConfig(key, value)) {
        definitions.push({
          term: currentPath,
          type: 'constant',
          location: { file: filePath, line: 1, column: 0 },
          context: `${key}: ${this.valuePreview(value)}`,
          surroundingLines: [`"${key}": ${JSON.stringify(value)}`],
          relatedTerms: this.extractConfigTerms(key, value),
          language: 'json',
        })
      }

      // Extract meaningful string values
      if (typeof value === 'string' && this.isMeaningfulString(value)) {
        definitions.push({
          term: value,
          type: 'string',
          location: { file: filePath, line: 1, column: 0 },
          context: `${currentPath}: "${value}"`,
          surroundingLines: [`"${key}": "${value}"`],
          relatedTerms: [key],
          language: 'json',
        })
      }

      // Recurse for nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.extractObject(value, filePath, definitions, references, currentPath)
      }

      // Handle arrays of strings
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'string' && this.isMeaningfulString(item)) {
            definitions.push({
              term: item,
              type: 'string',
              location: { file: filePath, line: 1, column: 0 },
              context: `${currentPath}[]`,
              surroundingLines: [`"${key}": [..., "${item}", ...]`],
              relatedTerms: [key],
              language: 'json',
            })
          }
        })
      }
    }
  }

  private removeComments(content: string): string {
    // Simple comment removal for JSONC
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
      .replace(/\/\/.*$/gm, '')         // Line comments
  }

  private extractRawStrings(content: string, filePath: string, definitions: SemanticInfo[]): void {
    // Extract string values from raw JSON text
    const stringRegex = /"([^"]{4,})"/g
    const matches = content.matchAll(stringRegex)
    
    for (const match of matches) {
      const value = match[1]
      if (this.isMeaningfulString(value)) {
        definitions.push({
          term: value,
          type: 'string',
          location: { file: filePath, line: 1, column: match.index || 0 },
          context: match[0],
          surroundingLines: [match[0]],
          relatedTerms: [],
          language: 'json',
        })
      }
    }
  }

  private isImportantConfig(key: string, value: any): boolean {
    // Identify important configuration keys
    const importantPatterns = [
      /^(api|endpoint|url|uri|host|port)$/i,
      /^(database|db|connection|conn)$/i,
      /^(auth|token|key|secret|password)$/i,
      /^(env|environment|mode|debug)$/i,
      /^(version|name|description)$/i,
      /^(config|settings|options)$/i,
      /^(timeout|interval|duration)$/i,
      /^(enable|disable|use|is).*$/i,
    ]

    return importantPatterns.some(pattern => pattern.test(key)) ||
           (typeof value === 'object' && value !== null) ||
           (typeof value === 'boolean') ||
           (typeof value === 'number')
  }

  private extractConfigTerms(key: string, value: any): string[] {
    const terms = [key]
    
    // Add type-based terms
    if (typeof value === 'boolean') terms.push('boolean', 'flag')
    if (typeof value === 'number') terms.push('number', 'value')
    if (typeof value === 'string' && value.startsWith('http')) terms.push('url', 'endpoint')
    if (key.toLowerCase().includes('path')) terms.push('path', 'file')
    if (key.toLowerCase().includes('port')) terms.push('port', 'network')
    
    return terms
  }

  private valuePreview(value: any): string {
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'object' && value !== null) {
      return Array.isArray(value) ? '[...]' : '{...}'
    }
    return String(value)
  }

  private isMeaningfulString(value: string): boolean {
    // Filter out single words that are likely just identifiers
    if (value.length < 4) return false
    if (/^[A-Z_]+$/.test(value) && value.length < 10) return false // Short constants
    if (/^\d+$/.test(value)) return false // Just numbers
    
    // Include URLs, paths, sentences, etc.
    return value.includes('/') || 
           value.includes('.') || 
           value.includes(' ') ||
           value.includes('-') ||
           value.length > 15
  }
}