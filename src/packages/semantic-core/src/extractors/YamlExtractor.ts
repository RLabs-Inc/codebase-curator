/**
 * YAML Configuration Extractor
 * Extracts semantic information from YAML files
 */

import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class YamlExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.(yaml|yml)$/.test(filePath) ||
           filePath.includes('.gitlab-ci') ||
           filePath.includes('.github/workflows') ||
           filePath.endsWith('docker-compose.yml') ||
           filePath.endsWith('docker-compose.yaml')
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    // Detect special YAML files
    const fileName = filePath.split('/').pop() || ''
    const isGitLabCI = filePath.includes('.gitlab-ci')
    const isGitHubActions = filePath.includes('.github/workflows')
    const isDockerCompose = fileName.includes('docker-compose')
    const isKubernetes = this.detectKubernetes(content)

    // Track context
    let currentIndent = 0
    let contextStack: string[] = []
    let inMultilineString = false
    let multilineBuffer: string[] = []

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        // Extract comments as documentation
        if (trimmedLine.startsWith('#') && trimmedLine.length > 2) {
          definitions.push({
            term: trimmedLine.substring(1).trim(),
            type: 'comment',
            location: { file: filePath, line: index + 1, column: 0 },
            context: trimmedLine,
            surroundingLines: [trimmedLine],
            relatedTerms: [],
            language: 'yaml',
          })
        }
        return
      }

      // Handle multiline strings
      if (inMultilineString) {
        if (!line.startsWith(' '.repeat(currentIndent + 2)) && trimmedLine) {
          // End of multiline
          const fullString = multilineBuffer.join('\n')
          if (this.isMeaningfulString(fullString)) {
            definitions.push({
              term: fullString,
              type: 'string',
              location: { file: filePath, line: index - multilineBuffer.length, column: currentIndent },
              context: 'Multiline string',
              surroundingLines: multilineBuffer.slice(0, 3),
              relatedTerms: contextStack,
              language: 'yaml',
            })
          }
          inMultilineString = false
          multilineBuffer = []
        } else {
          multilineBuffer.push(trimmedLine)
          return
        }
      }

      // Calculate indentation
      const indent = line.length - line.trimStart().length
      
      // Update context stack based on indentation
      if (indent < currentIndent) {
        const levelsToPop = Math.floor((currentIndent - indent) / 2)
        for (let i = 0; i < levelsToPop; i++) {
          contextStack.pop()
        }
      }
      currentIndent = indent

      // Parse key-value pairs
      const keyValueMatch = line.match(/^(\s*)([a-zA-Z0-9_\-\.]+):\s*(.*)$/)
      if (keyValueMatch) {
        const [, indentStr, key, value] = keyValueMatch
        const fullPath = [...contextStack, key].join('.')

        // Update context
        if (indent > currentIndent || (!value && lines[index + 1]?.startsWith(' '.repeat(indent + 2)))) {
          contextStack.push(key)
        }

        // Handle special keys based on file type
        if (isGitLabCI) {
          this.extractGitLabCI(key, value, fullPath, filePath, index + 1, definitions, references)
        } else if (isGitHubActions) {
          this.extractGitHubActions(key, value, fullPath, filePath, index + 1, definitions, references)
        } else if (isDockerCompose) {
          this.extractDockerCompose(key, value, fullPath, filePath, index + 1, definitions, references)
        } else if (isKubernetes) {
          this.extractKubernetes(key, value, fullPath, filePath, index + 1, definitions, references)
        }

        // Generic extraction
        if (this.isImportantKey(key, fullPath)) {
          definitions.push({
            term: fullPath,
            type: 'constant',
            location: { file: filePath, line: index + 1, column: indent },
            context: `${key}: ${value || '{...}'}`,
            surroundingLines: this.getSurroundingLines(index, lines),
            relatedTerms: this.extractYamlTerms(key, value),
            language: 'yaml',
          })
        }

        // Extract string values
        if (value && !value.startsWith('|') && !value.startsWith('>')) {
          const cleanValue = this.cleanYamlString(value)
          if (cleanValue && this.isMeaningfulString(cleanValue)) {
            definitions.push({
              term: cleanValue,
              type: 'string',
              location: { file: filePath, line: index + 1, column: indent + key.length + 2 },
              context: `${key}: ${value}`,
              surroundingLines: [line.trim()],
              relatedTerms: [key, ...contextStack],
              language: 'yaml',
            })
          }
        }

        // Handle multiline indicators
        if (value === '|' || value === '>') {
          inMultilineString = true
          multilineBuffer = []
        }
      }

      // Handle array items
      const arrayMatch = line.match(/^(\s*)-\s+(.+)$/)
      if (arrayMatch) {
        const [, indentStr, value] = arrayMatch
        const cleanValue = this.cleanYamlString(value)
        
        if (cleanValue && this.isMeaningfulString(cleanValue)) {
          definitions.push({
            term: cleanValue,
            type: 'string',
            location: { file: filePath, line: index + 1, column: indent },
            context: `- ${value}`,
            surroundingLines: [line.trim()],
            relatedTerms: contextStack,
            language: 'yaml',
          })
        }

        // Special handling for certain contexts
        if (isGitLabCI && contextStack.includes('script')) {
          definitions.push({
            term: cleanValue,
            type: 'function',
            location: { file: filePath, line: index + 1, column: indent },
            context: `Script command: ${cleanValue}`,
            surroundingLines: [line.trim()],
            relatedTerms: ['script', 'command', ...contextStack],
            language: 'yaml',
          })
        }
      }
    })

    return { definitions, references }
  }

  private detectKubernetes(content: string): boolean {
    return content.includes('apiVersion:') && 
           (content.includes('kind:') || content.includes('metadata:'))
  }

  private extractGitLabCI(
    key: string,
    value: string,
    path: string,
    filePath: string,
    line: number,
    definitions: SemanticInfo[],
    references: CrossReference[]
  ): void {
    // Job definitions
    if (!path.includes('.') && !key.startsWith('.') && key !== 'variables' && key !== 'stages') {
      definitions.push({
        term: key,
        type: 'function',
        location: { file: filePath, line, column: 0 },
        context: `GitLab CI Job: ${key}`,
        surroundingLines: [`${key}:`],
        relatedTerms: ['job', 'ci', 'gitlab'],
        language: 'yaml',
      })
    }

    // Stage references
    if (key === 'stage' && value) {
      references.push({
        targetTerm: value,
        referenceType: 'call',
        fromLocation: { file: filePath, line, column: 0 },
        context: `stage: ${value}`,
      })
    }

    // Image references
    if (key === 'image' && value) {
      definitions.push({
        term: value,
        type: 'import',
        location: { file: filePath, line, column: 0 },
        context: `Docker image: ${value}`,
        surroundingLines: [`image: ${value}`],
        relatedTerms: ['docker', 'image', 'container'],
        language: 'yaml',
      })
    }
  }

  private extractGitHubActions(
    key: string,
    value: string,
    path: string,
    filePath: string,
    line: number,
    definitions: SemanticInfo[],
    references: CrossReference[]
  ): void {
    // Workflow name
    if (key === 'name' && !path.includes('.')) {
      definitions.push({
        term: value,
        type: 'module',
        location: { file: filePath, line, column: 0 },
        context: `GitHub Actions Workflow: ${value}`,
        surroundingLines: [`name: ${value}`],
        relatedTerms: ['workflow', 'github', 'actions'],
        language: 'yaml',
      })
    }

    // Job definitions
    if (path === 'jobs' && !value) {
      definitions.push({
        term: key,
        type: 'function',
        location: { file: filePath, line, column: 0 },
        context: `GitHub Actions Job: ${key}`,
        surroundingLines: [`${key}:`],
        relatedTerms: ['job', 'github', 'actions'],
        language: 'yaml',
      })
    }

    // Action uses
    if (key === 'uses' && value) {
      definitions.push({
        term: value,
        type: 'import',
        location: { file: filePath, line, column: 0 },
        context: `GitHub Action: ${value}`,
        surroundingLines: [`uses: ${value}`],
        relatedTerms: ['action', 'github', 'uses'],
        language: 'yaml',
      })

      references.push({
        targetTerm: value.split('@')[0],
        referenceType: 'import',
        fromLocation: { file: filePath, line, column: 0 },
        context: `uses: ${value}`,
      })
    }
  }

  private extractDockerCompose(
    key: string,
    value: string,
    path: string,
    filePath: string,
    line: number,
    definitions: SemanticInfo[],
    references: CrossReference[]
  ): void {
    // Service definitions
    if (path === 'services' && !value) {
      definitions.push({
        term: key,
        type: 'class',
        location: { file: filePath, line, column: 0 },
        context: `Docker Service: ${key}`,
        surroundingLines: [`${key}:`],
        relatedTerms: ['service', 'docker', 'container'],
        language: 'yaml',
      })
    }

    // Image references
    if (key === 'image' && value) {
      definitions.push({
        term: value,
        type: 'import',
        location: { file: filePath, line, column: 0 },
        context: `Docker image: ${value}`,
        surroundingLines: [`image: ${value}`],
        relatedTerms: ['docker', 'image'],
        language: 'yaml',
      })
    }

    // Port mappings
    if (path.includes('ports') && value && value.includes(':')) {
      definitions.push({
        term: value,
        type: 'constant',
        location: { file: filePath, line, column: 0 },
        context: `Port mapping: ${value}`,
        surroundingLines: [`- ${value}`],
        relatedTerms: ['port', 'network', 'docker'],
        language: 'yaml',
      })
    }
  }

  private extractKubernetes(
    key: string,
    value: string,
    path: string,
    filePath: string,
    line: number,
    definitions: SemanticInfo[],
    references: CrossReference[]
  ): void {
    // Resource kind
    if (key === 'kind' && value) {
      definitions.push({
        term: value,
        type: 'class',
        location: { file: filePath, line, column: 0 },
        context: `Kubernetes ${value}`,
        surroundingLines: [`kind: ${value}`],
        relatedTerms: ['kubernetes', 'k8s', value.toLowerCase()],
        language: 'yaml',
      })
    }

    // Resource name
    if (path === 'metadata.name' && value) {
      definitions.push({
        term: value,
        type: 'variable',
        location: { file: filePath, line, column: 0 },
        context: `Resource name: ${value}`,
        surroundingLines: [`name: ${value}`],
        relatedTerms: ['name', 'metadata', 'kubernetes'],
        language: 'yaml',
      })
    }

    // Container images
    if (key === 'image' && value && path.includes('containers')) {
      definitions.push({
        term: value,
        type: 'import',
        location: { file: filePath, line, column: 0 },
        context: `Container image: ${value}`,
        surroundingLines: [`image: ${value}`],
        relatedTerms: ['container', 'image', 'kubernetes'],
        language: 'yaml',
      })
    }
  }

  private isImportantKey(key: string, path: string): boolean {
    const importantKeys = [
      'name', 'version', 'description',
      'host', 'port', 'url', 'endpoint',
      'username', 'database', 'schema',
      'timeout', 'interval', 'retry',
      'enabled', 'disabled', 'debug',
      'environment', 'env', 'config'
    ]

    const importantPaths = [
      /^(server|client|api|database)/i,
      /^(auth|security|cors)/i,
      /^(redis|cache|queue)/i,
      /^(logging|monitoring)/i,
    ]

    return importantKeys.includes(key.toLowerCase()) ||
           importantPaths.some(pattern => pattern.test(path))
  }

  private cleanYamlString(value: string): string {
    // Remove quotes and clean up
    return value
      .replace(/^["']|["']$/g, '')
      .replace(/\$\{[^}]+\}/g, '') // Remove variable substitutions
      .trim()
  }

  private extractYamlTerms(key: string, value: string): string[] {
    const terms = [key]
    
    if (value) {
      if (value.includes('http')) terms.push('url', 'endpoint')
      if (value.includes(':') && /\d/.test(value)) terms.push('port')
      if (key.toLowerCase().includes('image')) terms.push('docker', 'container')
      if (key.toLowerCase().includes('script')) terms.push('command', 'shell')
    }
    
    return terms
  }

  private getSurroundingLines(index: number, lines: string[]): string[] {
    const start = Math.max(0, index - 1)
    const end = Math.min(lines.length, index + 2)
    return lines.slice(start, end).map(l => l.trim())
  }

  private isMeaningfulString(value: string): boolean {
    if (value.length < 3) return false
    if (/^(true|false|null|yes|no|on|off)$/i.test(value)) return false
    if (/^\d+$/.test(value)) return false
    if (/^[A-Z_]+$/.test(value) && value.length < 10) return false
    
    return true
  }
}