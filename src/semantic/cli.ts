#!/usr/bin/env bun

/**
 * Smart Grep CLI
 * Semantic search tool for codebases
 */

import { SemanticService } from './SemanticService';
import { SearchResult } from './types';

const CONCEPT_GROUPS: Record<string, string[]> = {
  // Authentication & Security
  auth: ["auth", "authenticate", "login", "signin", "credential", "token", "oauth", "jwt", "session", "password", "permission", "role", "access"],
  
  // Data & Storage
  database: ["db", "database", "query", "sql", "mongo", "redis", "orm", "migration", "schema", "model", "repository", "storage"],
  cache: ["cache", "memo", "store", "persist", "temporary", "ttl", "expire", "invalidate", "buffer", "memory"],
  
  // API & Communication
  api: ["api", "endpoint", "route", "request", "response", "controller", "handler", "rest", "graphql", "webhook", "rpc"],
  
  // Error & Status
  error: ["error", "exception", "fail", "invalid", "warning", "catch", "throw", "reject", "status", "bug", "issue", "problem"],
  
  // Users & Entities
  user: ["user", "account", "profile", "member", "customer", "person", "client", "subscriber", "admin", "guest"],
  
  // Business Logic
  payment: ["payment", "billing", "charge", "invoice", "transaction", "stripe", "paypal", "subscription", "refund", "price"],
  
  // Configuration & Settings
  config: ["config", "setting", "environment", "env", "constant", "variable", "option", "preference", "parameter", "flag"],
  
  // Testing & Quality
  test: ["test", "spec", "mock", "fixture", "assert", "expect", "describe", "it", "jest", "vitest", "unit", "integration"],
  
  // Async & Concurrency
  async: ["async", "await", "promise", "then", "catch", "finally", "callback", "resolve", "reject", "concurrent", "parallel"],
  
  // Architecture & Structure (NEW - based on curator's usage)
  service: ["service", "provider", "manager", "orchestrator", "handler", "processor", "worker", "helper", "utility"],
  flow: ["flow", "stream", "pipeline", "process", "workflow", "sequence", "chain", "step", "stage", "phase"],
  architecture: ["architecture", "pattern", "structure", "design", "layer", "module", "component", "system", "framework"],
  
  // Code Organization (NEW)
  import: ["import", "export", "require", "module", "dependency", "package", "library", "from", "default"],
  interface: ["interface", "type", "contract", "protocol", "schema", "definition", "spec", "api", "abstract"],
  
  // State & Data Flow (NEW)
  state: ["state", "store", "redux", "context", "global", "local", "session", "memory", "data"],
  event: ["event", "emit", "listen", "subscribe", "publish", "trigger", "dispatch", "broadcast", "handler"],
  
  // Infrastructure & Operations (NEW)
  logging: ["log", "logger", "console", "debug", "info", "warn", "error", "trace", "monitor", "telemetry"],
  security: ["security", "encrypt", "decrypt", "hash", "salt", "certificate", "ssl", "tls", "cors", "xss", "csrf"],
  
  // Development Workflow (NEW)
  build: ["build", "compile", "bundle", "webpack", "rollup", "vite", "esbuild", "transpile", "minify"],
  deploy: ["deploy", "release", "publish", "ci", "cd", "docker", "kubernetes", "server", "host", "production"],
};

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const projectPath = process.cwd();
  const service = new SemanticService();

  // Parse command and options
  const command = args[0];
  
  switch (command) {
    case 'index':
      await handleIndex(service, projectPath);
      break;
      
    case '--groups':
      showConceptGroups();
      break;
      
    default:
      // Default to search
      await handleSearch(service, projectPath, args);
  }
}

async function handleIndex(service: SemanticService, projectPath: string) {
  console.log(`📂 Indexing codebase at: ${projectPath}`);
  await service.indexCodebase(projectPath);
  console.log('✨ Indexing complete!');
}

async function handleSearch(service: SemanticService, projectPath: string, args: string[]) {
  // Try to load existing index
  const loaded = await service.loadIndex(projectPath);
  if (!loaded) {
    console.log('No semantic index found. Building...');
    await service.indexCodebase(projectPath);
  }

  // Parse search arguments
  let query = '';
  let typeFilter: string[] | undefined;
  let fileFilter: string[] | undefined;
  let maxResults = 50;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--type' && args[i + 1]) {
      typeFilter = args[++i].split(',');
    } else if (arg === '--file' && args[i + 1]) {
      fileFilter = args[++i].split(',');
    } else if (arg === '--max' && args[i + 1]) {
      maxResults = parseInt(args[++i]);
    } else if (!arg.startsWith('--')) {
      query = arg;
    }
  }

  if (!query) {
    console.error('Please provide a search query');
    process.exit(1);
  }

  // Check if it's a concept group
  const conceptGroup = CONCEPT_GROUPS[query.toLowerCase()];
  
  const results = conceptGroup 
    ? service.searchGroup(conceptGroup)
    : service.search(query, { type: typeFilter, files: fileFilter, maxResults });

  displayResults(query, results, conceptGroup);
}

