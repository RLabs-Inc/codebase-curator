import { BaseLanguageAnalyzer } from '../../base/BaseLanguageAnalyzer'
import { ImportStatement, CodePattern, Framework, Language } from '../../../types/language'

export class PythonAnalyzer extends BaseLanguageAnalyzer {
  language: Language = {
    name: 'python',
    displayName: 'Python',
    extensions: ['.py'],
    aliases: ['python', 'py'],
    importPatterns: [
      /^import\s+[\w.]+/,
      /^from\s+[\w.]+\s+import/
    ],
    exportPatterns: [
      /__all__\s*=\s*\[/
    ],
    functionPatterns: [
      /^def\s+\w+\s*\(/,
      /^async\s+def\s+\w+\s*\(/
    ],
    classPatterns: [
      /^class\s+\w+/
    ]
  }

  parseImports(content: string, filePath: string): ImportStatement[] {
    const imports: ImportStatement[] = []
    const cleanContent = this.removeComments(content)
    const lines = cleanContent.split('\n')

    // Regular imports: import module, import module as alias
    const importRegex = /^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)*)/
    const importAsRegex = /^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)/
    
    // From imports: from module import item, from module import *
    const fromImportRegex = /^from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import\s+(.+)/
    
    // Relative imports: from . import module, from .. import module
    const relativeImportRegex = /^from\s+(\.+)\s+import\s+(.+)/
    const relativeFromRegex = /^from\s+(\.+)([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import\s+(.+)/

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) return

      // Handle import ... as ...
      let match = trimmedLine.match(importAsRegex)
      if (match) {
        imports.push({
          source: match[1],
          alias: match[2],
          lineNumber: index + 1,
          type: 'static'
        })
        return
      }

      // Handle regular imports
      match = trimmedLine.match(importRegex)
      if (match) {
        // Handle multiple imports: import os, sys, json
        const modules = match[1].split(',').map(m => m.trim())
        modules.forEach(module => {
          if (module) {
            imports.push({
              source: module,
              lineNumber: index + 1,
              type: 'static'
            })
          }
        })
        return
      }

      // Handle relative from imports with module path
      match = trimmedLine.match(relativeFromRegex)
      if (match) {
        const dots = match[1]
        const modulePath = match[2]
        const importedItems = match[3]
        
        const source = dots + modulePath
        this.parseFromImportItems(importedItems, source, index + 1, imports)
        return
      }

      // Handle simple relative imports
      match = trimmedLine.match(relativeImportRegex)
      if (match) {
        const dots = match[1]
        const importedItems = match[2]
        
        this.parseFromImportItems(importedItems, dots, index + 1, imports)
        return
      }

      // Handle from imports
      match = trimmedLine.match(fromImportRegex)
      if (match) {
        const source = match[1]
        const importedItems = match[2]
        
        this.parseFromImportItems(importedItems, source, index + 1, imports)
      }
    })

