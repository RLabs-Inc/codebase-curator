/**
 * Rust Semantic Extractor
 * Extracts semantic information from Rust files
 */

import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class RustExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.rs$/.test(filePath)
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    // Track current context
    let currentMod: string | null = null
    let currentImpl: string | null = null
    let currentTrait: string | null = null
    let braceDepth = 0
    const contextBraceDepth = new Map<string, number>()

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('//')) return

      // Track brace depth for context
      braceDepth += (line.match(/{/g) || []).length
      braceDepth -= (line.match(/}/g) || []).length

      // Update context based on brace depth
      if (currentImpl && contextBraceDepth.get(currentImpl) === braceDepth + 1) {
        currentImpl = null
      }
      if (currentTrait && contextBraceDepth.get(currentTrait) === braceDepth + 1) {
        currentTrait = null
      }
      if (currentMod && contextBraceDepth.get(currentMod) === braceDepth + 1) {
        currentMod = null
      }

      // Module declarations
      const modMatch = line.match(/^\s*(?:pub\s+)?mod\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (modMatch) {
        const modName = modMatch[1]
        currentMod = modName
        contextBraceDepth.set(modName, braceDepth)
        
        definitions.push({
          term: modName,
          type: 'module',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [],
          language: 'rust',
        })
      }

      // Use statements
      const useMatch = line.match(/^\s*(?:pub\s+)?use\s+(.+?);/)
      if (useMatch) {
        const usePath = useMatch[1]
        // Extract the last component as the imported name
        const parts = usePath.split('::')
        const importName = parts[parts.length - 1].replace(/[{}*]/g, '').trim()
        
        if (importName && importName !== 'self' && importName !== 'super') {
          definitions.push({
            term: importName,
            type: 'import',
            location: { file: filePath, line: index + 1, column: 0 },
            context: line.trim(),
            surroundingLines: [line.trim()],
            relatedTerms: [usePath],
            language: 'rust',
          })
        }
      }

      // Function declarations
      const funcMatch = line.match(/^\s*(?:pub\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+(?:"[^"]+"\s+)?)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (funcMatch) {
        const funcName = funcMatch[1]
        let fullName = funcName
        
        // If inside impl block, prefix with type
        if (currentImpl) {
          fullName = `${currentImpl}::${funcName}`
        }
        
        definitions.push({
          term: fullName,
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'rust',
        })

        // Check for trait implementation
        if (currentTrait && currentImpl) {
          references.push({
            targetTerm: currentTrait,
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

      // Struct declarations
      const structMatch = line.match(/^\s*(?:pub\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (structMatch) {
        definitions.push({
          term: structMatch[1],
          type: 'class',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'rust',
        })
      }

      // Enum declarations
      const enumMatch = line.match(/^\s*(?:pub\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (enumMatch) {
        definitions.push({
          term: enumMatch[1],
          type: 'class',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'rust',
        })
      }

      // Trait declarations
      const traitMatch = line.match(/^\s*(?:pub\s+)?trait\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (traitMatch) {
        const traitName = traitMatch[1]
        currentTrait = traitName
        contextBraceDepth.set(traitName, braceDepth)
        
        definitions.push({
          term: traitName,
          type: 'interface',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'rust',
        })
      }

      // Type aliases
      const typeMatch = line.match(/^\s*(?:pub\s+)?type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/)
      if (typeMatch) {
        definitions.push({
          term: typeMatch[1],
          type: 'class',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'rust',
        })
      }

      // Implementation blocks
      const implMatch = line.match(/^\s*impl(?:<[^>]+>)?\s+(?:([a-zA-Z_][a-zA-Z0-9_]*)\s+for\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (implMatch) {
        const [, traitName, typeName] = implMatch
        currentImpl = typeName
        contextBraceDepth.set(typeName, braceDepth)
        
        if (traitName) {
          currentTrait = traitName
          // This is a trait implementation
          references.push({
            targetTerm: traitName,
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

      // Constants and statics
      const constMatch = line.match(/^\s*(?:pub\s+)?(?:const|static)\s+([A-Z_][A-Z0-9_]*):/)
      if (constMatch) {
        definitions.push({
          term: constMatch[1],
          type: 'constant',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'rust',
        })
      }

      // Let bindings
      const letMatch = line.match(/^\s*let\s+(?:mut\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (letMatch) {
        definitions.push({
          term: letMatch[1],
          type: 'variable',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: this.extractRelatedTerms(line),
          language: 'rust',
        })
      }

      // Macro definitions
      const macroMatch = line.match(/^\s*(?:pub\s+)?macro(?:_rules)?!\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
      if (macroMatch) {
        definitions.push({
          term: macroMatch[1] + '!',
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: ['macro'],
          language: 'rust',
        })
      }

      // Function/method calls
      const callMatches = [...line.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*(?:::[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\(/g)]
      callMatches.forEach(match => {
        const funcName = match[1]
        if (!this.isRustKeyword(funcName)) {
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

      // Macro calls
      const macroCallMatches = [...line.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)!/g)]
      macroCallMatches.forEach(match => {
        const macroName = match[1] + '!'
        if (!this.isRustBuiltinMacro(macroName)) {
          references.push({
            targetTerm: macroName,
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
      const newMatches = [...line.matchAll(/([A-Z][a-zA-Z0-9_]*)\s*::/g)]
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
            language: 'rust',
          })
        }
      })

      // Comments (single-line)
      const commentMatch = line.match(/^\s*\/\/\/?!?\s*(.+)/)
      if (commentMatch && commentMatch[1].length > 5) {
        definitions.push({
          term: commentMatch[1].trim(),
          type: 'comment',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [],
          language: 'rust',
        })
      }

      // Derive attributes (common pattern in Rust)
      const deriveMatch = line.match(/#\[derive\(([^)]+)\)\]/)
      if (deriveMatch) {
        const derives = deriveMatch[1].split(',').map(s => s.trim())
        derives.forEach(derive => {
          references.push({
            targetTerm: derive,
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
    })

    // Extract doc comments
    this.extractDocComments(lines, filePath, definitions)

    return { definitions, references }
  }

  private extractDocComments(lines: string[], filePath: string, definitions: SemanticInfo[]): void {
    let docLines: string[] = []
    let docStart = 0
    let inDocComment = false

    lines.forEach((line, index) => {
      const docMatch = line.match(/^\s*\/\/\/\s*(.*)/)
      
      if (docMatch) {
        if (!inDocComment) {
          inDocComment = true
          docStart = index
          docLines = []
        }
        docLines.push(docMatch[1])
      } else if (inDocComment) {
        // End of doc comment
        const fullDoc = docLines.join('\n').trim()
        if (fullDoc.length > 5) {
          definitions.push({
            term: fullDoc,
            type: 'comment',
            location: { file: filePath, line: docStart + 1, column: 0 },
            context: 'Doc comment',
            surroundingLines: docLines.slice(0, 3),
            relatedTerms: [],
            language: 'rust',
          })
        }
        inDocComment = false
        docLines = []
      }
    })
  }

  private getSurroundingLines(lineIndex: number, lines: string[]): string[] {
    const start = Math.max(0, lineIndex - 2)
    const end = Math.min(lines.length, lineIndex + 3)
    return lines.slice(start, end).map(l => l.trim())
  }

  private extractRelatedTerms(line: string): string[] {
    // Extract Rust identifiers
    const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g
    const matches = line.match(identifierRegex) || []
    return [...new Set(matches)].filter(
      term => term.length > 2 && !this.isRustKeyword(term)
    )
  }

  private isRustKeyword(term: string): boolean {
    const keywords = new Set([
      'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn',
      'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in',
      'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
      'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type',
      'unsafe', 'use', 'where', 'while', 'abstract', 'become', 'box', 'do',
      'final', 'macro', 'override', 'priv', 'typeof', 'unsized', 'virtual',
      'yield', 'try', 'union', 'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
      'u8', 'u16', 'u32', 'u64', 'u128', 'usize', 'f32', 'f64', 'bool',
      'char', 'str', 'String', 'Vec', 'Option', 'Result', 'Some', 'None',
      'Ok', 'Err', 'Box', 'Rc', 'Arc'
    ])
    return keywords.has(term)
  }

  private isRustBuiltinMacro(macro: string): boolean {
    const builtins = new Set([
      'println!', 'print!', 'eprintln!', 'eprint!', 'format!', 'panic!',
      'assert!', 'assert_eq!', 'assert_ne!', 'debug_assert!', 'vec!',
      'include!', 'include_str!', 'include_bytes!', 'concat!', 'env!',
      'option_env!', 'cfg!', 'file!', 'line!', 'column!', 'module_path!',
      'stringify!', 'write!', 'writeln!', 'todo!', 'unimplemented!',
      'unreachable!', 'compile_error!', 'format_args!', 'matches!',
      'dbg!', 'thread_local!'
    ])
    return builtins.has(macro)
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