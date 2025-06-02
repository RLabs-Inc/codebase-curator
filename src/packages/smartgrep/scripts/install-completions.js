#!/usr/bin/env bun
/**
 * Post-install script to set up shell completions and man page
 * Runs automatically when package is installed globally
 */

import { existsSync, mkdirSync, copyFileSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

const PACKAGE_ROOT = join(import.meta.dir, '..');
const HOME = homedir();

// Detect user's shell
function detectShell() {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('fish')) return 'fish';
  if (shell.includes('bash')) return 'bash';
  return 'bash'; // default
}

// Install completions based on shell
function installCompletions() {
  const shell = detectShell();
  console.log(`🔍 Detected shell: ${shell}`);
  
  try {
    switch (shell) {
      case 'bash':
        installBashCompletion();
        break;
      case 'zsh':
        installZshCompletion();
        break;
      case 'fish':
        installFishCompletion();
        break;
    }
    
    // Always try to install man page
    installManPage();
    
    console.log('✨ SmartGrep installation complete!');
    console.log('   Restart your shell or run: source ~/.bashrc (or ~/.zshrc)');
    console.log('   Try: smartgrep --help');
  } catch (error) {
    console.error('⚠️  Could not install completions automatically');
    console.error('   See manual installation: https://github.com/RLabs-Inc/codebase-curator/tree/main/src/packages/smartgrep#installation');
  }
}

function installBashCompletion() {
  const completionDir = join(HOME, '.bash_completion.d');
  if (!existsSync(completionDir)) {
    mkdirSync(completionDir, { recursive: true });
  }
  
  const source = join(PACKAGE_ROOT, 'completions/bash/smartgrep');
  const dest = join(completionDir, 'smartgrep');
  
  copyFileSync(source, dest);
  console.log('✅ Installed Bash completion');
  
  // Add to .bashrc if not already there
  const bashrc = join(HOME, '.bashrc');
  if (existsSync(bashrc)) {
    const content = Bun.file(bashrc).text();
    if (!content.includes('bash_completion.d/smartgrep')) {
      Bun.write(bashrc, content + '\n# SmartGrep completion\nsource ~/.bash_completion.d/smartgrep\n');
    }
  }
}

function installZshCompletion() {
  const completionDir = join(HOME, '.zsh/completions');
  if (!existsSync(completionDir)) {
    mkdirSync(completionDir, { recursive: true });
  }
  
  const source = join(PACKAGE_ROOT, 'completions/zsh/_smartgrep');
  const dest = join(completionDir, '_smartgrep');
  
  copyFileSync(source, dest);
  console.log('✅ Installed Zsh completion');
  
  // Add to .zshrc if not already there
  const zshrc = join(HOME, '.zshrc');
  if (existsSync(zshrc)) {
    const content = Bun.file(zshrc).text();
    if (!content.includes('/.zsh/completions')) {
      Bun.write(zshrc, `# SmartGrep completion\nfpath=(~/.zsh/completions $fpath)\nautoload -U compinit && compinit\n` + content);
    }
  }
}

function installFishCompletion() {
  const completionDir = join(HOME, '.config/fish/completions');
  if (!existsSync(completionDir)) {
    mkdirSync(completionDir, { recursive: true });
  }
  
  const source = join(PACKAGE_ROOT, 'completions/fish/smartgrep.fish');
  const dest = join(completionDir, 'smartgrep.fish');
  
  copyFileSync(source, dest);
  console.log('✅ Installed Fish completion');
}

function installManPage() {
  const manDir = join(HOME, 'man/man1');
  if (!existsSync(manDir)) {
    mkdirSync(manDir, { recursive: true });
  }
  
  const source = join(PACKAGE_ROOT, 'man/smartgrep.1');
  const dest = join(manDir, 'smartgrep.1');
  
  copyFileSync(source, dest);
  console.log('✅ Installed man page');
  
  // Add to MANPATH if not already there
  const shell = detectShell();
  const rcFile = shell === 'zsh' ? '.zshrc' : '.bashrc';
  const rcPath = join(HOME, rcFile);
  
  if (existsSync(rcPath)) {
    const content = Bun.file(rcPath).text();
    if (!content.includes('MANPATH="$HOME/man:')) {
      Bun.write(rcPath, content + '\n# SmartGrep man page\nexport MANPATH="$HOME/man:$MANPATH"\n');
    }
  }
}

// Only run if this is a global install
if (process.env.npm_config_global === 'true' || process.env.BUN_INSTALL_GLOBAL === 'true') {
  console.log('🚀 Setting up SmartGrep...');
  installCompletions();
} else {
  console.log('💡 To enable shell completions, install globally: bun install -g @codebase-curator/smartgrep');
}