#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SHELL_CONFIGS = {
  bash: {
    paths: [
      '~/.bash_completion.d/curator',
      '/usr/local/etc/bash_completion.d/curator',
      '/etc/bash_completion.d/curator'
    ],
    sourceFile: path.join(__dirname, '../completions/bash/curator')
  },
  zsh: {
    paths: [
      '~/.config/zsh/completions/_curator',
      '/usr/local/share/zsh/site-functions/_curator',
      '/usr/share/zsh/site-functions/_curator'
    ],
    sourceFile: path.join(__dirname, '../completions/zsh/_curator')
  },
  fish: {
    paths: [
      '~/.config/fish/completions/curator.fish',
      '/usr/local/share/fish/completions/curator.fish',
      '/usr/share/fish/completions/curator.fish'
    ],
    sourceFile: path.join(__dirname, '../completions/fish/curator.fish')
  }
}

async function expandHome(filepath) {
  if (filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1))
  }
  return filepath
}

async function installCompletions() {
  console.log('Installing shell completions for curator...')
  
  for (const [shell, config] of Object.entries(SHELL_CONFIGS)) {
    try {
      const sourceFile = config.sourceFile
      const sourceExists = await fs.access(sourceFile).then(() => true).catch(() => false)
      
      if (!sourceExists) {
        console.log(`⚠️  ${shell} completions not found at ${sourceFile}`)
        continue
      }
      
      let installed = false
      for (const targetPath of config.paths) {
        try {
          const expandedPath = await expandHome(targetPath)
          const targetDir = path.dirname(expandedPath)
          
          // Create directory if it doesn't exist
          await fs.mkdir(targetDir, { recursive: true })
          
          // Copy completion file
          await fs.copyFile(sourceFile, expandedPath)
          console.log(`✅ Installed ${shell} completions to ${expandedPath}`)
          installed = true
          break
        } catch (err) {
          // Try next path
          continue
        }
      }
      
      if (!installed) {
        console.log(`⚠️  Could not install ${shell} completions (no writable path found)`)
      }
    } catch (err) {
      console.log(`❌ Error installing ${shell} completions:`, err.message)
    }
  }
  
  console.log('\nTo enable completions:')
  console.log('  Bash: Add to ~/.bashrc: source ~/.bash_completion.d/curator')
  console.log('  Zsh:  Add to ~/.zshrc: autoload -U compinit && compinit')
  console.log('  Fish: Completions should work automatically')
}

// Run installation
installCompletions().catch(err => {
  console.error('Installation failed:', err)
  process.exit(1)
})