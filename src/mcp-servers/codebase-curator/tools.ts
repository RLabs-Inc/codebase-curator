/**
 * MCP Tool Definitions for Project-Specific Tools
 * Helps Claudes discover and use powerful codebase tools
 */

import { z } from 'zod';

// Tool schemas
export const ListProjectSpecialToolsSchema = {
  name: 'list_project_special_tools',
  description: 'Lists AI-optimized tools available in this project. Call at session start to discover enhanced capabilities designed specifically for Claude.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export const RemindAboutSmartgrepSchema = {
  name: 'remind_about_smartgrep',
  description: 'Get smart-grep usage info - semantic code search that\'s 10x faster than grep and understands code structure. Use when Claude needs to search for code patterns, functions, or references.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export const RemindAboutTaskSmartgrepSchema = {
  name: 'remind_about_task_smartgrep',
  description: 'IMPORTANT: Get reminder about including explicit smartgrep instructions when using Task agents. Task agents have Bash access and can use smartgrep, but need explicit instructions. Call this before creating search-related Task prompts.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
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

export const TASK_SMARTGREP_REMINDER = {
  title: '🚨 IMPORTANT: Task Agents & Smartgrep Usage',
  
  discovery: `We discovered that Task agents have access to Bash and CAN use smartgrep, 
but they don't know about it unless you explicitly tell them!`,

  the_problem: `Task agents won't use smartgrep unless you specifically mention:
  1. That smartgrep exists
  2. How to run it (via Bash tool)
  3. Why it's better than regular grep`,

  best_practices: [
    '✅ ALWAYS mention smartgrep explicitly in search-related Task prompts',
    '✅ Include specific smartgrep command examples',
    '✅ Explain that it\'s available via the Bash tool',
    '✅ Mention it\'s semantic search, not just text matching'
  ],

  bad_example: {
    prompt: "Search for all authentication implementations in the codebase",
    problem: "Agent will likely use regular grep or Glob, missing semantic connections"
  },

  good_example: {
    prompt: `Search for all authentication implementations in the codebase. 
    
IMPORTANT: Use the Bash tool to run smartgrep for semantic search:
- 'bun run smartgrep group auth' - finds ALL auth patterns
- 'bun run smartgrep "authenticate" --type function' - finds auth functions
- 'bun run smartgrep refs "AuthService"' - finds all references

Smartgrep understands code structure and is much more effective than grep.`,
    benefit: "Agent now knows to use smartgrep and how to use it effectively!"
  },

  template: `When creating Task prompts for code searching, include:

"Use the Bash tool to run smartgrep commands for semantic code search:
- 'bun run smartgrep [pattern]' for literal searches
- 'bun run smartgrep group [concept]' for semantic pattern groups
- 'bun run smartgrep refs [term]' for cross-references
This is much more effective than regular grep as it understands code structure."`,

  reminder: '💡 Task agents are powerful but need explicit guidance about available tools!'
};