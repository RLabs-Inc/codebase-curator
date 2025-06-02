/**
 * Environment File Extractor
 * Extracts configuration from .env files and similar formats
 */

import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class EnvExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || ''
    return /^\.env/.test(fileName) ||
           fileName === '.env' ||
           fileName.endsWith('.env') ||
           fileName.endsWith('.env.example') ||
           fileName.endsWith('.env.local') ||
           fileName.endsWith('.env.development') ||
           fileName.endsWith('.env.production') ||
           fileName.endsWith('.env.test') ||
           fileName.endsWith('.env.staging')
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    // Track sections for context
    let currentSection = ''

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      
      // Skip empty lines
      if (!trimmedLine) return

      // Comments can provide section context
      if (trimmedLine.startsWith('#')) {
        const comment = trimmedLine.substring(1).trim()
        if (comment.length > 2) {
          // Check if it's a section header (all caps or specific patterns)
          if (/^[A-Z\s]+$/.test(comment) || comment.includes('CONFIG') || comment.includes('SETTINGS')) {
            currentSection = comment
          }
          
          definitions.push({
            term: comment,
            type: 'comment',
            location: { file: filePath, line: index + 1, column: 0 },
            context: trimmedLine,
            surroundingLines: [trimmedLine],
            relatedTerms: currentSection ? [currentSection.toLowerCase()] : [],
            language: 'env',
          })
        }
        return
      }

      // Environment variable definitions
      const envMatch = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
      if (envMatch) {
        const [, key, value] = envMatch
        
        // Clean the value (remove quotes, handle empty)
        const cleanedValue = this.cleanEnvValue(value)
        
        // Categorize the variable
        const category = this.categorizeEnvVar(key, cleanedValue)
        const relatedTerms = [category, ...this.extractRelatedTerms(key, cleanedValue)]
        if (currentSection) relatedTerms.push(currentSection.toLowerCase())

        definitions.push({
          term: key,
          type: 'constant',
          location: { file: filePath, line: index + 1, column: 0 },
          context: `${key}=${this.maskSensitiveValue(key, cleanedValue)}`,
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms,
          language: 'env',
        })

        // Extract meaningful values (non-sensitive)
        if (cleanedValue && !this.isSensitiveKey(key) && this.isMeaningfulValue(cleanedValue)) {
          definitions.push({
            term: cleanedValue,
            type: 'string',
            location: { file: filePath, line: index + 1, column: line.indexOf('=') + 1 },
            context: `${key}=${cleanedValue}`,
            surroundingLines: [line.trim()],
            relatedTerms: [key, category],
            language: 'env',
          })
        }

        // Create references for known patterns
        this.extractReferences(key, cleanedValue, filePath, index + 1, references)
      }
    })

    return { definitions, references }
  }

  private cleanEnvValue(value: string): string {
    // Handle empty values
    if (!value) return ''
    
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    
    // Handle special cases
    if (value === 'true' || value === 'false') return value
    if (value === 'null' || value === 'undefined') return ''
    
    return value.trim()
  }

  private categorizeEnvVar(key: string, value: string): string {
    // Database
    if (/^(DB|DATABASE|POSTGRES|MYSQL|MONGO|REDIS)_/.test(key) ||
        key.includes('_DB_') || key === 'DATABASE_URL') {
      return 'database'
    }
    
    // API/URLs
    if (/^(API|ENDPOINT|URL|URI|HOST)_/.test(key) ||
        key.includes('_URL') || key.includes('_API') ||
        value.includes('http://') || value.includes('https://')) {
      return 'api'
    }
    
    // Authentication
    if (/^(AUTH|TOKEN|KEY|SECRET|PASSWORD|JWT|OAUTH)_/.test(key) ||
        key.includes('_KEY') || key.includes('_SECRET') ||
        key.includes('_TOKEN') || key.includes('_PASSWORD')) {
      return 'auth'
    }
    
    // AWS
    if (/^AWS_/.test(key) || key.includes('_AWS_')) {
      return 'aws'
    }
    
    // Email/SMTP
    if (/^(MAIL|SMTP|EMAIL)_/.test(key) || key.includes('_MAIL_')) {
      return 'email'
    }
    
    // Port/Network
    if (key.includes('PORT') || key.includes('HOST')) {
      return 'network'
    }
    
    // Feature flags
    if (/^(ENABLE|DISABLE|USE|FEATURE|FLAG)_/.test(key) ||
        key.includes('_ENABLED') || key.includes('_DISABLED')) {
      return 'feature'
    }
    
    // Logging/Debug
    if (/^(LOG|DEBUG|VERBOSE)_/.test(key) ||
        key.includes('_LOG') || key === 'NODE_ENV') {
      return 'logging'
    }
    
    // File paths
    if (key.includes('PATH') || key.includes('DIR') || value.includes('/')) {
      return 'path'
    }
    
    return 'config'
  }

  private extractRelatedTerms(key: string, value: string): string[] {
    const terms: string[] = []
    
    // Environment-specific
    if (key === 'NODE_ENV') terms.push('environment', 'node')
    if (key === 'PORT') terms.push('server', 'port')
    
    // Technology-specific
    if (key.includes('REACT_APP')) terms.push('react', 'frontend')
    if (key.includes('NEXT_PUBLIC')) terms.push('nextjs', 'frontend')
    if (key.includes('VITE_')) terms.push('vite', 'frontend')
    if (key.includes('VUE_APP')) terms.push('vue', 'frontend')
    
    // Service-specific
    if (key.includes('STRIPE')) terms.push('stripe', 'payment')
    if (key.includes('SENDGRID')) terms.push('sendgrid', 'email')
    if (key.includes('TWILIO')) terms.push('twilio', 'sms')
    if (key.includes('SENTRY')) terms.push('sentry', 'monitoring')
    
    // Value-based terms
    if (value === 'true' || value === 'false') terms.push('boolean', 'flag')
    if (/^\d+$/.test(value)) terms.push('number')
    if (value.includes('localhost')) terms.push('local', 'development')
    
    return terms
  }

  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /KEY/i,
      /SECRET/i,
      /PASSWORD/i,
      /TOKEN/i,
      /PRIVATE/i,
      /CREDENTIAL/i,
      /AUTH/i,
      /SIGN/i,
    ]
    
    return sensitivePatterns.some(pattern => pattern.test(key))
  }

  private maskSensitiveValue(key: string, value: string): string {
    if (this.isSensitiveKey(key) && value) {
      // Show first few characters for context
      if (value.length > 8) {
        return value.substring(0, 4) + '****'
      }
      return '****'
    }
    return value
  }

  private isMeaningfulValue(value: string): boolean {
    if (!value || value.length < 2) return false
    if (value === 'true' || value === 'false') return false
    if (/^\d+$/.test(value) && value.length < 5) return false // Short numbers
    if (/^[A-Z_]+$/.test(value) && value.length < 10) return false // Short constants
    
    // Include URLs, paths, and longer strings
    return value.includes('/') || 
           value.includes('.') || 
           value.includes(':') ||
           value.length > 10
  }

  private extractReferences(
    key: string,
    value: string,
    filePath: string,
    line: number,
    references: CrossReference[]
  ): void {
    // Reference to ports (for network config)
    if (key.includes('PORT') && /^\d+$/.test(value)) {
      references.push({
        targetTerm: `port:${value}`,
        referenceType: 'config',
        fromLocation: { file: filePath, line, column: 0 },
        context: `${key}=${value}`,
      })
    }
    
    // Reference to other env vars
    const envVarMatch = value.match(/\$\{?([A-Z_][A-Z0-9_]*)\}?/)
    if (envVarMatch) {
      references.push({
        targetTerm: envVarMatch[1],
        referenceType: 'variable',
        fromLocation: { file: filePath, line, column: 0 },
        context: `${key}=${value}`,
      })
    }
    
    // Reference to service endpoints
    if (value.includes('http://') || value.includes('https://')) {
      try {
        const url = new URL(value)
        references.push({
          targetTerm: url.hostname,
          referenceType: 'endpoint',
          fromLocation: { file: filePath, line, column: 0 },
          context: `${key}=${value}`,
        })
      } catch {
        // Invalid URL, skip
      }
    }
  }

  private getSurroundingLines(index: number, lines: string[]): string[] {
    const start = Math.max(0, index - 2)
    const end = Math.min(lines.length, index + 3)
    return lines.slice(start, end)
      .map(l => {
        const line = l.trim()
        // Mask sensitive values in surrounding context too
        const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
        if (match && this.isSensitiveKey(match[1])) {
          return `${match[1]}=${this.maskSensitiveValue(match[1], match[2])}`
        }
        return line
      })
  }
}