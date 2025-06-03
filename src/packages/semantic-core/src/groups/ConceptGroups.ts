/**
 * Concept Groups - Semantic groupings of related terms for intelligent code search
 * 
 * These groups help Claudes understand codebases by organizing terms into
 * meaningful semantic categories that match how developers think about code.
 */

export interface ConceptGroupDefinition {
  name: string
  description: string
  emoji: string
  terms: string[]
}

export interface ConceptGroupsConfig {
  defaultGroups: Record<string, ConceptGroupDefinition>
  customGroups: Record<string, ConceptGroupDefinition>
}

/**
 * Default concept groups - carefully curated for maximum utility across codebases
 */
export const DEFAULT_CONCEPT_GROUPS: Record<string, ConceptGroupDefinition> = {
  // Authentication & Security
  auth: {
    name: 'auth',
    description: 'Authentication & security patterns',
    emoji: '🔐',
    terms: [
      'auth',
      'authenticate',
      'login',
      'signin',
      'credential',
      'token',
      'oauth',
      'jwt',
      'session',
      'password',
      'permission',
      'role',
      'access',
    ],
  },

  // Data & Storage
  database: {
    name: 'database',
    description: 'Database & data persistence patterns',
    emoji: '🗄️',
    terms: [
      'db',
      'database',
      'query',
      'sql',
      'mongo',
      'redis',
      'orm',
      'migration',
      'schema',
      'model',
      'repository',
      'storage',
    ],
  },
  cache: {
    name: 'cache',
    description: 'Caching & temporary storage patterns',
    emoji: '💾',
    terms: [
      'cache',
      'memo',
      'store',
      'persist',
      'temporary',
      'ttl',
      'expire',
      'invalidate',
      'buffer',
      'memory',
    ],
  },

  // API & Communication
  api: {
    name: 'api',
    description: 'API endpoints & communication patterns',
    emoji: '🌐',
    terms: [
      'api',
      'endpoint',
      'route',
      'request',
      'response',
      'controller',
      'handler',
      'rest',
      'graphql',
      'webhook',
      'rpc',
    ],
  },

  // Error & Status
  error: {
    name: 'error',
    description: 'Error handling & status management',
    emoji: '⚠️',
    terms: [
      'error',
      'exception',
      'fail',
      'invalid',
      'warning',
      'catch',
      'throw',
      'reject',
      'status',
      'bug',
      'issue',
      'problem',
    ],
  },

  // Users & Entities
  user: {
    name: 'user',
    description: 'User management & entity patterns',
    emoji: '👤',
    terms: [
      'user',
      'account',
      'profile',
      'member',
      'customer',
      'person',
      'client',
      'subscriber',
      'admin',
      'guest',
    ],
  },

  // Business Logic
  payment: {
    name: 'payment',
    description: 'Payment & billing system patterns',
    emoji: '💳',
    terms: [
      'payment',
      'billing',
      'charge',
      'invoice',
      'transaction',
      'stripe',
      'paypal',
      'subscription',
      'refund',
      'price',
    ],
  },

  // Configuration & Settings
  config: {
    name: 'config',
    description: 'Configuration & environment settings',
    emoji: '⚙️',
    terms: [
      'config',
      'setting',
      'environment',
      'env',
      'constant',
      'variable',
      'option',
      'preference',
      'parameter',
      'flag',
    ],
  },

  // Testing & Quality
  test: {
    name: 'test',
    description: 'Testing & quality assurance patterns',
    emoji: '🧪',
    terms: [
      'test',
      'spec',
      'mock',
      'fixture',
      'assert',
      'expect',
      'describe',
      'it',
      'jest',
      'vitest',
      'unit',
      'integration',
    ],
  },

  // Async & Concurrency
  async: {
    name: 'async',
    description: 'Asynchronous & concurrent programming',
    emoji: '⏳',
    terms: [
      'async',
      'await',
      'promise',
      'then',
      'catch',
      'finally',
      'callback',
      'resolve',
      'reject',
      'concurrent',
      'parallel',
    ],
  },

  // Architecture & Structure
  service: {
    name: 'service',
    description: 'Service layer & business logic patterns',
    emoji: '🔧',
    terms: [
      'service',
      'provider',
      'manager',
      'orchestrator',
      'handler',
      'processor',
      'worker',
      'helper',
      'utility',
    ],
  },
  flow: {
    name: 'flow',
    description: 'Data flow & processing pipelines',
    emoji: '🌊',
    terms: [
      'flow',
      'stream',
      'pipeline',
      'process',
      'workflow',
      'sequence',
      'chain',
      'step',
      'stage',
      'phase',
    ],
  },
  architecture: {
    name: 'architecture',
    description: 'Software architecture & design patterns',
    emoji: '🏗️',
    terms: [
      'architecture',
      'pattern',
      'structure',
      'design',
      'layer',
      'module',
      'component',
      'system',
      'framework',
    ],
  },

  // Code Organization
  import: {
    name: 'import',
    description: 'Module imports & dependency management',
    emoji: '📦',
    terms: [
      'import',
      'export',
      'require',
      'module',
      'dependency',
      'package',
      'library',
      'from',
      'default',
    ],
  },
  interface: {
    name: 'interface',
    description: 'Type definitions & contracts',
    emoji: '📋',
    terms: [
      'interface',
      'type',
      'contract',
      'protocol',
      'schema',
      'definition',
      'spec',
      'api',
      'abstract',
    ],
  },

  // State & Data Flow
  state: {
    name: 'state',
    description: 'State management & data flow',
    emoji: '💡',
    terms: [
      'state',
      'store',
      'redux',
      'context',
      'global',
      'local',
      'session',
      'memory',
      'data',
    ],
  },
  event: {
    name: 'event',
    description: 'Event handling & messaging patterns',
    emoji: '📡',
    terms: [
      'event',
      'emit',
      'listen',
      'subscribe',
      'publish',
      'trigger',
      'dispatch',
      'broadcast',
      'handler',
    ],
  },

  // Infrastructure & Operations
  logging: {
    name: 'logging',
    description: 'Logging & monitoring patterns',
    emoji: '📝',
    terms: [
      'log',
      'logger',
      'console',
      'debug',
      'info',
      'warn',
      'error',
      'trace',
      'monitor',
      'telemetry',
    ],
  },
  security: {
    name: 'security',
    description: 'Security & encryption patterns',
    emoji: '🛡️',
    terms: [
      'security',
      'encrypt',
      'decrypt',
      'hash',
      'salt',
      'certificate',
      'ssl',
      'tls',
      'cors',
      'xss',
      'csrf',
    ],
  },

  // Development Workflow
  build: {
    name: 'build',
    description: 'Build tools & compilation processes',
    emoji: '🔨',
    terms: [
      'build',
      'compile',
      'bundle',
      'webpack',
      'rollup',
      'vite',
      'esbuild',
      'transpile',
      'minify',
    ],
  },
  deploy: {
    name: 'deploy',
    description: 'Deployment & release management',
    emoji: '🚀',
    terms: [
      'deploy',
      'release',
      'publish',
      'ci',
      'cd',
      'docker',
      'kubernetes',
      'server',
      'host',
      'production',
    ],
  },
}

