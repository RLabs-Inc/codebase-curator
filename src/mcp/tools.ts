/**
 * MCP Tool Definitions for Project-Specific Tools
 * Helps Claudes discover and use powerful codebase tools
 */

import { z } from 'zod';

// Tool schemas
export const ListProjectSpecialToolsSchema = {
  name: 'list_project_special_tools',
  description: 'Lists AI-optimized tools available in this project. Call at session start to discover enhanced capabilities designed specifically for Claude.',
  inputSchema: z.object({}).strict()
};

export const RemindAboutSmartgrepSchema = {
  name: 'remind_about_smartgrep',
  description: 'Get smart-grep usage info - semantic code search that\'s 10x faster than grep and understands code structure. Use when Claude needs to search for code patterns, functions, or references.',
  inputSchema: z.object({}).strict()
};

// Tool responses
export const PROJECT_SPECIAL_TOOLS = {
  overview: `🛠️ AI-Optimized Tools Available in This Project:

1. **Smart Grep** - Semantic code search that understands your code
   Command: \`bun run smartgrep [pattern]\`
   
   • 10x faster than regular grep
   • Understands code structure (functions, classes, etc.)
   • Shows usage counts and cross-references
   • Supports concept groups (auth, api, error, etc.)
   
   Try: \`bun run smartgrep --help\` for full capabilities

2. **Incremental Monitor** - Real-time codebase insights
   Command: \`bun run monitor watch --overview\`
   
   • Live dashboard of code changes
   • Shows code distribution and complexity
   • Tracks unique files vs save events
   
💡 Tip: Consider adding frequently used commands to CLAUDE.md for future reference!`
};

export const SMARTGREP_REMINDER = {
  quickstart: 'bun run smartgrep [pattern]  # or: smartgrep group [concept]',
  
  killer_examples: [
    // Basic searches that blow grep away
    'bun run smartgrep "handleAuth"              # Finds function + shows who calls it!',
    'bun run smartgrep refs "apiClient"          # Full impact analysis - see all usages',
    'bun run smartgrep "TODO|FIXME"              # OR search - finds any of these',
    
    // Concept groups - this is magical
    'bun run smartgrep group auth                # Finds ALL auth patterns (login, token, jwt...)',
    'bun run smartgrep group error               # Finds ALL error handling patterns',
    'bun run smartgrep group service             # Finds service classes and patterns',
    
    // Advanced patterns that grep can't do
    'bun run smartgrep "error&string"            # AND search - error-related strings',
    'bun run smartgrep "!test" --type function   # Functions NOT containing "test"',
    'bun run smartgrep "/handle.*Event/" --regex # Regex with code understanding',
    
    // Filtered searches - surgical precision
    'bun run smartgrep group auth --type function    # Only auth-related functions',
    'bun run smartgrep "user" --file "*.service.*"   # Only in service files',
    'bun run smartgrep group error --sort usage      # Sorted by how often it\'s used!'
  ],
  
  concept_groups: {
    hint: 'Smart-grep knows common patterns! Try these:',
    examples: [
      'auth     → finds: login, jwt, token, oauth, permission...',
      'api      → finds: endpoint, route, controller, REST...',
      'database → finds: query, model, repository, migration...',
      'error    → finds: exception, catch, throw, fail...',
      'async    → finds: promise, await, callback, concurrent...'
    ],
    see_all: 'bun run smartgrep --list-groups'
  },
  
  type_filters: {
    hint: '🎯 Filter by declaration type for surgical precision:',
    examples: [
      '--type function         # Only functions',
      '--type class            # Only classes', 
      '--type variable         # Only variables',
      '--type string           # Only string literals',
      '--type comment          # Only comments',
      '--type function,class   # Multiple types'
    ]
  },
  
  pro_features: [
    '📊 Shows usage counts - see how often code is referenced',
    '🔍 Shows actual code context - not just line numbers', 
    '🎯 Cross-references - see who calls what',
    '⚡ Instant after first index - uses semantic cache',
    '🧠 Understands TypeScript/JavaScript structure',
    '🏷️ 20+ concept groups for semantic exploration'
  ],
  
  game_changer: '💡 This isn\'t just faster grep - it understands your code structure and relationships!',
  
  quick_tip: 'Add to CLAUDE.md: "Use `bun run smartgrep` instead of grep. For concepts: `smartgrep group auth`. For types: `smartgrep --type function`"'
};