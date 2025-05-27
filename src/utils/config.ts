import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { CuratorConfig, DEFAULT_EXCLUSIONS } from '../types/config';

export function loadConfig(projectPath: string): CuratorConfig {
  // Look for config file in project root and parent directories
  const configNames = ['.curatorconfig.json', '.curatorrc.json', '.curatorrc'];
  
  let currentPath = projectPath;
  while (currentPath !== dirname(currentPath)) { // Stop at root
    for (const configName of configNames) {
      const configPath = join(currentPath, configName);
      if (existsSync(configPath)) {
        try {
          const content = readFileSync(configPath, 'utf-8');
          return JSON.parse(content);
        } catch (e) {
          console.error(`Error loading config from ${configPath}:`, e);
        }
      }
    }
    currentPath = dirname(currentPath);
  }
  
  // Return empty config if none found
  return {};
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
    ...cliExclusions
  ]);
  
  return Array.from(allExclusions);
}

export function shouldExclude(
  filePath: string, 
  exclusions: string[],
  inclusions: string[] = []
): boolean {
  // First check if explicitly included
  if (inclusions.length > 0) {
    const isIncluded = inclusions.some(pattern => 
      filePath.includes(pattern) || minimatch(filePath, pattern)
    );
    if (isIncluded) return false;
  }
  
  // Then check exclusions
  return exclusions.some(pattern => {
    // Simple substring match for directories
    if (!pattern.includes('*')) {
      return filePath.includes(pattern);
    }
    // For glob patterns, we'd need a proper matcher
    // For now, just do simple wildcard matching
    return minimatch(filePath, pattern);
  });
}

// Simple minimatch implementation for basic patterns
function minimatch(path: string, pattern: string): boolean {
  // Convert glob to regex (very basic implementation)
  if (pattern.includes('*')) {
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    return new RegExp(regex).test(path);
  }
  return path.includes(pattern);
}