    return imports
  }

  private parseFromImportItems(
    itemsStr: string, 
    source: string, 
    lineNumber: number, 
    imports: ImportStatement[]
  ) {
    // Handle wildcard imports
    if (itemsStr.trim() === '*') {
      imports.push({
        source,
        isWildcard: true,
        lineNumber,
        type: 'static'
      })
      return
    }

    // Handle parentheses for multi-line imports
    const cleanItems = itemsStr.replace(/[()]/g, '')
    
    // Split by comma but handle 'as' aliases
    const items = cleanItems.split(',').map(item => item.trim())
    
    items.forEach(item => {
      if (!item) return
      
      const asMatch = item.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)$/)
      if (asMatch) {
        imports.push({
          source,
          specifiers: [asMatch[1]],
          alias: asMatch[2],
          lineNumber,
          type: 'static'
        })
      } else {
        imports.push({
          source,
          specifiers: [item],
          lineNumber,
          type: 'static'
        })
      }
    })
  }

  detectFrameworks(dependencies: string[], fileContents?: Map<string, string>): Framework[] {
    const frameworks: Framework[] = []
    
    // Check requirements.txt or setup.py dependencies
    const depLower = dependencies.map(d => d.toLowerCase())
    
    // Web frameworks
    if (depLower.some(d => d.includes('django'))) {
      frameworks.push({ name: 'Django', type: 'web', version: this.extractVersion(dependencies, 'django') })
    }
    if (depLower.some(d => d.includes('flask'))) {
      frameworks.push({ name: 'Flask', type: 'web', version: this.extractVersion(dependencies, 'flask') })
    }
    if (depLower.some(d => d.includes('fastapi'))) {
      frameworks.push({ name: 'FastAPI', type: 'web', version: this.extractVersion(dependencies, 'fastapi') })
    }
    if (depLower.some(d => d.includes('tornado'))) {
      frameworks.push({ name: 'Tornado', type: 'web', version: this.extractVersion(dependencies, 'tornado') })
    }

    // Data science frameworks
    if (depLower.some(d => d.includes('pandas'))) {
      frameworks.push({ name: 'Pandas', type: 'data', version: this.extractVersion(dependencies, 'pandas') })
    }
    if (depLower.some(d => d.includes('numpy'))) {
      frameworks.push({ name: 'NumPy', type: 'data', version: this.extractVersion(dependencies, 'numpy') })
    }
    if (depLower.some(d => d.includes('scikit-learn'))) {
      frameworks.push({ name: 'Scikit-learn', type: 'ml', version: this.extractVersion(dependencies, 'scikit-learn') })
    }

    // ML frameworks
    if (depLower.some(d => d.includes('tensorflow'))) {
      frameworks.push({ name: 'TensorFlow', type: 'ml', version: this.extractVersion(dependencies, 'tensorflow') })
    }
    if (depLower.some(d => d.includes('torch') || d.includes('pytorch'))) {
      frameworks.push({ name: 'PyTorch', type: 'ml', version: this.extractVersion(dependencies, 'torch') })
    }

    // Testing frameworks
    if (depLower.some(d => d.includes('pytest'))) {
      frameworks.push({ name: 'pytest', type: 'testing', version: this.extractVersion(dependencies, 'pytest') })
    }
    if (depLower.some(d => d.includes('unittest'))) {
      frameworks.push({ name: 'unittest', type: 'testing' })
    }

    // Check file contents for framework-specific patterns
    if (fileContents) {
      for (const [path, content] of fileContents) {
        if (path.endsWith('.py')) {
          // Django patterns
          if (content.includes('from django.') || content.includes('import django')) {
            if (!frameworks.some(f => f.name === 'Django')) {
              frameworks.push({ name: 'Django', type: 'web' })
            }
          }
          
          // Flask patterns
          if (content.includes('from flask import') || content.includes('@app.route')) {
            if (!frameworks.some(f => f.name === 'Flask')) {
              frameworks.push({ name: 'Flask', type: 'web' })
            }
          }

          // FastAPI patterns
          if (content.includes('from fastapi import') || content.includes('FastAPI()')) {
            if (!frameworks.some(f => f.name === 'FastAPI')) {
              frameworks.push({ name: 'FastAPI', type: 'web' })
            }
          }
        }
      }
    }

    return frameworks
  }

  protected extractParameters(paramString: string): string[] {
    if (!paramString.trim()) return []
    
    // Split by comma but preserve nested parentheses/brackets
    const params: string[] = []
    let current = ''
    let depth = 0
    
    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i]
      
      if (char === '(' || char === '[' || char === '{') {
        depth++
      } else if (char === ')' || char === ']' || char === '}') {
        depth--
      }
      
      if (char === ',' && depth === 0) {
        params.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    if (current.trim()) {
      params.push(current.trim())
    }
    
    return params
  }

  private extractVersion(dependencies: string[], packageName: string): string | undefined {
    const dep = dependencies.find(d => d.toLowerCase().includes(packageName.toLowerCase()))
    if (!dep) return undefined

    // Handle various version formats: package==1.2.3, package>=1.2.3, package~=1.2.3
    const versionMatch = dep.match(/[=<>~]+\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)/)
    return versionMatch ? versionMatch[1] : undefined
  }

  extractPatterns(content: string, filePath: string): CodePattern[] {
    const patterns: CodePattern[] = []
    const cleanContent = this.removeComments(content)

    // Class definitions
    const classRegex = /^class\s+([A-Z][a-zA-Z0-9_]*)\s*(?:\(([^)]+)\))?\s*:/gm
    let match
    while ((match = classRegex.exec(cleanContent)) !== null) {
      const lineNumber = cleanContent.substring(0, match.index).split('\n').length
      patterns.push({
        type: 'class',
        name: match[1],
        lineNumber,
        parameters: match[2] ? this.extractParameters(match[2]) : []
      })
    }

    // Function definitions
    const funcRegex = /^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/gm
    while ((match = funcRegex.exec(cleanContent)) !== null) {
      const lineNumber = cleanContent.substring(0, match.index).split('\n').length
      patterns.push({
        type: 'function',
        name: match[1],
        lineNumber,
        parameters: this.extractParameters(match[2]),
        returnType: match[3]?.trim()
      })
    }

    // Async function definitions
    const asyncFuncRegex = /^async\s+def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/gm
    while ((match = asyncFuncRegex.exec(cleanContent)) !== null) {
      const lineNumber = cleanContent.substring(0, match.index).split('\n').length
      patterns.push({
        type: 'function',
        name: match[1],
        lineNumber,
        parameters: this.extractParameters(match[2]),
        returnType: match[3]?.trim(),
        modifiers: ['async']
      })
    }

    // Decorators
    const decoratorRegex = /^@([a-zA-Z_][a-zA-Z0-9_.]*)(?:\(([^)]*)\))?$/gm
    while ((match = decoratorRegex.exec(cleanContent)) !== null) {
      const lineNumber = cleanContent.substring(0, match.index).split('\n').length
      patterns.push({
        type: 'decorator',
        name: match[1],
        lineNumber,
        parameters: match[2] ? this.extractParameters(match[2]).map(p => {
          // Remove quotes from string parameters
          if ((p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"'))) {
            return p.slice(1, -1)
          }
          return p
        }) : []
      })
    }

    return patterns
  }

  protected removeComments(content: string): string {
    // Remove single-line comments
    let lines = content.split('\n')
    lines = lines.map(line => {
      const commentIndex = line.indexOf('#')
      if (commentIndex !== -1) {
        // Check if # is inside a string
        const beforeComment = line.substring(0, commentIndex)
        const singleQuotes = (beforeComment.match(/'/g) || []).length
        const doubleQuotes = (beforeComment.match(/"/g) || []).length
        
        // If odd number of quotes, # is inside a string
        if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
          return line.substring(0, commentIndex).trimEnd()
        }
      }
      return line
    })

    // Remove multi-line strings used as comments (docstrings when not assigned)
    const result = lines.join('\n')
    
    // This is a simplified approach - proper Python parsing would be more accurate
    // but for import detection this should suffice
    return result.replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, (match, offset) => {
      // Keep docstrings that are part of function/class definitions
      const before = result.substring(Math.max(0, offset - 100), offset)
      if (before.match(/:\s*$/)) {
        return match // Keep docstring
      }
      return '' // Remove standalone triple-quoted strings
    })
  }

  getFilePattern(): string {
    return '**/*.py'
  }
}

// Export a singleton instance
export const pythonAnalyzer = new PythonAnalyzer()