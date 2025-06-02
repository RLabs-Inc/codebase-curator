/**
 * TOML Configuration Extractor
 * Extracts semantic information from TOML files
 */

import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class TomlExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.toml$/.test(filePath) ||
           filePath.endsWith('Cargo.toml') ||
           filePath.endsWith('pyproject.toml') ||
           filePath.endsWith('netlify.toml')
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    // Detect special TOML files
    const fileName = filePath.split('/').pop() || ''
    const isCargoToml = fileName === 'Cargo.toml'
    const isPyProjectToml = fileName === 'pyproject.toml'

    // Track current table context
    let currentTable = ''
    let inMultilineString = false
    let multilineBuffer: string[] = []
    let multilineKey = ''

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        if (trimmedLine.startsWith('#') && trimmedLine.length > 2) {
          definitions.push({
            term: trimmedLine.substring(1).trim(),
            type: 'comment',
            location: { file: filePath, line: index + 1, column: 0 },
            context: trimmedLine,
            surroundingLines: [trimmedLine],
            relatedTerms: [],
            language: 'toml',
          })
        }
        return
      }

      // Handle multiline strings
      if (inMultilineString) {
        if (line.includes('"""') || line.includes("'''")) {
          multilineBuffer.push(line.substring(0, line.indexOf('"""') || line.indexOf("'''")))
          const fullString = multilineBuffer.join('\n').trim()
          if (this.isMeaningfulString(fullString)) {
            definitions.push({
              term: fullString,
              type: 'string',
              location: { file: filePath, line: index - multilineBuffer.length + 1, column: 0 },
              context: `${multilineKey} = """..."""`,
              surroundingLines: multilineBuffer.slice(0, 3),
              relatedTerms: [multilineKey, currentTable],
              language: 'toml',
            })
          }
          inMultilineString = false
          multilineBuffer = []
        } else {
          multilineBuffer.push(line)
        }
        return
      }

      // Table headers
      const tableMatch = line.match(/^\[([^\]]+)\]$/)
      if (tableMatch) {
        currentTable = tableMatch[1]
        definitions.push({
          term: currentTable,
          type: 'module',
          location: { file: filePath, line: index + 1, column: 0 },
          context: `TOML Table: ${currentTable}`,
          surroundingLines: [line.trim()],
          relatedTerms: this.extractTableTerms(currentTable),
          language: 'toml',
        })

        // Special handling for known tables
        if (isCargoToml) {
          this.extractCargoTable(currentTable, filePath, index + 1, definitions)
        } else if (isPyProjectToml) {
          this.extractPyProjectTable(currentTable, filePath, index + 1, definitions)
        }
        return
      }

      // Array of tables
      const arrayTableMatch = line.match(/^\[\[([^\]]+)\]\]$/)
      if (arrayTableMatch) {
        currentTable = arrayTableMatch[1]
        definitions.push({
          term: currentTable,
          type: 'class',
          location: { file: filePath, line: index + 1, column: 0 },
          context: `TOML Array Table: ${currentTable}`,
          surroundingLines: [line.trim()],
          relatedTerms: ['array', ...this.extractTableTerms(currentTable)],
          language: 'toml',
        })
        return
      }

      // Key-value pairs
      const keyValueMatch = line.match(/^([a-zA-Z0-9_\-\.]+)\s*=\s*(.+)$/)
      if (keyValueMatch) {
        const [, key, value] = keyValueMatch
        const fullKey = currentTable ? `${currentTable}.${key}` : key

        // Handle special keys based on file type
        if (isCargoToml) {
          this.extractCargoKeyValue(key, value, currentTable, filePath, index + 1, definitions, references)
        } else if (isPyProjectToml) {
          this.extractPyProjectKeyValue(key, value, currentTable, filePath, index + 1, definitions, references)
        }

        // Generic extraction
        if (this.isImportantKey(key, currentTable)) {
          definitions.push({
            term: fullKey,
            type: 'constant',
            location: { file: filePath, line: index + 1, column: 0 },
            context: `${key} = ${this.valuePreview(value)}`,
            surroundingLines: [line.trim()],
            relatedTerms: this.extractKeyTerms(key, value),
            language: 'toml',
          })
        }

        // String values
        if (value.startsWith('"') || value.startsWith("'")) {
          // Check for multiline
          if (value.startsWith('"""') || value.startsWith("'''")) {
            if (!value.endsWith('"""') && !value.endsWith("'''")) {
              inMultilineString = true
              multilineKey = key
              multilineBuffer = [value.substring(3)]
              return
            }
          }

          const stringValue = this.extractStringValue(value)
          if (stringValue && this.isMeaningfulString(stringValue)) {
            definitions.push({
              term: stringValue,
              type: 'string',
              location: { file: filePath, line: index + 1, column: key.length + 3 },
              context: `${key} = ${value}`,
              surroundingLines: [line.trim()],
              relatedTerms: [key, currentTable],
              language: 'toml',
            })
          }
        }

        // Array values
        if (value.startsWith('[')) {
          const arrayValues = this.extractArrayValues(value)
          arrayValues.forEach(item => {
            if (this.isMeaningfulString(item)) {
              definitions.push({
                term: item,
                type: 'string',
                location: { file: filePath, line: index + 1, column: 0 },
                context: `${key} = [...]`,
                surroundingLines: [line.trim()],
                relatedTerms: [key, currentTable, 'array'],
                language: 'toml',
              })
            }
          })
        }

        // Table values (inline tables)
        if (value.startsWith('{')) {
          definitions.push({
            term: fullKey,
            type: 'class',
            location: { file: filePath, line: index + 1, column: 0 },
            context: `${key} = ${value}`,
            surroundingLines: [line.trim()],
            relatedTerms: [key, currentTable, 'table'],
            language: 'toml',
          })
        }
      }
    })

    return { definitions, references }
  }

  private extractCargoTable(
    table: string,
    filePath: string,
    line: number,
    definitions: SemanticInfo[]
  ): void {
    if (table === 'package') {
      definitions.push({
        term: 'Cargo Package',
        type: 'module',
        location: { file: filePath, line, column: 0 },
        context: 'Rust package configuration',
        surroundingLines: ['[package]'],
        relatedTerms: ['rust', 'cargo', 'package'],
        language: 'toml',
      })
    } else if (table.startsWith('dependencies')) {
      definitions.push({
        term: table,
        type: 'import',
        location: { file: filePath, line, column: 0 },
        context: 'Rust dependencies',
        surroundingLines: [`[${table}]`],
        relatedTerms: ['rust', 'cargo', 'dependencies'],
        language: 'toml',
      })
    }
  }

  private extractCargoKeyValue(
    key: string,
    value: string,
    table: string,
    filePath: string,
    line: number,
    definitions: SemanticInfo[],
    references: CrossReference[]
  ): void {
    // Package metadata
    if (table === 'package') {
      if (key === 'name') {
        const name = this.extractStringValue(value)
        definitions.push({
          term: name,
          type: 'module',
          location: { file: filePath, line, column: 0 },
          context: `Rust crate: ${name}`,
          surroundingLines: [`name = ${value}`],
          relatedTerms: ['crate', 'rust', 'package'],
          language: 'toml',
        })
      }
    }

    // Dependencies
    if (table.includes('dependencies') && !value.startsWith('{')) {
      definitions.push({
        term: key,
        type: 'import',
        location: { file: filePath, line, column: 0 },
        context: `Rust dependency: ${key} = ${value}`,
        surroundingLines: [`${key} = ${value}`],
        relatedTerms: ['dependency', 'crate', 'rust'],
        language: 'toml',
      })

      references.push({
        targetTerm: key,
        referenceType: 'import',
        fromLocation: { file: filePath, line, column: 0 },
        context: `${table}: ${key} = ${value}`,
      })
    }
  }

  private extractPyProjectTable(
    table: string,
    filePath: string,
    line: number,
    definitions: SemanticInfo[]
  ): void {
    if (table === 'project' || table === 'tool.poetry') {
      definitions.push({
        term: 'Python Project',
        type: 'module',
        location: { file: filePath, line, column: 0 },
        context: 'Python project configuration',
        surroundingLines: [`[${table}]`],
        relatedTerms: ['python', 'project', 'pyproject'],
        language: 'toml',
      })
    }
  }

  private extractPyProjectKeyValue(
    key: string,
    value: string,
    table: string,
    filePath: string,
    line: number,
    definitions: SemanticInfo[],
    references: CrossReference[]
  ): void {
    // Project metadata
    if (table === 'project' || table === 'tool.poetry') {
      if (key === 'name') {
        const name = this.extractStringValue(value)
        definitions.push({
          term: name,
          type: 'module',
          location: { file: filePath, line, column: 0 },
          context: `Python package: ${name}`,
          surroundingLines: [`name = ${value}`],
          relatedTerms: ['package', 'python', 'module'],
          language: 'toml',
        })
      }
    }

    // Dependencies
    if (key === 'dependencies' || table.includes('dependencies')) {
      if (value.startsWith('[')) {
        const deps = this.extractArrayValues(value)
        deps.forEach(dep => {
          const pkgName = dep.split(/[<>=]/)[0].trim()
          if (pkgName) {
            definitions.push({
              term: pkgName,
              type: 'import',
              location: { file: filePath, line, column: 0 },
              context: `Python dependency: ${dep}`,
              surroundingLines: [`${key} = [...]`],
              relatedTerms: ['dependency', 'package', 'python'],
              language: 'toml',
            })

            references.push({
              targetTerm: pkgName,
              referenceType: 'import',
              fromLocation: { file: filePath, line, column: 0 },
              context: `Python dependency: ${dep}`,
            })
          }
        })
      }
    }
  }

  private isImportantKey(key: string, table: string): boolean {
    const importantKeys = [
      'name', 'version', 'description', 'author',
      'license', 'repository', 'homepage',
      'build', 'test', 'lint', 'format',
      'host', 'port', 'url', 'database',
      'timeout', 'workers', 'threads'
    ]

    const importantPatterns = [
      /^(enable|disable|use)_/i,
      /_(url|uri|host|port)$/i,
      /^(min|max)_/i,
    ]

    return importantKeys.includes(key.toLowerCase()) ||
           importantPatterns.some(pattern => pattern.test(key))
  }

  private extractTableTerms(table: string): string[] {
    const terms = []
    
    if (table.includes('dependencies')) terms.push('dependency', 'import')
    if (table.includes('dev')) terms.push('development', 'dev')
    if (table.includes('build')) terms.push('build', 'compile')
    if (table.includes('test')) terms.push('test', 'testing')
    if (table.includes('package')) terms.push('package', 'metadata')
    
    return terms
  }

  private extractKeyTerms(key: string, value: string): string[] {
    const terms = [key]
    
    if (value.includes('http')) terms.push('url', 'endpoint')
    if (key.includes('version')) terms.push('version', 'semver')
    if (key.includes('author')) terms.push('author', 'maintainer')
    if (key.includes('license')) terms.push('license', 'legal')
    
    return terms
  }

  private extractStringValue(value: string): string {
    // Handle different string formats
    if (value.startsWith('"""') && value.endsWith('"""')) {
      return value.slice(3, -3).trim()
    }
    if (value.startsWith("'''") && value.endsWith("'''")) {
      return value.slice(3, -3).trim()
    }
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1)
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1)
    }
    return value
  }

  private extractArrayValues(value: string): string[] {
    // Simple array parsing
    if (!value.startsWith('[') || !value.endsWith(']')) return []
    
    const inner = value.slice(1, -1)
    return inner.split(',').map(item => {
      const cleaned = item.trim()
      return this.extractStringValue(cleaned)
    }).filter(Boolean)
  }

  private valuePreview(value: string): string {
    if (value.length > 50) {
      return value.substring(0, 47) + '...'
    }
    return value
  }

  private isMeaningfulString(value: string): boolean {
    if (value.length < 3) return false
    if (/^(true|false)$/i.test(value)) return false
    if (/^\d+(\.\d+)?$/.test(value)) return false
    if (/^[A-Z_]+$/.test(value) && value.length < 10) return false
    
    return true
  }
}