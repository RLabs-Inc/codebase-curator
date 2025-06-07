/**
 * Go Semantic Extractor
 * Extracts semantic information from Go files
 */

import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class GoExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.go$/.test(filePath)
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    // Track current context
    let currentPackage = ''
    let currentStruct: string | null = null
    let currentInterface: string | null = null
    let braceDepth = 0
    const structBraceDepth = new Map<string, number>()

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('//')) return

      // Track brace depth for context
      braceDepth += (line.match(/{/g) || []).length
      braceDepth -= (line.match(/}/g) || []).length

      // Update struct/interface context
      if (currentStruct && structBraceDepth.get(currentStruct) === braceDepth + 1) {
        currentStruct = null
      }
      if (currentInterface && structBraceDepth.get(currentInterface) === braceDepth + 1) {
        currentInterface = null
      }

      // Package declaration
      const packageMatch = line.match(/^package\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (packageMatch) {
        currentPackage = packageMatch[1]
        definitions.push({
          term: packageMatch[1],
          type: 'module',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [],
          language: 'go',
        })
      }

      // Import statements
      const importMatch = line.match(/^\s*import\s+"([^"]+)"/)
      if (importMatch) {
        const importPath = importMatch[1]
        const importName = importPath.split('/').pop() || importPath
        definitions.push({
          term: importName,
          type: 'import',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [importPath],
          language: 'go',
        })
      }

      // Import block
      if (line.match(/^\s*import\s*\(/)) {
        // Handle multi-line imports - simplified for now
        const importBlockMatch = line.match(/"([^"]+)"/)
        if (importBlockMatch) {
          const importPath = importBlockMatch[1]
          const importName = importPath.split('/').pop() || importPath
          definitions.push({
            term: importName,
            type: 'import',
            location: { file: filePath, line: index + 1, column: 0 },
            context: line.trim(),
            surroundingLines: [line.trim()],
            relatedTerms: [importPath],
            language: 'go',
          })
        }
      }

      // Function declarations
      const funcMatch = line.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)
      if (funcMatch) {
        const funcName = funcMatch[1]
        
        // Check if it's a method (has receiver)
        const receiverMatch = line.match(/^func\s+\(([^)]+)\)\s+/)
        let fullName = funcName
        
        if (receiverMatch) {
          // Extract receiver type
          const receiverParts = receiverMatch[1].trim().split(/\s+/)
          const receiverType = receiverParts[receiverParts.length - 1].replace(/[*]/g, '')
          fullName = `${receiverType}.${funcName}`
        }

        definitions.push({
          term: fullName,
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'go',
        })

        // Interface implementation detection
        if (currentInterface && receiverMatch) {
          references.push({
            targetTerm: currentInterface,
            referenceType: 'implements',
            fromLocation: {
              file: filePath,
              line: index + 1,
              column: 0,
            },
            context: line.trim(),
          })
        }
      }

      // Type declarations
      const typeMatch = line.match(/^type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(.+)/)
      if (typeMatch) {
        const [, typeName, typeDefinition] = typeMatch
        
        // Determine type category
        let typeCategory: SemanticInfo['type'] = 'class'
        if (typeDefinition.includes('struct')) {
          typeCategory = 'class'
          currentStruct = typeName
          structBraceDepth.set(typeName, braceDepth)
        } else if (typeDefinition.includes('interface')) {
          typeCategory = 'interface'
          currentInterface = typeName
          structBraceDepth.set(typeName, braceDepth)
        } else if (typeDefinition.includes('func')) {
          typeCategory = 'function'
        }

        definitions.push({
          term: typeName,
          type: typeCategory,
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'go',
        })

        // Check for type embedding/composition
        if (typeDefinition.includes('struct') && lines[index + 1]) {
          // Simple check for embedded types
          const embeddedMatch = lines[index + 1].match(/^\s*([A-Z][a-zA-Z0-9_]*)$/)
          if (embeddedMatch) {
            references.push({
              targetTerm: embeddedMatch[1],
              referenceType: 'extends',
              fromLocation: {
                file: filePath,
                line: index + 2,
                column: 0,
              },
              context: lines[index + 1].trim(),
            })
          }
        }
      }

      // Struct fields (when inside a struct)
      if (currentStruct && !funcMatch && !typeMatch) {
        const fieldMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_\[\]\*]+)/)
        if (fieldMatch) {
          const [, fieldName, fieldType] = fieldMatch
          definitions.push({
            term: `${currentStruct}.${fieldName}`,
            type: 'variable',
            location: { file: filePath, line: index + 1, column: 0 },
            context: line.trim(),
            surroundingLines: [line.trim()],
            relatedTerms: [fieldType],
            language: 'go',
          })
        }
      }

      // Variable and constant declarations
      const varMatch = line.match(/^(?:var|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+/)
      if (varMatch) {
        const isConst = line.startsWith('const')
        definitions.push({
          term: varMatch[1],
          type: isConst ? 'constant' : 'variable',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'go',
        })
      }

      // Short variable declarations
      const shortVarMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:=/)
      if (shortVarMatch) {
        definitions.push({
          term: shortVarMatch[1],
          type: 'variable',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'go',
        })
      }

      // Function calls
      const callMatches = [...line.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\s*\(/g)]
      callMatches.forEach(match => {
        const funcName = match[1]
        // Skip Go keywords and common built-ins
        if (!this.isGoKeyword(funcName.split('.')[0])) {
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

      // Type instantiation (composite literals)
      const newMatches = [...line.matchAll(/([A-Z][a-zA-Z0-9_]*)\s*{/g)]
      newMatches.forEach(match => {
        const typeName = match[1]
        references.push({
          targetTerm: typeName,
          referenceType: 'instantiation',
          fromLocation: {
            file: filePath,
            line: index + 1,
            column: match.index || 0,
          },
          context: line.trim(),
        })
      })

      // Channel operations
      const chanMatch = line.match(/make\s*\(\s*chan\s+([^,\)]+)/)
      if (chanMatch) {
        definitions.push({
          term: `chan ${chanMatch[1].trim()}`,
          type: 'variable',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: ['channel', chanMatch[1].trim()],
          language: 'go',
        })
      }

      // String literals
      const stringMatches = [...line.matchAll(/"([^"]{4,})"|`([^`]{4,})`/g)]
      stringMatches.forEach(match => {
        const value = match[1] || match[2]
        if (this.isMeaningfulString(value)) {
          definitions.push({
            term: value,
            type: 'string',
            location: { file: filePath, line: index + 1, column: match.index || 0 },
            context: line.trim(),
            surroundingLines: [line.trim()],
            relatedTerms: [],
            language: 'go',
          })
        }
      })

      // Comments (single-line)
      const commentMatch = line.match(/^\s*\/\/\s*(.+)/)
      if (commentMatch && commentMatch[1].length > 5) {
        const commentText = commentMatch[1].trim()
        const semanticInfo: SemanticInfo = {
          term: commentText,
          type: 'comment',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [],
          language: 'go',
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

    // Extract multi-line comments
    this.extractMultiLineComments(content, filePath, definitions)

    return { definitions, references }
  }

  private extractMultiLineComments(content: string, filePath: string, definitions: SemanticInfo[]): void {
    const multiLineCommentRegex = /\/\*([^*]|\*(?!\/))*\*\//gs
    const matches = content.matchAll(multiLineCommentRegex)
    
    for (const match of matches) {
      const comment = match[0]
      const commentContent = comment.slice(2, -2).trim()
      
      if (commentContent.length > 5) {
        // Find line number
        const beforeComment = content.substring(0, match.index || 0)
        const lineNumber = beforeComment.split('\n').length
        
        const semanticInfo: SemanticInfo = {
          term: commentContent,
          type: 'comment',
          location: { file: filePath, line: lineNumber, column: 0 },
          context: 'Multi-line comment',
          surroundingLines: [commentContent.split('\n')[0]],
          relatedTerms: [],
          language: 'go',
        }
        
        // Check for development markers in multi-line comments
        const devMarkerPattern = /\b(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REFACTOR|NOTE|REVIEW|DEPRECATED|WORKAROUND|TEMP|KLUDGE|SMELL)\b/gi
        const markerMatches = commentContent.match(devMarkerPattern)
        if (markerMatches) {
          semanticInfo.metadata = {
            isDevelopmentMarker: true,
            markerTypes: [...new Set(markerMatches.map(m => m.toUpperCase()))]
          }
        }
        
        definitions.push(semanticInfo)
      }
    }
  }

  private getSurroundingLines(lineIndex: number, lines: string[]): string[] {
    const start = Math.max(0, lineIndex - 2)
    const end = Math.min(lines.length, lineIndex + 3)
    return lines.slice(start, end).map(l => l.trim())
  }

  private extractRelatedTerms(line: string): string[] {
    // Extract Go identifiers
    const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g
    const matches = line.match(identifierRegex) || []
    return [...new Set(matches)].filter(
      term => term.length > 2 && !this.isGoKeyword(term)
    )
  }

  private isGoKeyword(term: string): boolean {
    const keywords = new Set([
      'break', 'case', 'chan', 'const', 'continue', 'default', 'defer',
      'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import',
      'interface', 'map', 'package', 'range', 'return', 'select', 'struct',
      'switch', 'type', 'var', 'true', 'false', 'nil', 'make', 'new',
      'append', 'cap', 'close', 'complex', 'copy', 'delete', 'imag', 'len',
      'panic', 'print', 'println', 'real', 'recover', 'int', 'int8', 'int16',
      'int32', 'int64', 'uint', 'uint8', 'uint16', 'uint32', 'uint64',
      'float32', 'float64', 'bool', 'byte', 'rune', 'string', 'error'
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