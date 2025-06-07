/**
 * Python Semantic Extractor
 * Extracts semantic information from Python files using AST-like parsing
 */

import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class PythonExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.py$/.test(filePath)
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    // Track current context (class we're inside, indentation level)
    let currentClass: string | null = null
    let currentClassIndent = -1
    const indentStack: number[] = []

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) return

      // Calculate indentation
      const indent = line.length - line.trimStart().length
      
      // Update class context based on indentation
      if (currentClass && indent <= currentClassIndent) {
        currentClass = null
        currentClassIndent = -1
      }

      // Function definitions
      const funcMatch = line.match(/^(\s*)(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)
      if (funcMatch) {
        const [, indentStr, funcName] = funcMatch
        const funcIndent = indentStr.length
        
        // Determine if this is a method or standalone function
        const fullName = currentClass && funcIndent > currentClassIndent 
          ? `${currentClass}.${funcName}` 
          : funcName

        definitions.push({
          term: fullName,
          type: 'function',
          location: { file: filePath, line: index + 1, column: funcIndent },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'python',
        })

        // Special methods indicate interface implementation
        if (funcName.startsWith('__') && funcName.endsWith('__') && currentClass) {
          references.push({
            targetTerm: funcName,
            referenceType: 'implements',
            fromLocation: {
              file: filePath,
              line: index + 1,
              column: funcIndent,
            },
            context: line.trim(),
          })
        }
      }

      // Class definitions
      const classMatch = line.match(/^(\s*)class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(([^)]*)\))?:/)
      if (classMatch) {
        const [, indentStr, className, inheritance] = classMatch
        currentClass = className
        currentClassIndent = indentStr.length

        definitions.push({
          term: className,
          type: 'class',
          location: { file: filePath, line: index + 1, column: currentClassIndent },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'python',
        })

        // Extract inheritance references
        if (inheritance) {
          const baseClasses = inheritance.split(',').map(s => s.trim()).filter(Boolean)
          baseClasses.forEach(baseClass => {
            // Remove generic type parameters if present
            const cleanBase = baseClass.split('[')[0].trim()
            if (cleanBase && cleanBase !== 'object') {
              references.push({
                targetTerm: cleanBase,
                referenceType: 'extends',
                fromLocation: {
                  file: filePath,
                  line: index + 1,
                  column: currentClassIndent,
                },
                context: line.trim(),
              })
            }
          })
        }
      }

      // Variable assignments (module level or class attributes)
      const varMatch = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::\s*[^=]+)?\s*=\s*(.+)/)
      if (varMatch && !funcMatch && !classMatch) {
        const [, indentStr, varName, value] = varMatch
        const varIndent = indentStr.length
        
        // Skip if it's inside a function (too deep indentation)
        if (varIndent === 0 || (currentClass && varIndent === currentClassIndent + 4)) {
          const fullName = currentClass && varIndent > currentClassIndent 
            ? `${currentClass}.${varName}` 
            : varName

          // Determine if it's a constant
          const isConstant = varName === varName.toUpperCase() && varName.includes('_')
          
          definitions.push({
            term: fullName,
            type: isConstant ? 'constant' : 'variable',
            location: { file: filePath, line: index + 1, column: varIndent },
            context: line.trim(),
            surroundingLines: this.getSurroundingLines(index, lines),
            relatedTerms: this.extractRelatedTerms(line),
            language: 'python',
          })
        }
      }

      // Import statements
      const importMatch = line.match(/^\s*(?:from\s+([a-zA-Z0-9_.]+)\s+)?import\s+(.+)/)
      if (importMatch) {
        const [, fromModule, imports] = importMatch
        
        // Parse imported names
        const importList = imports.split(',').map(imp => {
          const parts = imp.trim().split(/\s+as\s+/)
          return parts[parts.length - 1] // Use alias if present
        })

        importList.forEach(importName => {
          if (importName && !importName.includes('*')) {
            definitions.push({
              term: importName,
              type: 'import',
              location: { file: filePath, line: index + 1, column: 0 },
              context: line.trim(),
              surroundingLines: [line.trim()],
              relatedTerms: fromModule ? [fromModule] : [],
              language: 'python',
            })
          }
        })
      }

      // Decorators (often indicate important functions/classes)
      const decoratorMatch = line.match(/^\s*@([a-zA-Z_][a-zA-Z0-9_.]*)/)
      if (decoratorMatch) {
        const [, decoratorName] = decoratorMatch
        references.push({
          targetTerm: decoratorName.split('.')[0], // Base decorator name
          referenceType: 'call',
          fromLocation: {
            file: filePath,
            line: index + 1,
            column: 0,
          },
          context: line.trim(),
        })
      }

      // Function/method calls
      const callMatches = [...line.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\(/g)]
      callMatches.forEach(match => {
        const funcName = match[1]
        // Skip common keywords and built-ins
        if (!this.isPythonKeyword(funcName.split('.')[0])) {
          references.push({
            targetTerm: funcName,
            referenceType: 'call',
            fromLocation: {
              file: filePath,
              line: index + 1,
              column: match.index || 0,
            },
            context: line.trim(),
          })
        }
      })

      // Class instantiation
      const newMatches = [...line.matchAll(/([A-Z][a-zA-Z0-9_]*)\s*\(/g)]
      newMatches.forEach(match => {
        const className = match[1]
        // Check if it looks like a class (PascalCase)
        if (className[0] === className[0].toUpperCase()) {
          references.push({
            targetTerm: className,
            referenceType: 'instantiation',
            fromLocation: {
              file: filePath,
              line: index + 1,
              column: match.index || 0,
            },
            context: line.trim(),
          })
        }
      })

      // String literals (docstrings and meaningful strings)
      const stringMatches = [
        ...line.matchAll(/"""([^"]+)"""/g),
        ...line.matchAll(/'''([^']+)'''/g),
        ...line.matchAll(/"([^"]{4,})"/g),
        ...line.matchAll(/'([^']{4,})'/g),
      ]
      
      stringMatches.forEach(match => {
        const value = match[1]
        if (this.isMeaningfulString(value)) {
          definitions.push({
            term: value,
            type: 'string',
            location: { file: filePath, line: index + 1, column: match.index || 0 },
            context: line.trim(),
            surroundingLines: [line.trim()],
            relatedTerms: [],
            language: 'python',
          })
        }
      })

      // Comments
      const commentMatch = line.match(/^\s*#\s*(.+)/)
      if (commentMatch && commentMatch[1].length > 5) {
        const commentText = commentMatch[1].trim()
        const semanticInfo: SemanticInfo = {
          term: commentText,
          type: 'comment',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [],
          language: 'python',
        }
        
        // Check for development markers
        const devMarkerPattern = /^\s*(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REFACTOR|NOTE|REVIEW|DEPRECATED|WORKAROUND|TEMP|KLUDGE|SMELL)\b/i
        const markerMatch = commentText.match(devMarkerPattern)
        if (markerMatch) {
          semanticInfo.metadata = {
            isDevelopmentMarker: true,
            markerType: markerMatch[1].toUpperCase()
          }
        }
        
        definitions.push(semanticInfo)
      }
    })

    // Extract docstrings (multi-line strings after function/class definitions)
    this.extractDocstrings(lines, filePath, definitions)

    return { definitions, references }
  }

  private extractDocstrings(lines: string[], filePath: string, definitions: SemanticInfo[]): void {
    let inDocstring = false
    let docstringDelimiter = ''
    let docstringContent: string[] = []
    let docstringStart = 0

    lines.forEach((line, index) => {
      // Check for docstring start
      if (!inDocstring) {
        const match = line.match(/^\s*(""")|^\s*(''')/)
        if (match && (index === 0 || this.isAfterDefinition(lines[index - 1]))) {
          inDocstring = true
          docstringDelimiter = match[1] || match[2]
          docstringStart = index
          
          // Check if it's a single-line docstring
          const content = line.substring(line.indexOf(docstringDelimiter) + 3)
          if (content.includes(docstringDelimiter)) {
            const docstring = content.substring(0, content.indexOf(docstringDelimiter))
            if (docstring.trim().length > 5) {
              const docstringText = docstring.trim()
              const semanticInfo: SemanticInfo = {
                term: docstringText,
                type: 'comment',
                location: { file: filePath, line: index + 1, column: 0 },
                context: 'Docstring',
                surroundingLines: [line.trim()],
                relatedTerms: [],
                language: 'python',
              }
              
              // Check for development markers in docstrings
              const devMarkerPattern = /\b(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REFACTOR|NOTE|REVIEW|DEPRECATED|WORKAROUND|TEMP|KLUDGE|SMELL)\b/gi
              const markerMatches = docstringText.match(devMarkerPattern)
              if (markerMatches) {
                semanticInfo.metadata = {
                  isDevelopmentMarker: true,
                  markerTypes: [...new Set(markerMatches.map(m => m.toUpperCase()))]
                }
              }
              
              definitions.push(semanticInfo)
            }
            inDocstring = false
            docstringContent = []
          } else {
            docstringContent = [content]
          }
        }
      } else {
        // In docstring, look for end
        if (line.includes(docstringDelimiter)) {
          const content = line.substring(0, line.indexOf(docstringDelimiter))
          if (content) docstringContent.push(content)
          
          const fullDocstring = docstringContent.join('\n').trim()
          if (fullDocstring.length > 5) {
            const semanticInfo: SemanticInfo = {
              term: fullDocstring,
              type: 'comment',
              location: { file: filePath, line: docstringStart + 1, column: 0 },
              context: 'Docstring',
              surroundingLines: lines.slice(docstringStart, index + 1).map(l => l.trim()),
              relatedTerms: [],
              language: 'python',
            }
            
            // Check for development markers in multi-line docstrings
            const devMarkerPattern = /\b(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REFACTOR|NOTE|REVIEW|DEPRECATED|WORKAROUND|TEMP|KLUDGE|SMELL)\b/gi
            const markerMatches = fullDocstring.match(devMarkerPattern)
            if (markerMatches) {
              semanticInfo.metadata = {
                isDevelopmentMarker: true,
                markerTypes: [...new Set(markerMatches.map(m => m.toUpperCase()))]
              }
            }
            
            definitions.push(semanticInfo)
          }
          
          inDocstring = false
          docstringContent = []
        } else {
          docstringContent.push(line)
        }
      }
    })
  }

  private isAfterDefinition(line: string): boolean {
    const trimmed = line.trim()
    return trimmed.endsWith(':') && 
           (trimmed.includes('def ') || trimmed.includes('class '))
  }

  private getSurroundingLines(lineIndex: number, lines: string[]): string[] {
    const start = Math.max(0, lineIndex - 2)
    const end = Math.min(lines.length, lineIndex + 3)
    return lines.slice(start, end).map(l => l.trim())
  }

  private extractRelatedTerms(line: string): string[] {
    // Extract Python identifiers
    const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g
    const matches = line.match(identifierRegex) || []
    return [...new Set(matches)].filter(
      term => term.length > 2 && !this.isPythonKeyword(term)
    )
  }

  private isPythonKeyword(term: string): boolean {
    const keywords = new Set([
      'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
      'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
      'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
      'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
      'while', 'with', 'yield', 'self', 'super', 'int', 'str', 'float',
      'list', 'dict', 'set', 'tuple', 'bool', 'print', 'len', 'range',
      'type', 'isinstance', 'enumerate', 'zip', 'map', 'filter'
    ])
    return keywords.has(term)
  }

  private isMeaningfulString(value: string): boolean {
    // Filter out strings that are likely just data
    if (/^\d+$/.test(value)) return false // Just numbers
    if (/^[A-Z_]+$/.test(value) && value.length < 10) return false // Short constants
    if (value.includes(' ') || value.includes('/') || value.includes('.') || value.length > 10) {
      return true
    }
    return false
  }
}