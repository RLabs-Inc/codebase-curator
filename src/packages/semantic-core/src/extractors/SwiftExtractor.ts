/**
 * Swift Language Extractor
 * Extracts semantic information from Swift files for iOS/macOS development
 */

import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class SwiftExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.swift$/.test(filePath)
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    // Track current context
    let currentClass: string | null = null
    let currentProtocol: string | null = null
    let currentExtension: string | null = null
    let currentEnum: string | null = null
    let braceDepth = 0
    const contextBraceDepth = new Map<string, number>()

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('//')) return

      // Track brace depth
      braceDepth += (line.match(/{/g) || []).length
      braceDepth -= (line.match(/}/g) || []).length

      // Update context based on brace depth
      if (currentClass && contextBraceDepth.get(currentClass) === braceDepth) {
        currentClass = null
      }
      if (currentProtocol && contextBraceDepth.get(currentProtocol) === braceDepth) {
        currentProtocol = null
      }
      if (currentExtension && contextBraceDepth.get(currentExtension) === braceDepth) {
        currentExtension = null
      }
      if (currentEnum && contextBraceDepth.get(currentEnum) === braceDepth) {
        currentEnum = null
      }

      // Import statements
      const importMatch = line.match(/^\s*import\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (importMatch) {
        definitions.push({
          term: importMatch[1],
          type: 'import',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: ['import', 'framework'],
          language: 'swift',
        })
      }

      // Function declarations
      const funcMatch = line.match(/^\s*(?:@[a-zA-Z]+\s+)*(?:private\s+|public\s+|internal\s+|fileprivate\s+|open\s+)?(?:static\s+|class\s+)?(?:override\s+)?func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:<[^>]+>)?\s*\(/)
      if (funcMatch) {
        const funcName = funcMatch[1]
        let fullName = funcName
        
        // Add context prefix
        if (currentClass) fullName = `${currentClass}.${funcName}`
        else if (currentProtocol) fullName = `${currentProtocol}.${funcName}`
        else if (currentExtension) fullName = `${currentExtension}.${funcName}`
        
        definitions.push({
          term: fullName,
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'swift',
        })

        // Check for SwiftUI view modifiers or special functions
        if (funcName === 'body' && currentClass) {
          definitions.push({
            term: `${currentClass} (SwiftUI View)`,
            type: 'class',
            location: { file: filePath, line: index + 1, column: 0 },
            context: 'SwiftUI View body',
            surroundingLines: [line.trim()],
            relatedTerms: ['swiftui', 'view', 'body'],
            language: 'swift',
          })
        }
      }

      // Class declarations
      const classMatch = line.match(/^\s*(?:@[a-zA-Z]+\s+)*(?:private\s+|public\s+|internal\s+|fileprivate\s+|open\s+)?(?:final\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (classMatch) {
        currentClass = classMatch[1]
        contextBraceDepth.set(currentClass, braceDepth)
        
        definitions.push({
          term: currentClass,
          type: 'class',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'swift',
        })

        // Check for inheritance
        const inheritanceMatch = line.match(/:\s*([^{]+)/)
        if (inheritanceMatch) {
          const inheritance = inheritanceMatch[1].split(',').map(s => s.trim())
          inheritance.forEach(base => {
            if (base && !base.includes('<')) { // Skip generic constraints
              references.push({
                targetTerm: base,
                referenceType: 'extends',
                fromLocation: {
                  file: filePath,
                  line: index + 1,
                  column: 0,
                },
                context: line.trim(),
              })
            }
          })
        }
      }

      // Struct declarations
      const structMatch = line.match(/^\s*(?:@[a-zA-Z]+\s+)*(?:private\s+|public\s+|internal\s+|fileprivate\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (structMatch) {
        currentClass = structMatch[1] // Treat struct like class for context
        contextBraceDepth.set(currentClass, braceDepth)
        
        definitions.push({
          term: currentClass,
          type: 'class',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: ['struct', ...this.extractRelatedTerms(line)],
          language: 'swift',
        })
      }

      // Protocol declarations
      const protocolMatch = line.match(/^\s*(?:@[a-zA-Z]+\s+)*(?:private\s+|public\s+|internal\s+|fileprivate\s+)?protocol\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (protocolMatch) {
        currentProtocol = protocolMatch[1]
        contextBraceDepth.set(currentProtocol, braceDepth)
        
        definitions.push({
          term: currentProtocol,
          type: 'interface',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'swift',
        })
      }

      // Enum declarations
      const enumMatch = line.match(/^\s*(?:@[a-zA-Z]+\s+)*(?:private\s+|public\s+|internal\s+|fileprivate\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (enumMatch) {
        currentEnum = enumMatch[1]
        contextBraceDepth.set(currentEnum, braceDepth)
        
        definitions.push({
          term: currentEnum,
          type: 'class',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: ['enum', ...this.extractRelatedTerms(line)],
          language: 'swift',
        })
      }

      // Extension declarations
      const extensionMatch = line.match(/^\s*extension\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (extensionMatch) {
        currentExtension = extensionMatch[1]
        contextBraceDepth.set(currentExtension, braceDepth)
        
        // Check if it's a protocol conformance
        const conformanceMatch = line.match(/:\s*([^{]+)/)
        if (conformanceMatch) {
          const protocols = conformanceMatch[1].split(',').map(s => s.trim())
          protocols.forEach(protocol => {
            references.push({
              targetTerm: protocol,
              referenceType: 'implements',
              fromLocation: {
                file: filePath,
                line: index + 1,
                column: 0,
              },
              context: line.trim(),
            })
          })
        }
      }

      // Property declarations
      const propertyMatch = line.match(/^\s*(?:@[a-zA-Z]+\s+)*(?:private\s+|public\s+|internal\s+|fileprivate\s+)?(?:static\s+|class\s+)?(?:let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:/)
      if (propertyMatch) {
        const propName = propertyMatch[1]
        let fullName = propName
        
        if (currentClass) fullName = `${currentClass}.${propName}`
        else if (currentProtocol) fullName = `${currentProtocol}.${propName}`
        
        const isConstant = line.includes('let')
        
        definitions.push({
          term: fullName,
          type: isConstant ? 'constant' : 'variable',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'swift',
        })
      }

      // @IBOutlet and @IBAction (Interface Builder)
      const ibMatch = line.match(/@(IBOutlet|IBAction)\s+(?:weak\s+)?(?:var|func)\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (ibMatch) {
        const [, ibType, name] = ibMatch
        definitions.push({
          term: `${currentClass || 'Global'}.${name}`,
          type: ibType === 'IBAction' ? 'function' : 'variable',
          location: { file: filePath, line: index + 1, column: 0 },
          context: `Interface Builder ${ibType}`,
          surroundingLines: [line.trim()],
          relatedTerms: ['interface-builder', ibType.toLowerCase(), 'ui'],
          language: 'swift',
        })
      }

      // Property wrappers (SwiftUI)
      const wrapperMatch = line.match(/@(State|Binding|ObservedObject|StateObject|EnvironmentObject|Environment|Published)\s+(?:private\s+)?var\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (wrapperMatch) {
        const [, wrapper, name] = wrapperMatch
        definitions.push({
          term: `${currentClass || 'Global'}.${name}`,
          type: 'variable',
          location: { file: filePath, line: index + 1, column: 0 },
          context: `SwiftUI @${wrapper}`,
          surroundingLines: [line.trim()],
          relatedTerms: ['swiftui', wrapper.toLowerCase(), 'property-wrapper'],
          language: 'swift',
        })
      }

      // Function calls
      const callMatches = [...line.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)]
      callMatches.forEach(match => {
        const funcName = match[1]
        if (!this.isSwiftKeyword(funcName)) {
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

      // Type instantiation
      const newMatches = [...line.matchAll(/([A-Z][a-zA-Z0-9_]*)\s*\(/g)]
      newMatches.forEach(match => {
        const typeName = match[1]
        if (!this.isSwiftKeyword(typeName)) {
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
        }
      })

      // String literals
      const stringMatches = [...line.matchAll(/"([^"]{4,})"/g)]
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
            language: 'swift',
          })
        }
      })

      // Comments (single-line)
      const commentMatch = line.match(/^\s*\/\/\/?\/?\s*(.+)/)
      if (commentMatch && commentMatch[1].length > 5) {
        const isDocComment = line.includes('///')
        definitions.push({
          term: commentMatch[1].trim(),
          type: 'comment',
          location: { file: filePath, line: index + 1, column: 0 },
          context: isDocComment ? 'Documentation comment' : 'Comment',
          surroundingLines: [line.trim()],
          relatedTerms: isDocComment ? ['documentation'] : [],
          language: 'swift',
        })
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
        const beforeComment = content.substring(0, match.index || 0)
        const lineNumber = beforeComment.split('\n').length
        
        definitions.push({
          term: commentContent,
          type: 'comment',
          location: { file: filePath, line: lineNumber, column: 0 },
          context: 'Multi-line comment',
          surroundingLines: [commentContent.split('\n')[0]],
          relatedTerms: [],
          language: 'swift',
        })
      }
    }
  }

  private getSurroundingLines(lineIndex: number, lines: string[]): string[] {
    const start = Math.max(0, lineIndex - 2)
    const end = Math.min(lines.length, lineIndex + 3)
    return lines.slice(start, end).map(l => l.trim())
  }

  private extractRelatedTerms(line: string): string[] {
    const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g
    const matches = line.match(identifierRegex) || []
    return [...new Set(matches)].filter(
      term => term.length > 2 && !this.isSwiftKeyword(term)
    )
  }

  private isSwiftKeyword(term: string): boolean {
    const keywords = new Set([
      'func', 'var', 'let', 'class', 'struct', 'enum', 'protocol',
      'extension', 'if', 'else', 'for', 'while', 'switch', 'case',
      'default', 'return', 'break', 'continue', 'guard', 'defer',
      'do', 'try', 'catch', 'throw', 'throws', 'async', 'await',
      'import', 'public', 'private', 'internal', 'fileprivate', 'open',
      'static', 'final', 'lazy', 'weak', 'unowned', 'override',
      'init', 'deinit', 'self', 'Self', 'super', 'nil', 'true',
      'false', 'is', 'as', 'in', 'where', 'typeof', 'associatedtype',
      'typealias', 'inout', 'get', 'set', 'willSet', 'didSet',
      'mutating', 'nonmutating', 'convenience', 'required', 'optional',
      'Int', 'Double', 'Float', 'Bool', 'String', 'Character',
      'Array', 'Dictionary', 'Set', 'Optional', 'Any', 'AnyObject'
    ])
    return keywords.has(term)
  }

  private isMeaningfulString(value: string): boolean {
    if (value.length < 4) return false
    if (/^\d+$/.test(value)) return false
    if (/^[A-Z_]+$/.test(value) && value.length < 10) return false
    
    return value.includes(' ') || 
           value.includes('/') || 
           value.includes('.') || 
           value.length > 10
  }
}