function displayResults(query: string, results: SearchResult[], conceptGroup?: string[]) {
  if (results.length === 0) {
    console.log(`No results found for "${query}"`);
    return;
  }

  console.log(`\n🔍 Search: "${query}" ${conceptGroup ? `(concept group: ${conceptGroup.join(', ')})` : ''}`);
  console.log(`📊 Found ${results.length} results\n`);

  // Group by type
  const grouped = results.reduce((acc, result) => {
    const type = result.info.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  // Display each group
  for (const [type, items] of Object.entries(grouped)) {
    const icon = getTypeIcon(type);
    console.log(`${icon} ${type.toUpperCase()} (${items.length})`);
    
    items.slice(0, 10).forEach(result => {
      const info = result.info;
      const relevance = (result.relevanceScore * 100).toFixed(0);
      const shortPath = info.location.file.split('/').slice(-2).join('/');
      
      console.log(`├── ${info.term.padEnd(30)} → ${shortPath}:${info.location.line}`);
      
      // Show context for strings and comments
      if ((type === 'string' || type === 'comment') && info.context) {
        const contextPreview = info.context.trim().substring(0, 60);
        console.log(`│   ${contextPreview}${info.context.length > 60 ? '...' : ''}`);
      }
    });
    
    if (items.length > 10) {
      console.log(`└── ... and ${items.length - 10} more`);
    }
    console.log('');
  }

  // Show usage tip
  if (results.length > 20) {
    console.log('💡 Tip: Use filters to narrow results:');
    console.log('   smartgrep "auth" --type function');
    console.log('   smartgrep "error" --file "*.service.*"');
    console.log('   smartgrep "user" --max 20\n');
  }
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    function: '📁',
    class: '📦',
    variable: '📄',
    constant: '🔤',
    string: '💬',
    comment: '📝',
    import: '📥',
    file: '🗂️'
  };
  return icons[type] || '📄';
}

function showHelp() {
  console.log(`
🔍 Smart Grep - Semantic Code Search

Usage:
  smartgrep <query>                Search for a term or concept
  smartgrep index                  Rebuild the semantic index
  smartgrep --groups              Show available concept groups

Search Options:
  --type <types>     Filter by type (function,class,string,etc.)
  --file <patterns>  Filter by file patterns
  --max <number>     Maximum results to show (default: 50)

Concept Groups:
  smartgrep auth     Search for authentication-related code
  smartgrep api      Search for API/endpoint-related code
  smartgrep error    Search for error handling code
  ...and more! Use --groups to see all available groups

Examples:
  smartgrep "authenticateUser"
  smartgrep auth
  smartgrep "error" --type string
  smartgrep "user" --file "*.service.*"
  smartgrep payment --max 20

The tool automatically indexes your codebase on first use.
Subsequent searches use the cached index for fast results.
`);
}

function showConceptGroups() {
  console.log('\n📚 Available Concept Groups:\n');
  
  for (const [group, terms] of Object.entries(CONCEPT_GROUPS)) {
    console.log(`${getGroupIcon(group)} ${group}`);
    console.log(`   Terms: ${terms.slice(0, 5).join(', ')}${terms.length > 5 ? ', ...' : ''}`);
    console.log(`   Usage: smartgrep ${group}\n`);
  }
}

function getGroupIcon(group: string): string {
  const icons: Record<string, string> = {
    // Authentication & Security
    auth: '🔐',
    security: '🛡️',
    
    // Data & Storage
    database: '🗄️',
    cache: '💾',
    
    // API & Communication
    api: '🌐',
    
    // Error & Status
    error: '⚠️',
    
    // Users & Entities
    user: '👤',
    
    // Business Logic
    payment: '💳',
    
    // Configuration & Settings
    config: '⚙️',
    
    // Testing & Quality
    test: '🧪',
    
    // Async & Concurrency
    async: '⏳',
    
    // Architecture & Structure
    service: '🔧',
    flow: '🌊',
    architecture: '🏗️',
    
    // Code Organization
    import: '📦',
    interface: '📋',
    
    // State & Data Flow
    state: '💡',
    event: '📡',
    
    // Infrastructure & Operations
    logging: '📝',
    
    // Development Workflow
    build: '🔨',
    deploy: '🚀',
  };
  return icons[group] || '📂';
}

// Run the CLI
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});