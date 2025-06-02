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
      '~/.bash_completion.d/monitor',
      '/usr/local/etc/bash_completion.d/monitor',
      '/etc/bash_completion.d/monitor'
    ],
    sourceFile: path.join(__dirname, '../completions/bash/monitor')
  },
  zsh: {
    paths: [
      '~/.config/zsh/completions/_monitor',
      '/usr/local/share/zsh/site-functions/_monitor',
      '/usr/share/zsh/site-functions/_monitor'
    ],
    sourceFile: path.join(__dirname, '../completions/zsh/_monitor')
  },
  fish: {
    paths: [
      '~/.config/fish/completions/monitor.fish'
    ],
    sourceFile: path.join(__dirname, '../completions/fish/monitor.fish')
  }
}

async function expandTilde(filePath) {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return filePath
}

async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

async function installCompletion(shell, config) {
  const sourceFile = config.sourceFile
  
  try {
    const sourceContent = await fs.readFile(sourceFile, 'utf8')
    
    for (const targetPath of config.paths) {
      const expandedPath = await expandTilde(targetPath)
      const targetDir = path.dirname(expandedPath)
      
      try {
        await ensureDirectory(targetDir)
        await fs.writeFile(expandedPath, sourceContent)
        console.log(`✅ Installed ${shell} completion to: ${expandedPath}`)
        
        // Show shell-specific instructions
        if (shell === 'bash') {
          console.log(`   Add to ~/.bashrc: source ${expandedPath}`)
        } else if (shell === 'zsh') {
          console.log(`   Ensure your fpath includes: ${targetDir}`)
        }
        
        return true
      } catch (error) {
        // Try next path
        continue
      }
    }
    
    console.log(`⚠️  Could not install ${shell} completion. Manual installation required.`)
    console.log(`   Copy from: ${sourceFile}`)
    console.log(`   To one of: ${config.paths.join(', ')}`)
    
  } catch (error) {
    console.error(`❌ Error installing ${shell} completion:`, error.message)
  }
  
  return false
}

async function detectShell() {
  const shell = process.env.SHELL || ''
  
  if (shell.includes('bash')) return 'bash'
  if (shell.includes('zsh')) return 'zsh'
  if (shell.includes('fish')) return 'fish'
  
  return null
}

async function installManPage() {
  const manSource = path.join(__dirname, '../man/monitor.1')
  const manPaths = [
    '~/.local/share/man/man1/monitor.1',
    '/usr/local/share/man/man1/monitor.1',
    '/usr/share/man/man1/monitor.1'
  ]
  
  try {
    const manContent = await fs.readFile(manSource, 'utf8')
    
    for (const manPath of manPaths) {
      const expandedPath = await expandTilde(manPath)
      const manDir = path.dirname(expandedPath)
      
      try {
        await ensureDirectory(manDir)
        await fs.writeFile(expandedPath, manContent)
        console.log(`✅ Installed man page to: ${expandedPath}`)
        console.log(`   View with: man monitor`)
        return true
      } catch (error) {
        continue
      }
    }
    
    console.log(`⚠️  Could not install man page. Manual installation required.`)
    console.log(`   Copy ${manSource} to one of: ${manPaths.join(', ')}`)
    
  } catch (error) {
    console.error('❌ Error installing man page:', error.message)
  }
  
  return false
}

async function main() {
  console.log('\n🔧 Installing monitor shell completions...\n')
  
  const detectedShell = await detectShell()
  
  if (detectedShell && SHELL_CONFIGS[detectedShell]) {
    console.log(`🐚 Detected shell: ${detectedShell}`)
    await installCompletion(detectedShell, SHELL_CONFIGS[detectedShell])
  } else {
    console.log('🤔 Could not detect shell. Attempting to install all completions...')
    
    for (const [shell, config] of Object.entries(SHELL_CONFIGS)) {
      await installCompletion(shell, config)
    }
  }
  
  console.log('\n📖 Installing man page...\n')
  await installManPage()
  
  console.log('\n✨ Installation complete!')
  console.log('\n💡 Note: You may need to restart your shell or source your config file.')
  console.log('   For immediate use:')
  console.log('   - Bash: source ~/.bashrc')
  console.log('   - Zsh: source ~/.zshrc')
  console.log('   - Fish: Run `fish_update_completions`')
}

main().catch(console.error)