/**
 * Get all available concept groups (default + custom)
 */
export function getAllConceptGroups(customGroups: Record<string, ConceptGroupDefinition> = {}): ConceptGroupsConfig {
  return {
    defaultGroups: DEFAULT_CONCEPT_GROUPS,
    customGroups,
  }
}

/**
 * Get terms for a specific group (with custom group support)
 */
export function getGroupTerms(
  groupName: string,
  customGroups: Record<string, ConceptGroupDefinition> = {}
): string[] {
  // Check custom groups first
  if (customGroups[groupName]) {
    return customGroups[groupName].terms
  }
  
  // Fallback to default groups
  if (DEFAULT_CONCEPT_GROUPS[groupName]) {
    return DEFAULT_CONCEPT_GROUPS[groupName].terms
  }
  
  return []
}

/**
 * Check if a group exists (default or custom)
 */
export function groupExists(
  groupName: string,
  customGroups: Record<string, ConceptGroupDefinition> = {}
): boolean {
  return !!customGroups[groupName] || !!DEFAULT_CONCEPT_GROUPS[groupName]
}

/**
 * Get formatted group list for CLI display
 */
export function getFormattedGroupList(customGroups: Record<string, ConceptGroupDefinition> = {}): string {
  const lines: string[] = []
  
  lines.push('📚 Available Concept Groups:\n')
  
  // Default groups
  Object.values(DEFAULT_CONCEPT_GROUPS).forEach(group => {
    lines.push(`${group.emoji} ${group.name}`)
    lines.push(`   Terms: ${group.terms.slice(0, 5).join(', ')}, ...`)
    lines.push(`   Usage: smartgrep group ${group.name}\n`)
  })
  
  // Custom groups (if any)
  if (Object.keys(customGroups).length > 0) {
    lines.push('🎨 Custom Groups:\n')
    Object.values(customGroups).forEach(group => {
      lines.push(`${group.emoji || '📌'} ${group.name}`)
      lines.push(`   Terms: ${group.terms.slice(0, 5).join(', ')}, ...`)
      lines.push(`   Usage: smartgrep group ${group.name}\n`)
    })
  }
  
  return lines.join('\n')
}