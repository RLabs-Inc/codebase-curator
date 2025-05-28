/**
 * Language System Tests
 * Tests for the modular language expansion framework
 */

import { test, expect } from 'bun:test'
import { LanguageRegistry } from '../src/languages/base/LanguageRegistry'
import { TypeScriptAnalyzer } from '../src/languages/plugins/typescript'
import { initializeLanguages } from '../src/languages'
import path from 'path'

test('LanguageRegistry singleton pattern', () => {
  const registry1 = LanguageRegistry.getInstance()
  const registry2 = LanguageRegistry.getInstance()
  
  expect(registry1).toBe(registry2)
})

test('TypeScript plugin registration', () => {
  const registry = LanguageRegistry.getInstance()
  registry.clear()
  
  const tsPlugin = new TypeScriptAnalyzer({ 
    rootPath: process.cwd() 
  })
  
  registry.register(tsPlugin)
  
  // Check registration
  expect(registry.getPlugin('typescript')).toBe(tsPlugin)
  expect(registry.getPluginByExtension('ts')).toBe(tsPlugin)
  expect(registry.getPluginByExtension('tsx')).toBe(tsPlugin)
  expect(registry.getPluginByExtension('js')).toBe(tsPlugin)
  expect(registry.getPluginByExtension('jsx')).toBe(tsPlugin)
})

test('File pattern generation', () => {
  const registry = LanguageRegistry.getInstance()
  registry.clear()
  
  // No languages registered
  expect(registry.getCombinedFilePattern()).toBe('**/*.{___no_match___}')
  
  // Register TypeScript
  const tsPlugin = new TypeScriptAnalyzer({ 
    rootPath: process.cwd() 
  })
  registry.register(tsPlugin)
  
  const pattern = registry.getCombinedFilePattern()
  expect(pattern).toContain('ts')
  expect(pattern).toContain('tsx')
  expect(pattern).toContain('js')
  expect(pattern).toContain('jsx')
})

test('Language initialization', () => {
  const registry = LanguageRegistry.getInstance()
  registry.clear()
  
  // Initialize with default languages
  initializeLanguages()
  
  const stats = registry.getStats()
  expect(stats.languageCount).toBe(1)
  expect(stats.languages).toContain('typescript')
})

test('Import parsing with TypeScript plugin', async () => {
  const tsPlugin = new TypeScriptAnalyzer({ 
    rootPath: process.cwd() 
  })
  
  const testCode = `
import React from 'react'
import { useState, useEffect } from 'react'
import './styles.css'
const utils = require('../utils')
import type { Config } from './types'
`

  const imports = await tsPlugin.parseImports(testCode, 'test.tsx')
  
  expect(imports.length).toBeGreaterThanOrEqual(4)
  
  // Check React default import
  const reactImport = imports.find(i => i.source === 'react' && i.isDefault)
  expect(reactImport).toBeTruthy()
  expect(reactImport?.imports).toContain('React')
  
  // Check named imports
  const namedImport = imports.find(i => i.source === 'react' && !i.isDefault)
  expect(namedImport).toBeTruthy()
  expect(namedImport?.imports).toContain('useState')
  expect(namedImport?.imports).toContain('useEffect')
  
  // Check relative imports
  const styleImport = imports.find(i => i.source === './styles.css')
  expect(styleImport).toBeTruthy()
  expect(styleImport?.isExternal).toBe(false)
  
  // Check CommonJS
  const utilsImport = imports.find(i => i.source === '../utils')
  expect(utilsImport).toBeTruthy()
  expect(utilsImport?.imports).toContain('utils')
})

test('Framework detection', () => {
  const tsPlugin = new TypeScriptAnalyzer({ 
    rootPath: process.cwd() 
  })
  
  const dependencies = ['react', 'react-dom', 'express', 'jest']
  const frameworks = tsPlugin.detectFrameworks(dependencies)
  
  expect(frameworks.length).toBe(3)
  
  const react = frameworks.find(f => f.name === 'React')
  expect(react).toBeTruthy()
  expect(react?.category).toBe('frontend')
  
  const express = frameworks.find(f => f.name === 'Express')
  expect(express).toBeTruthy()
  expect(express?.category).toBe('backend')
  
  const jest = frameworks.find(f => f.name === 'Jest')
  expect(jest).toBeTruthy()
  expect(jest?.category).toBe('testing')
})

test('Pattern extraction', () => {
  const tsPlugin = new TypeScriptAnalyzer({ 
    rootPath: process.cwd() 
  })
  
  const componentCode = `
export default function UserCard() {
  const [user, setUser] = useState(null)
  
  return <div>User Card</div>
}

const useAuth = () => {
  return { user: null }
}

app.get('/api/users', (req, res) => {
  res.json({ users: [] })
})
`
  
  const patterns = tsPlugin.extractPatterns(componentCode, 'test.tsx')
  
  // Should find component pattern
  const componentPattern = patterns.find(p => p.category === 'component')
  expect(componentPattern).toBeTruthy()
  expect(componentPattern?.name).toBe('UserCard')
  
  // Should find hook pattern
  const hookPattern = patterns.find(p => p.category === 'hook')
  expect(hookPattern).toBeTruthy()
  expect(hookPattern?.name).toBe('useAuth')
  
  // Should find API pattern
  const apiPattern = patterns.find(p => p.category === 'api')
  expect(apiPattern).toBeTruthy()
  expect(apiPattern?.name).toBe('GET /api/users')
})