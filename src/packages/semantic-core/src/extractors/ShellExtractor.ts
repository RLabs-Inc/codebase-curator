/**
 * Shell Script Extractor
 * Extracts semantic information from shell scripts (bash, sh, zsh)
 */

import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'

export class ShellExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.(sh|bash|zsh|fish)$/.test(filePath) ||
           filePath.endsWith('.bashrc') ||
           filePath.endsWith('.zshrc') ||
           filePath.endsWith('.profile') ||
           filePath.endsWith('.bash_profile') ||
           filePath.endsWith('.zprofile') ||
           this.hasShellShebang(filePath)
  }

  private hasShellShebang(filePath: string): boolean {
    // For files without extension, we'll check shebang in extract()
    return filePath.split('/').pop()?.indexOf('.') === -1 || false
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')

    // Check shebang for files without extension
    if (lines.length > 0 && lines[0].startsWith('#!')) {
      const shebang = lines[0]
      if (!shebang.includes('sh') && !shebang.includes('bash') && !shebang.includes('zsh')) {
        return { definitions: [], references: [] } // Not a shell script
      }
    }

    // Track current function context
    let currentFunction: string | null = null
    let inHereDoc = false
    let hereDocDelimiter = ''

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      
      // Skip empty lines
      if (!trimmedLine) return

      // Handle here documents
      if (inHereDoc) {
        if (trimmedLine === hereDocDelimiter) {
          inHereDoc = false
          hereDocDelimiter = ''
        }
        return
      }

      // Check for here document start
      const hereDocMatch = line.match(/<<\s*-?\s*(['"]?)([A-Z_]+)\1/)
      if (hereDocMatch) {
        hereDocDelimiter = hereDocMatch[2]
        inHereDoc = true
      }

      // Comments (excluding shebang)
      if (trimmedLine.startsWith('#') && !trimmedLine.startsWith('#!')) {
        const comment = trimmedLine.substring(1).trim()
        if (comment.length > 5) {
          definitions.push({
            term: comment,
            type: 'comment',
            location: { file: filePath, line: index + 1, column: 0 },
            context: trimmedLine,
            surroundingLines: [trimmedLine],
            relatedTerms: [],
            language: 'shell',
          })
        }
        return
      }

      // Function definitions
      const funcMatch = line.match(/^\s*(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)\s*{/) ||
                       line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)\s*$/)
      if (funcMatch) {
        currentFunction = funcMatch[1]
        definitions.push({
          term: currentFunction,
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: ['function', 'shell'],
          language: 'shell',
        })
      }

      // End of function
      if (currentFunction && trimmedLine === '}') {
        currentFunction = null
      }

      // Variable definitions
      const varMatch = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/) ||
                      line.match(/^\s*(?:export\s+)?([a-z_][a-zA-Z0-9_]*)\s*=\s*(.*)$/)
      if (varMatch && !varMatch[2].includes('$(') && !varMatch[2].includes('${')) {
        const [, varName, value] = varMatch
        const isExported = line.includes('export')
        const isConstant = varName === varName.toUpperCase()
        
        definitions.push({
          term: varName,
          type: isConstant ? 'constant' : 'variable',
          location: { file: filePath, line: index + 1, column: 0 },
          context: `${varName}=${this.cleanValue(value)}`,
          surroundingLines: [line.trim()],
          relatedTerms: isExported ? ['export', 'environment'] : ['variable'],
          language: 'shell',
        })

        // Extract meaningful string values
        const cleanedValue = this.cleanValue(value)
        if (cleanedValue && this.isMeaningfulString(cleanedValue)) {
          definitions.push({
            term: cleanedValue,
            type: 'string',
            location: { file: filePath, line: index + 1, column: line.indexOf('=') + 1 },
            context: `${varName}=${value}`,
            surroundingLines: [line.trim()],
            relatedTerms: [varName],
            language: 'shell',
          })
        }
      }

      // Alias definitions
      const aliasMatch = line.match(/^\s*alias\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*['"](.+)['"]/)
      if (aliasMatch) {
        const [, aliasName, command] = aliasMatch
        definitions.push({
          term: aliasName,
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: `alias ${aliasName}="${command}"`,
          surroundingLines: [line.trim()],
          relatedTerms: ['alias', 'command'],
          language: 'shell',
        })
      }

      // Source/dot commands (imports)
      const sourceMatch = line.match(/^\s*(?:source|\.\s+)["']?([^"'\s]+)["']?/)
      if (sourceMatch) {
        const sourcePath = sourceMatch[1]
        definitions.push({
          term: sourcePath,
          type: 'import',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: ['source', 'import'],
          language: 'shell',
        })

        references.push({
          targetTerm: sourcePath,
          referenceType: 'import',
          fromLocation: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
        })
      }

      // Track function calls - look for custom functions (not builtins)
      const funcCallPatterns = [
        /^\s*([a-zA-Z_][a-zA-Z0-9_-]+)\s*\(\s*\)/, // Function with parens
        /^\s*([a-zA-Z_][a-zA-Z0-9_-]+)\s*$/, // Function on its own line
        /^\s*([a-zA-Z_][a-zA-Z0-9_-]+)\s+[^=|&<>]/, // Command at start of line
      ]
      
      for (const pattern of funcCallPatterns) {
        const match = line.match(pattern)
        if (match && match[1].length > 2 && 
            !this.isShellBuiltin(match[1]) && 
            !this.isCommonCommand(match[1]) &&
            !match[1].match(/^(if|then|else|elif|fi|do|done|in|is|it|be|to|of|on|at|by|for|with|from|into|over|after|before)$/)) {
          references.push({
            targetTerm: match[1],
            referenceType: 'call',
            fromLocation: {
              file: filePath,
              line: index + 1,
              column: 0,
            },
            context: line.trim(),
          })
          break // Only one reference per line
        }
      }

      // Track command substitutions - these are important
      const cmdSubPatterns = [
        /\$\(([a-zA-Z_][a-zA-Z0-9_-]+)(?:\s|\))/g, // $(command ...)
        /`([a-zA-Z_][a-zA-Z0-9_-]+)(?:\s|`)/g, // `command ...`
      ]
      
      cmdSubPatterns.forEach(pattern => {
        const matches = [...line.matchAll(pattern)]
        matches.forEach(match => {
          const cmd = match[1]
          if (cmd.length > 3 && !this.isShellBuiltin(cmd) && !this.isCommonCommand(cmd)) {
            references.push({
              targetTerm: cmd,
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
      })

      // Track variable usage - both uppercase and lowercase meaningful variables
      const varUsagePattern = /\$\{?([A-Za-z_][A-Za-z0-9_]+)\}?/g
      const varMatches = [...line.matchAll(varUsagePattern)]
      varMatches.forEach(match => {
        const varName = match[1]
        // Track if it's meaningful (length > 3) and not a common env var
        if (varName.length > 3 && 
            !varName.match(/^(PATH|HOME|USER|SHELL|TERM|LANG|PWD|OLDPWD|SHLVL|HOSTNAME|OSTYPE|MACHTYPE|BASH_.*|ZSH_.*|PS[1-4]|IFS|OPTARG|OPTIND|REPLY|PIPESTATUS|PPID|EUID|UID|GROUPS|SHELLOPTS|BASHOPTS|HISTFILE|HISTSIZE|HISTFILESIZE|HISTCONTROL|PROMPT_COMMAND|IGNOREEOF|TMOUT|MAILCHECK|MAIL|MAILPATH|GLOBIGNORE|CDPATH|DIRSTACK|RANDOM|SECONDS|LINENO|COLUMNS|LINES|FUNCNAME|LC_.*|LESS.*|EDITOR|VISUAL|PAGER|MANPATH|INFOPATH|XDG_.*|\d+)$/)) {
          references.push({
            targetTerm: varName,
            referenceType: 'usage',
            fromLocation: {
              file: filePath,
              line: index + 1,
              column: match.index || 0,
            },
            context: line.trim(),
          })
        }
      })

      // Case statements
      const caseMatch = line.match(/^\s*case\s+(.+)\s+in\s*$/)
      if (caseMatch) {
        definitions.push({
          term: `case ${caseMatch[1]}`,
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: ['case', 'pattern', 'matching'],
          language: 'shell',
        })
      }

      // Loop constructs
      const loopMatch = line.match(/^\s*(for|while|until)\s+(.+)/)
      if (loopMatch) {
        const [, loopType, condition] = loopMatch
        definitions.push({
          term: `${loopType} loop`,
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: this.getSurroundingLines(index, lines),
          relatedTerms: [loopType, 'loop', 'iteration'],
          language: 'shell',
        })
      }

      // Getopts pattern (command-line argument parsing)
      const getoptsMatch = line.match(/^\s*while\s+getopts\s+["']([^"']+)["']/)
      if (getoptsMatch) {
        definitions.push({
          term: `Options: ${getoptsMatch[1]}`,
          type: 'constant',
          location: { file: filePath, line: index + 1, column: 0 },
          context: 'Command-line options',
          surroundingLines: [line.trim()],
          relatedTerms: ['getopts', 'options', 'arguments'],
          language: 'shell',
        })
      }

      // Trap commands (signal handling)
      const trapMatch = line.match(/^\s*trap\s+['"]([^'"]+)['"]\s+(.+)/)
      if (trapMatch) {
        const [, handler, signals] = trapMatch
        definitions.push({
          term: `trap ${signals}`,
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: `Signal handler: ${handler}`,
          surroundingLines: [line.trim()],
          relatedTerms: ['trap', 'signal', 'handler'],
          language: 'shell',
        })
      }

      // String literals
      const stringMatches = [
        ...line.matchAll(/"([^"]{4,})"/g),
        ...line.matchAll(/'([^']{4,})'/g),
      ]
      
      stringMatches.forEach(match => {
        const value = match[1]
        if (this.isMeaningfulString(value) && !value.includes('$')) {
          definitions.push({
            term: value,
            type: 'string',
            location: { file: filePath, line: index + 1, column: match.index || 0 },
            context: line.trim(),
            surroundingLines: [line.trim()],
            relatedTerms: [],
            language: 'shell',
          })
        }
      })
    })

    return { definitions, references }
  }

  private cleanValue(value: string): string {
    // Remove quotes and clean up shell values
    return value
      .replace(/^["']|["']$/g, '')
      .replace(/\$\{[^}]+\}/g, '') // Remove variable substitutions
      .replace(/\$\([^)]+\)/g, '') // Remove command substitutions
      .trim()
  }

  private getSurroundingLines(lineIndex: number, lines: string[]): string[] {
    const start = Math.max(0, lineIndex - 2)
    const end = Math.min(lines.length, lineIndex + 3)
    return lines.slice(start, end).map(l => l.trim())
  }

  private isShellBuiltin(command: string): boolean {
    const builtins = new Set([
      'cd', 'pwd', 'echo', 'printf', 'read', 'exit', 'return',
      'break', 'continue', 'exec', 'eval', 'set', 'unset',
      'export', 'local', 'declare', 'typeset', 'readonly',
      'shift', 'getopts', 'trap', 'wait', 'jobs', 'fg', 'bg',
      'kill', 'test', '[', '[[', 'true', 'false', 'type',
      'hash', 'help', 'history', 'source', '.', 'alias', 'unalias',
      'if', 'then', 'else', 'elif', 'fi', 'case', 'esac',
      'for', 'while', 'until', 'do', 'done', 'function',
      'time', 'times', 'ulimit', 'umask', 'let', 'pushd', 'popd'
    ])
    return builtins.has(command)
  }

  private isCommonCommand(command: string): boolean {
    const common = new Set([
      // File operations
      'ls', 'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'touch', 'file', 'stat',
      'cat', 'less', 'more', 'head', 'tail', 'tac', 'nl', 'od', 'base64',
      // Text processing
      'grep', 'sed', 'awk', 'find', 'sort', 'uniq', 'cut', 'paste', 'tr',
      'tee', 'wc', 'split', 'csplit', 'join', 'comm', 'diff', 'patch',
      // System commands
      'chmod', 'chown', 'chgrp', 'ln', 'df', 'du', 'ps', 'top', 'htop',
      'kill', 'pkill', 'killall', 'pgrep', 'jobs', 'fg', 'bg', 'nohup',
      // Network
      'ssh', 'scp', 'rsync', 'curl', 'wget', 'ping', 'nc', 'netcat',
      'telnet', 'ftp', 'sftp', 'netstat', 'ss', 'ip', 'ifconfig',
      // Package managers
      'apt', 'apt-get', 'yum', 'dnf', 'pacman', 'zypper', 'brew', 'npm',
      'yarn', 'pip', 'gem', 'cargo', 'go', 'composer', 'bundler',
      // Development tools
      'git', 'make', 'gcc', 'g++', 'clang', 'python', 'python3', 'node',
      'java', 'javac', 'ruby', 'perl', 'php', 'rustc', 'go', 'swift',
      // Archive tools
      'tar', 'gzip', 'gunzip', 'zip', 'unzip', 'bzip2', 'bunzip2', 'xz',
      // Other common tools
      'which', 'whereis', 'man', 'info', 'date', 'cal', 'bc', 'expr',
      'sleep', 'wait', 'time', 'timeout', 'watch', 'cron', 'crontab',
      'systemctl', 'service', 'journalctl', 'dmesg', 'lsof', 'strace',
      'env', 'printenv', 'export', 'source', 'alias', 'history',
      'clear', 'reset', 'exit', 'logout', 'reboot', 'shutdown', 'su',
      'sudo', 'passwd', 'useradd', 'userdel', 'groupadd', 'groups',
      'id', 'who', 'whoami', 'last', 'lastlog', 'w', 'finger',
      'xargs', 'parallel', 'nproc', 'nice', 'renice', 'nohup', 'disown',
      'umask', 'ulimit', 'mount', 'umount', 'fsck', 'mkfs', 'fdisk',
      'dd', 'sync', 'md5sum', 'sha1sum', 'sha256sum', 'sha512sum',
      'base64', 'uname', 'hostname', 'hostnamectl', 'timedatectl',
      'locale', 'localectl', 'update-alternatives', 'ldconfig',
      // Bun/Node specific
      'bun', 'bunx', 'npx', 'pnpm', 'pnpx'
    ])
    return common.has(command)
  }

  private isMeaningfulString(value: string): boolean {
    if (value.length < 3) return false
    if (/^-+$/.test(value)) return false // Just dashes
    if (/^\d+$/.test(value)) return false // Just numbers
    if (/^[A-Z_]+$/.test(value) && value.length < 10) return false // Short constants
    
    return true
  }
}