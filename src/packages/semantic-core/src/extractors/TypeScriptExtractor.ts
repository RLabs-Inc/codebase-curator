/**
 * TypeScript/JavaScript Semantic Extractor
 * Uses Babel to parse and extract semantic information from TS/JS files
 */

import * as parser from '@babel/parser'
import traverse from '@babel/traverse'
import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class TypeScriptExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath)
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    try {
      // Parse with Babel - be very permissive to handle various code styles
      const ast = parser.parse(content, {
        sourceType: 'unambiguous', // Let Babel figure out if it's module or script
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'classPrivateProperties',
          'classPrivateMethods',
          'dynamicImport',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'nullishCoalescingOperator',
          'optionalChaining',
          'objectRestSpread',
        ],
        errorRecovery: true, // Continue parsing even with errors
      })

      // Traverse the AST and extract semantic information
      traverse(ast, {
        // Function declarations
        FunctionDeclaration: (path) => {
          if (path.node.id?.name) {
            definitions.push(
              this.createSemanticInfo(
                path.node.id.name,
                'function',
                path.node.loc,
                filePath,
                lines,
                this.getContext(path.node.loc, lines)
              )
            )
          }
        },

        // Arrow functions and function expressions assigned to variables
        VariableDeclarator: (path) => {
          if (path.node.id.type === 'Identifier' && path.node.init) {
            const isFunction =
              path.node.init.type === 'ArrowFunctionExpression' ||
              path.node.init.type === 'FunctionExpression'

            definitions.push(
              this.createSemanticInfo(
                path.node.id.name,
                isFunction ? 'function' : 'variable',
                path.node.loc,
                filePath,
                lines,
                this.getContext(path.node.loc, lines)
              )
            )
          }
        },

        // Class declarations
        ClassDeclaration: (path) => {
          if (path.node.id?.name) {
            definitions.push(
              this.createSemanticInfo(
                path.node.id.name,
                'class',
                path.node.loc,
                filePath,
                lines,
                this.getContext(path.node.loc, lines)
              )
            )

            // Also extract class methods
            path.node.body.body.forEach((member) => {
              if (
                member.type === 'ClassMethod' &&
                member.key.type === 'Identifier'
              ) {
                definitions.push(
                  this.createSemanticInfo(
                    `${path.node.id?.name}.${member.key.name}`,
                    'function',
                    member.loc,
                    filePath,
                    lines,
                    this.getContext(member.loc, lines)
                  )
                )
              }
            })
          }

          // CROSS-REFERENCE: Class inheritance
          if (
            path.node.superClass &&
            path.node.superClass.type === 'Identifier'
          ) {
            references.push({
              targetTerm: path.node.superClass.name,
              referenceType: 'extends',
              fromLocation: {
                file: filePath,
                line: path.node.loc?.start?.line || 0,
                column: path.node.loc?.start?.column || 0,
              },
              context: this.getContext(path.node.loc, lines),
            })
          }
        },

        // Object method shorthand: { methodName() {} }
        ObjectMethod: (path) => {
          if (path.node.key.type === 'Identifier') {
            definitions.push(
              this.createSemanticInfo(
                path.node.key.name,
                'function',
                path.node.loc,
                filePath,
                lines,
                this.getContext(path.node.loc, lines)
              )
            )
          }
        },

        // Export declarations
        ExportNamedDeclaration: (path) => {
          if (path.node.declaration) {
            // Handled by other visitors
            return
          }

          // Handle export { name }
          path.node.specifiers.forEach((spec) => {
            if (
              spec.type === 'ExportSpecifier' &&
              spec.local.type === 'Identifier'
            ) {
              definitions.push(
                this.createSemanticInfo(
                  spec.exported.type === 'Identifier'
                    ? spec.exported.name
                    : spec.local.name,
                  'variable',
                  spec.loc,
                  filePath,
                  lines,
                  this.getContext(path.node.loc, lines)
                )
              )
            }
          })
        },

        // Import declarations
        ImportDeclaration: (path) => {
          path.node.specifiers.forEach((spec) => {
            if (
              spec.type === 'ImportDefaultSpecifier' ||
              spec.type === 'ImportSpecifier' ||
              spec.type === 'ImportNamespaceSpecifier'
            ) {
              definitions.push(
                this.createSemanticInfo(
                  spec.local.name,
                  'import',
                  spec.loc,
                  filePath,
                  lines,
                  this.getContext(path.node.loc, lines)
                )
              )
            }
          })
        },

        // String literals
        StringLiteral: (path) => {
          const value = path.node.value
          // Only index meaningful strings
          if (value.length > 3 && this.isMeaningfulString(value)) {
            definitions.push(
              this.createSemanticInfo(
                value,
                'string',
                path.node.loc,
                filePath,
                lines,
                this.getContext(path.node.loc, lines)
              )
            )
          }
        },

        // Template literals
        TemplateLiteral: (path) => {
          const value = path.node.quasis.map((q) => q.value.raw).join('${...}')
          if (value.length > 3 && this.isMeaningfulString(value)) {
            definitions.push(
              this.createSemanticInfo(
                value,
                'string',
                path.node.loc,
                filePath,
                lines,
                this.getContext(path.node.loc, lines)
              )
            )
          }
        },

        // Type aliases and interfaces (TypeScript)
        TSTypeAliasDeclaration: (path) => {
          if (path.node.id?.name) {
            definitions.push(
              this.createSemanticInfo(
                path.node.id.name,
                'class', // Treat types as classes for simplicity
                path.node.loc,
                filePath,
                lines,
                this.getContext(path.node.loc, lines)
              )
            )
          }
        },

        TSInterfaceDeclaration: (path) => {
          if (path.node.id?.name) {
            definitions.push(
              this.createSemanticInfo(
                path.node.id.name,
                'class', // Treat interfaces as classes
                path.node.loc,
                filePath,
                lines,
                this.getContext(path.node.loc, lines)
              )
            )
          }
        },

        // CROSS-REFERENCES: Function calls
        CallExpression: (path) => {
          let functionName: string | null = null

          if (path.node.callee.type === 'Identifier') {
            // Direct function call: functionName()
            functionName = path.node.callee.name
          } else if (
            path.node.callee.type === 'MemberExpression' &&
            path.node.callee.property.type === 'Identifier' &&
            !path.node.callee.computed
          ) {
            // Method call: object.method()
            if (path.node.callee.object.type === 'Identifier') {
              functionName = `${path.node.callee.object.name}.${path.node.callee.property.name}`
            } else {
              // Just the method name for complex objects
              functionName = path.node.callee.property.name
            }
          }

          if (functionName) {
            references.push({
              targetTerm: functionName,
              referenceType: 'call',
              fromLocation: {
                file: filePath,
                line: path.node.loc?.start?.line || 0,
                column: path.node.loc?.start?.column || 0,
              },
              context: this.getContext(path.node.loc, lines),
            })
          }
        },

        // CROSS-REFERENCES: New expressions (instantiation)
        NewExpression: (path) => {
          if (path.node.callee.type === 'Identifier') {
            references.push({
              targetTerm: path.node.callee.name,
              referenceType: 'instantiation',
              fromLocation: {
                file: filePath,
                line: path.node.loc?.start?.line || 0,
                column: path.node.loc?.start?.column || 0,
              },
              context: this.getContext(path.node.loc, lines),
            })
          }
        },
      })

      // Extract comments
      if (ast.comments) {
        ast.comments.forEach((comment) => {
          const value = comment.value.trim()
          if (value.length > 5) {
            // Skip tiny comments
            definitions.push(
              this.createSemanticInfo(
                value,
                'comment',
                comment.loc,
                filePath,
                lines,
                this.getContext(comment.loc, lines)
              )
            )
          }
        })
      }
    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error)
      // Fallback to simple regex extraction
      return this.fallbackExtraction(content, filePath)
    }

    return { definitions, references }
  }

  private createSemanticInfo(
    term: string,
    type: SemanticInfo['type'],
    loc: any,
    filePath: string,
    lines: string[],
    context: string
  ): SemanticInfo {
    return {
      term,
      type,
      location: {
        file: filePath,
        line: loc?.start?.line || 0,
        column: loc?.start?.column || 0,
      },
      context,
      surroundingLines: this.getSurroundingLines(loc?.start?.line || 0, lines),
      relatedTerms: this.extractRelatedTerms(context),
      language: 'typescript',
    }
  }

  private getContext(loc: any, lines: string[]): string {
    if (!loc?.start?.line) return ''
    const lineIndex = loc.start.line - 1
    return lines[lineIndex] || ''
  }

  private getSurroundingLines(lineNumber: number, lines: string[]): string[] {
    const start = Math.max(0, lineNumber - 2)
    const end = Math.min(lines.length, lineNumber + 2)
    return lines.slice(start, end)
  }

  private extractRelatedTerms(context: string): string[] {
    // Extract identifiers from the context line
    const identifierRegex = /[a-zA-Z_$][a-zA-Z0-9_$]*/g
    const matches = context.match(identifierRegex) || []
    return [...new Set(matches)].filter(
      (term) =>
        term.length > 2 &&
        ![
          'const',
          'let',
          'var',
          'function',
          'class',
          'return',
          'if',
          'else',
          'for',
          'while',
        ].includes(term)
    )
  }

  private isMeaningfulString(value: string): boolean {
    // Filter out strings that are likely just data
    if (/^\d+$/.test(value)) return false // Just numbers
    if (/^[A-Z_]+$/.test(value) && value.length < 10) return false // Short constants
    if (
      value.includes(' ') ||
      value.includes('/') ||
      value.includes('.') ||
      value.length > 10
    )
      return true
    return false
  }

  private fallbackExtraction(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    // Simple regex-based extraction as fallback
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // Extract function declarations
      const functionMatches = [
        line.match(
          /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
        ),
        line.match(
          /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/
        ),
        line.match(
          /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(?:async\s+)?(?:function)?\s*\(/
        ),
      ]

      functionMatches.forEach((match) => {
        if (match && match[1]) {
          definitions.push({
            term: match[1],
            type: 'function',
            location: { file: filePath, line: index + 1, column: 0 },
            context: line.trim(),
            surroundingLines: [line.trim()],
            relatedTerms: [],
            language: 'typescript',
          })
        }
      })

      // Extract class declarations
      const classMatch = line.match(
        /(?:export\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
      )
      if (classMatch) {
        definitions.push({
          term: classMatch[1],
          type: 'class',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [],
          language: 'typescript',
        })
      }

      // Extract strings
      const stringMatches = line.match(
        /"([^"]{4,})"|'([^']{4,})'|`([^`]{4,})`/g
      )
      if (stringMatches) {
        stringMatches.forEach((match) => {
          const value = match.slice(1, -1) // Remove quotes
          if (this.isMeaningfulString(value)) {
            definitions.push({
              term: value,
              type: 'string',
              location: { file: filePath, line: index + 1, column: 0 },
              context: line.trim(),
              surroundingLines: [line.trim()],
              relatedTerms: [],
              language: 'typescript',
            })
          }
        })
      }

      // Extract comments
      const commentMatches = [
        line.match(/\/\/\s*(.+)/),
        line.match(/\/\*\s*(.+?)\s*\*\//),
      ]

      commentMatches.forEach((match) => {
        if (match && match[1] && match[1].length > 5) {
          definitions.push({
            term: match[1].trim(),
            type: 'comment',
            location: { file: filePath, line: index + 1, column: 0 },
            context: line.trim(),
            surroundingLines: [line.trim()],
            relatedTerms: [],
            language: 'typescript',
          })
        }
      })
    })

    return { definitions, references }
  }
}
