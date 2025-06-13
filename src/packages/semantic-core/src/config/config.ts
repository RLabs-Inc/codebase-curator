import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { CuratorConfig } from '../types/config'
import { DEFAULT_EXCLUSIONS } from '../types/config'
import type { ConceptGroupDefinition } from '../types/groups'

export function loadConfig(projectPath: string): CuratorConfig {
  // Look for config file in project directory
  const configNames = ['.curatorconfig.json', '.curatorrc.json', '.curatorrc']

  for (const configName of configNames) {
    const configPath = join(projectPath, configName)
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8')
        return JSON.parse(content)
      } catch (e) {
        console.error(`Error loading config from ${configPath}:`, e)
      }
    }
  }

  // Return empty config if none found
  return {}
}

export function mergeExclusions(
  defaultExclusions: string[] = DEFAULT_EXCLUSIONS,
  configExclusions: string[] = [],
  cliExclusions: string[] = []
): string[] {
  // Merge all exclusions, removing duplicates
  const allExclusions = new Set([
    ...defaultExclusions,
    ...configExclusions,
    ...cliExclusions,
  ])

  return Array.from(allExclusions)
}

export function shouldExclude(
  filePath: string,
  exclusions: string[],
  inclusions: string[] = []
): boolean {
  // First check if explicitly included
  if (inclusions.length > 0) {
    const isIncluded = inclusions.some(
      (pattern) => filePath.includes(pattern) || minimatch(filePath, pattern)
    )
    if (isIncluded) return false
  }

  // Then check exclusions
  return exclusions.some((pattern) => {
    // Simple substring match for directories
    if (!pattern.includes('*')) {
      return filePath.includes(pattern)
    }
    // For glob patterns, we'd need a proper matcher
    // For now, just do simple wildcard matching
    return minimatch(filePath, pattern)
  })
}

/**
 * Parse and normalize custom groups from config
 * Supports both simple arrays and full group definitions
 */
export function parseCustomGroups(
  customGroups: Record<string, string[] | ConceptGroupDefinition> = {}
): Record<string, ConceptGroupDefinition> {
  const normalized: Record<string, ConceptGroupDefinition> = {}

  for (const [name, group] of Object.entries(customGroups)) {
    if (Array.isArray(group)) {
      // Simple array format: { "mygroup": ["term1", "term2"] }
      normalized[name] = {
        name,
        description: `Custom group: ${name}`,
        emoji: '🎨',
        terms: group,
      }
    } else {
      // Full group definition format
      normalized[name] = {
        name,
        description: group.description || `Custom group: ${name}`,
        emoji: group.emoji || '🎨',
        terms: group.terms,
      }
    }
  }

  return normalized
}

// Simple minimatch implementation for basic patterns
function minimatch(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except * and ?
    .replace(/\*\*/g, '§§') // Temporarily replace ** to avoid conflict
    .replace(/\*/g, '[^/]*') // * matches within directory only
    .replace(/§§/g, '.*') // ** matches any number of directories
    .replace(/\?/g, '.') // ? matches single character

  // For patterns starting with **, match anywhere in the path
  if (pattern.startsWith('**/')) {
    // Remove the leading .*/ to match from any position in the path
    const cleanRegex = regex.replace(/^\.?\*\//, '')
    return new RegExp(cleanRegex).test(path)
  }

  // For patterns like *.log, match at any level
  if (pattern.startsWith('*')) {
    return new RegExp(regex).test(path)
  }

  // For specific paths, anchor at start
  return new RegExp('^' + regex).test(path)
}
