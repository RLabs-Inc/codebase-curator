import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { spawn, execSync } from 'child_process';

import { ImportMapper } from '../algorithms/importMapper';
import { FrameworkDetector } from '../algorithms/frameworkDetector';
import { FileOrganizationAnalyzer } from '../algorithms/fileOrganizationAnalyzer';
import { PatternAggregator } from '../algorithms/patternAggregator';
import { CodeSimilarityAnalyzer } from '../algorithms/codeSimilarityAnalyzer';

// Environment variable for default project path
const DEFAULT_PROJECT_PATH = process.env.CODEBASE_CURATOR_PATH || process.cwd();

// Path to the codebase-curator installation
const CURATOR_TOOL_PATH = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

// Find Claude CLI executable
let CLAUDE_CLI_PATH = 'claude'; // Default to PATH lookup

// Try to find Claude CLI in common locations
const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const claudePaths = [
  path.join(homeDir, '.claude/local/claude'), // User-agnostic path
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
  'C:\\Program Files\\Claude\\claude.exe', // Windows
  process.env.CLAUDE_CLI_PATH, // Allow override via env var
].filter(Boolean);

for (const claudePath of claudePaths) {
  if (claudePath && existsSync(claudePath)) {
    CLAUDE_CLI_PATH = claudePath;
    break;
  }
}

// Find Node.js executable
let NODE_PATH = 'node'; // Default to PATH lookup

// Try to find Node in common locations
const nodePaths = [
  process.env.NODE_PATH_BINARY, // Allow override via env var - check this first
];

// Check fnm installations
try {
  const fnmPath = path.join(homeDir, '.local/share/fnm/node-versions');
  if (existsSync(fnmPath)) {
    const fnmVersions = readdirSync(fnmPath)
      .map(v => path.join(fnmPath, v, 'installation/bin/node'))
      .filter(existsSync);
    nodePaths.push(...fnmVersions);
  }
} catch (e) {}

// Check nvm installations
try {
  const nvmPath = path.join(homeDir, '.nvm/versions/node');
  if (existsSync(nvmPath)) {
    const nvmVersions = readdirSync(nvmPath)
      .map(v => path.join(nvmPath, v, 'bin/node'))
      .filter(existsSync);
    nodePaths.push(...nvmVersions);
  }
} catch (e) {}

// Add system-wide installations
nodePaths.push(
  '/usr/local/bin/node',
  '/usr/bin/node',
  '/opt/homebrew/bin/node',
  'C:\\Program Files\\nodejs\\node.exe', // Windows
  'C:\\Program Files (x86)\\nodejs\\node.exe' // Windows 32-bit
);

for (const nodePath of nodePaths) {
  if (nodePath && existsSync(nodePath)) {
    NODE_PATH = nodePath;
    break;
  }
}

// Store session IDs per project path
const curatorSessions: Map<string, string> = new Map();

// Check if claude CLI is available
function checkClaudeCLI(): boolean {
  try {
    // Check if our found path exists and is executable
    if (existsSync(CLAUDE_CLI_PATH)) {
      execSync(`${CLAUDE_CLI_PATH} --version`, { stdio: 'ignore' });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Helper to resolve project path
function resolveProjectPath(inputPath?: string): string {
  if (!inputPath) {
    return DEFAULT_PROJECT_PATH;
  }
  if (!path.isAbsolute(inputPath)) {
    return path.resolve(DEFAULT_PROJECT_PATH, inputPath);
  }
  return inputPath;
}

// Get or create curator session file
function getCuratorSessionFile(projectPath: string): string {
  const curatorDir = path.join(projectPath, '.curator');
  if (!existsSync(curatorDir)) {
    mkdirSync(curatorDir, { recursive: true });
  }
  return path.join(curatorDir, 'session.txt');
}

// Run initial analysis to get codebase overview
async function getCodebaseOverview(projectPath: string) {
  const [imports, frameworks, organization, patterns] = await Promise.all([
    new ImportMapper(projectPath).analyze().catch(() => null),
    new FrameworkDetector(projectPath).detect().catch(() => null),
    new FileOrganizationAnalyzer(projectPath).analyze().catch(() => null),
    new PatternAggregator(projectPath).analyze().catch(() => null),
  ]);

  return {
    projectPath,
    imports: imports?.summary || null,
    frameworks: frameworks?.summary || null,
    organization: organization?.patterns || null,
    patterns: patterns?.statistics || null,
  };
}

// Create a concise summary for the initial prompt to avoid truncation
function createConciseSummary(overview: any): string {
  const summary = {
    projectPath: overview.projectPath,
    stats: {
      totalFiles: overview.imports?.totalFiles || 0,
      externalDeps: overview.imports?.externalDependencies || 0,
      internalImports: overview.imports?.internalImports || 0,
    },
    tech: {
      frameworks: overview.frameworks?.frameworks?.slice(0, 3).map((f: any) => f.name) || [],
      languages: overview.frameworks?.languages?.slice(0, 3) || [],
      buildTools: overview.frameworks?.buildTools?.slice(0, 3) || [],
    },
    structure: {
      topFolders: overview.organization?.structure?.topLevelDirs?.slice(0, 5) || [],
      depth: overview.organization?.structure?.depth || 0,
    }
  };
  
  return JSON.stringify(summary, null, 2);
}

// Parse streaming JSON output
function parseStreamingJSON(output: string): any {
  const lines = output.trim().split('\n');
  let result = null;
  let lastAssistantMessage = null;
  let errorMessage = null;
  
  for (const line of lines) {
    try {
      const json = JSON.parse(line);
      if (json.type === 'result') {
        // Handle both success and error results
        if (json.subtype === 'error_max_turns') {
          errorMessage = 'Curator reached maximum conversation turns. Try asking a more specific question.';
        } else if (json.result) {
          result = json.result;
        }
      } else if (json.type === 'assistant' && json.message) {
        // Handle the nested message structure
        const msg = json.message;
        if (msg.content && msg.content.length > 0) {
          const textContent = msg.content.find((c: any) => c.type === 'text');
          if (textContent) {
            lastAssistantMessage = textContent.text;
          }
        }
      }
    } catch {
      // Skip non-JSON lines
    }
  }
  
  // Return error message if we hit an error, otherwise result or last message
  return errorMessage || result || lastAssistantMessage;
}

// Spawn a curator Claude instance for overview
async function spawnCuratorForOverview(projectPath: string): Promise<string> {
  // Always start fresh for overviews to get the most current state
  const question = "overview"; // Simple trigger for our detection
  return spawnCurator(projectPath, question, false);
}

// Spawn a curator Claude instance
async function spawnCurator(
  projectPath: string,
  question: string,
  useExistingSession: boolean = true
): Promise<string> {
  const sessionFile = getCuratorSessionFile(projectPath);
  const existingSession = existsSync(sessionFile) && useExistingSession ? 
    readFileSync(sessionFile, 'utf-8').trim() : null;

  // Get initial overview
  const overview = await getCodebaseOverview(projectPath);

  // Check if this is a special command
  const isOverviewRequest = question.toLowerCase().includes('overview') || 
                           question.toLowerCase().includes('what is this') ||
                           question.toLowerCase().includes('understand this codebase');
  
  const isAddFeatureRequest = question.toLowerCase().includes('add') && 
                             (question.toLowerCase().includes('feature') || 
                              question.toLowerCase().includes('implement'));
  
  const isIntegrationRequest = question.toLowerCase().includes('where') && 
                              (question.toLowerCase().includes('integrate') || 
                               question.toLowerCase().includes('add') ||
                               question.toLowerCase().includes('put'));

  // Create specialized prompts based on request type
  let specializedPrompt = '';
  
  if (isOverviewRequest) {
    specializedPrompt = `
## SPECIAL INSTRUCTION: EMERGENT CODEBASE OVERVIEW

You've been asked to provide a codebase overview. This is a critical task that requires a unique approach:

1. DO NOT use any predetermined template or structure
2. Let the codebase itself tell you what's important
3. Use all available tools to explore and understand
4. The structure of your response should emerge from what you discover
5. Different codebases will naturally lead to different overview structures

Explore this codebase like an archaeologist discovering a new site. What patterns emerge? What seems important based on the code itself? What story does this codebase want to tell?

Your overview should reflect the codebase's:
- Actual purpose (not assumed)
- Natural organization (not imposed)
- Real patterns (not expected)
- Unique characteristics (not generic)

IMPORTANT: Feel free to provide as much detail as the codebase reveals. Update your memory file with key insights for future reference.

Remember: You are a mirror reflecting the codebase, not a template filling exercise.
`;
  } else if (isAddFeatureRequest) {
    specializedPrompt = `
## SPECIAL INSTRUCTION: PATTERN-BASED FEATURE ADDITION GUIDE

You've been asked about adding a new feature. Your approach should be:

1. Find similar existing features in the codebase
2. Identify patterns from actual implementations (not theoretical)
3. Show real examples from THIS codebase
4. Let the existing code guide the new implementation

Do not prescribe generic patterns. Instead, discover how THIS codebase actually implements features and guide based on those discoveries.
`;
  } else if (isIntegrationRequest) {
    specializedPrompt = `
## SPECIAL INSTRUCTION: INTEGRATION POINT DISCOVERY

You've been asked about integration points. Your approach should be:

1. Analyze where recent additions were made
2. Identify actual connection patterns in the code
3. Show statistics (X% of features connect here, Y% connect there)
4. Provide real examples from the codebase

Let the codebase's actual structure guide your answer, not assumptions about where things "should" go.
`;
  }

  // Create the curator's context
  const curatorContext = `You are the Codebase Curator - a specialized AI assistant that deeply understands this specific codebase.

Your role is to provide architectural guidance, explain patterns, and help other AI assistants write code that integrates well with the existing codebase.

${specializedPrompt}

## AVAILABLE TOOLS

1. **File Access Tools**:
   - Read: Read any file to understand implementation details
   - Grep: Search for patterns across files
   - Glob: Find files by name patterns
   - LS: List directory contents

2. **Analysis CLI Tool**: Use Bash to run codebase analysis
   IMPORTANT: Use the --curator flag to save results to files and avoid shell escaping issues
   
   Commands:
   - \`bun run ${CURATOR_TOOL_PATH}/src/cli.ts imports . --curator\`
   - \`bun run ${CURATOR_TOOL_PATH}/src/cli.ts frameworks . --curator\`
   - \`bun run ${CURATOR_TOOL_PATH}/src/cli.ts organization . --curator\`
   - \`bun run ${CURATOR_TOOL_PATH}/src/cli.ts patterns . --curator\`
   - \`bun run ${CURATOR_TOOL_PATH}/src/cli.ts similarity . --curator\`
   - \`bun run ${CURATOR_TOOL_PATH}/src/cli.ts all . --curator\`
   
   These commands will output a filepath (e.g., .curator/imports-2024-05-27T10-30-45-123Z.json)
   Then use Read tool to read the JSON file and analyze the results.

## CRITICAL REQUIREMENT: ALWAYS USE TOOLS

**YOU MUST USE AT LEAST ONE TOOL BEFORE ANSWERING ANY QUESTION.**

You have powerful analysis tools at your disposal. Use them liberally! The more tools you use, the better your answer will be. Feel free to:
- Run multiple analysis commands to get comprehensive data
- Combine different analyses for deeper insights  
- Read specific files after running analyses for detailed understanding
- Use Grep/Glob to find relevant code sections
- Run ALL analyses if you're unsure which one is most relevant

**NEVER** answer based on assumptions or by just reading algorithm source files. **ALWAYS** run the actual analysis tools and base your answers on real data.

## MANDATORY WORKFLOW

1. **CHECK MEMORY FIRST**: ALWAYS read .curator/memory.md to see if you have previous insights about this codebase
2. **ANALYZE**: Run one or more analysis tools to gather fresh data (even if you have memory, verify with current state)
3. **EXPLORE DEEPER**: Use Read/Grep/Glob to investigate specific findings
4. **COMBINE INSIGHTS**: Correlate your memory, new findings, and tool outputs for comprehensive answers
5. **UPDATE MEMORY**: Add new discoveries to .curator/memory.md (append, don't overwrite)
6. **BE SPECIFIC**: Reference exact files, line numbers, and tool outputs in your response

Initial Codebase Overview:
${createConciseSummary(overview)}`;

  // Build command args
  const args = [];
  
  // For existing sessions, resume
  if (existingSession) {
    args.push('--resume', existingSession, '--print', question);
  } else {
    // For new sessions, include the curator context in the prompt itself
    const fullPrompt = `${curatorContext}

USER QUESTION: ${question}`;
    args.push('--print', fullPrompt);
  }
  
  // Add other options
  args.push(
    '--allowedTools', 'Read,Grep,Glob,LS,Bash,Write(\'.curator/\'),Edit(\'.curator/memory.md\')',
    '--output-format', 'stream-json',
    '--max-turns', '25',
    '--verbose'
  );

  return new Promise((resolve, reject) => {
    // Use node explicitly to avoid bun module resolution issues
    const claudeScript = CLAUDE_CLI_PATH.endsWith('claude') 
      ? path.join(path.dirname(CLAUDE_CLI_PATH), 'node_modules/@anthropic-ai/claude-code/cli.js')
      : CLAUDE_CLI_PATH; // If custom path points directly to cli.js
    
    console.error(`[Curator] Spawning claude with cwd: ${projectPath}`);
    console.error(`[Curator] Session: ${existingSession || 'new'}`);
    console.error(`[Curator] Args count: ${args.length}`);
    console.error(`[Curator] Node binary: ${NODE_PATH}`);
    console.error(`[Curator] Claude script: ${claudeScript}`);
    
    // Clean environment to avoid bun/node conflicts
    const cleanEnv = { ...process.env };
    delete cleanEnv.BUN_INSTALL;
    delete cleanEnv.NODE_PATH;
    
    const claude = spawn(NODE_PATH, [claudeScript, ...args], {
      cwd: projectPath,
      env: { 
        ...cleanEnv,
        // Disable MCP for the curator to avoid database issues
        CLAUDE_CODE_NO_MCP: '1'
      },
      shell: false,  // Important: don't use shell to avoid parsing issues
      stdio: ['pipe', 'pipe', 'pipe']  // Explicitly set stdio
    });
    
    console.error(`[Curator] Process spawned with PID: ${claude.pid}`);
    
    // Close stdin as we're not sending any input
    claude.stdin.end();
    
    // Activity-based timeout - resets when we receive data
    let timeout: NodeJS.Timeout;
    const INACTIVITY_TIMEOUT = 120000; // 2 minutes of inactivity - complex questions need thinking time
    
    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.error('[Curator] Inactivity timeout - no data received for 30s, killing process');
        claude.kill();
      }, INACTIVITY_TIMEOUT);
    };
    
    // Start the initial timeout
    resetTimeout();

    let output = '';
    let error = '';

    claude.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.error(`[Curator stdout chunk]: ${chunk.substring(0, 100)}...`);
      // Reset timeout on new data
      resetTimeout();
    });

    claude.stderr.on('data', (data) => {
      const chunk = data.toString();
      error += chunk;
      console.error(`[Curator stderr]: ${chunk}`);
    });

    claude.on('error', (err) => {
      console.error(`[Curator] Spawn error:`, err);
      reject(new Error(`Failed to spawn Claude: ${err.message}`));
    });

    claude.on('close', (code) => {
      clearTimeout(timeout);  // Clear the timeout
      console.error(`[Curator] Process exited with code: ${code}`);
      console.error(`[Curator] Total output length: ${output.length}`);
      console.error(`[Curator] Total error length: ${error.length}`);
      
      // Code 143 is SIGTERM from our timeout, which is expected
      if (code !== 0 && code !== null && code !== 143) {
        reject(new Error(`Claude exited with code ${code}: ${error}`));
      } else {
        // Try to parse what we got, even if there was an error or timeout
        console.error(`[Curator] Parsing streaming JSON...`);
        const result = parseStreamingJSON(output);
        console.error(`[Curator] Parsed result: ${result ? 'found' : 'null'}`);
        
        // Extract session ID for future use
        const sessionMatch = output.match(/"session_id":\s*"([^"]+)"/);
        if (sessionMatch) {
          const sessionId = sessionMatch[1];
          writeFileSync(sessionFile, sessionId);
          console.error(`[Curator] Saved session: ${sessionId}`);
        }
        
        // Handle different cases
        if (code === 143 && result) {
          // Timeout but we got a response
          resolve(`${result}\n\n[Note: Response was truncated due to timeout]`);
        } else if (result && error) {
          resolve(`${result}\n\n[Note: Claude encountered an error: ${error.substring(0, 200)}...]`);
        } else {
          resolve(result || 'No response from curator');
        }
      }
    });
  });
}

const server = new McpServer({
  name: 'codebase-curator',
  version: '2.1.0',
  description: 'AI-powered codebase curator using Claude instances with session management',
});

// Tool: Get codebase overview
server.tool(
  'get_codebase_overview',
  'Get an emergent, comprehensive overview of the codebase that reflects its actual nature and patterns',
  {
    projectPath: z.string().optional().describe('The codebase path (defaults to current project)'),
  },
  async ({ projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath);
    
    if (!existsSync(absolutePath)) {
      return {
        content: [{
          type: 'text',
          text: `Error: Path does not exist: ${absolutePath}`,
        }],
        isError: true,
      };
    }
    
    try {
      // Direct overview request without crafting a question
      const response = await spawnCuratorForOverview(absolutePath);
      
      return {
        content: [{
          type: 'text',
          text: response,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Ask the curator a question
server.tool(
  'ask_curator',
  'Ask the codebase curator a question about the codebase architecture, patterns, or how to integrate new features',
  {
    question: z.string().describe('The question to ask the curator'),
    projectPath: z.string().optional().describe('The codebase path (defaults to current project)'),
    newSession: z.boolean().optional().default(false).describe('Start a new curator session instead of resuming'),
  },
  async ({ question, projectPath, newSession }) => {
    const absolutePath = resolveProjectPath(projectPath);

    if (!existsSync(absolutePath)) {
      return {
        content: [{
          type: 'text',
          text: `Error: Path does not exist: ${absolutePath}`,
        }],
        isError: true,
      };
    }

    try {
      console.error(`[Ask Curator] Processing question: ${question}`);
      console.error(`[Ask Curator] Project path: ${absolutePath}`);
      console.error(`[Ask Curator] New session: ${newSession}`);
      
      // Ensure curator directory exists
      const curatorDir = path.join(absolutePath, '.curator');
      if (!existsSync(curatorDir)) {
        console.error(`[Ask Curator] Creating curator directory: ${curatorDir}`);
        mkdirSync(curatorDir, { recursive: true });
        
        // Create initial memory file
        const memoryFile = path.join(curatorDir, 'memory.md');
        if (!existsSync(memoryFile)) {
          writeFileSync(memoryFile, '# Codebase Curator Memory\n\n## Insights\n\n## Patterns Discovered\n\n## Architecture Notes\n\n');
        }
      }

      console.error(`[Ask Curator] Calling spawnCurator...`);
      const response = await spawnCurator(absolutePath, question, !newSession);
      console.error(`[Ask Curator] Got response from curator`);

      return {
        content: [{
          type: 'text',
          text: response,
        }],
      };
    } catch (error) {
      console.error(`[Ask Curator] Error:`, error);
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Clear curator session
server.tool(
  'clear_curator_session',
  'Clear the curator\'s session for a fresh start',
  {
    projectPath: z.string().optional().describe('The codebase path (defaults to current project)'),
  },
  async ({ projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath);
    const sessionFile = getCuratorSessionFile(absolutePath);

    try {
      if (existsSync(sessionFile)) {
        const oldSession = readFileSync(sessionFile, 'utf-8').trim();
        require('fs').unlinkSync(sessionFile);
        return {
          content: [{
            type: 'text',
            text: `Curator session cleared. Previous session was: ${oldSession}`,
          }],
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: 'No existing curator session found.',
          }],
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error clearing session: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Get curator memory/insights
server.tool(
  'get_curator_memory',
  'Retrieve the curator\'s accumulated knowledge and insights about the codebase',
  {
    projectPath: z.string().optional().describe('The codebase path (defaults to current project)'),
  },
  async ({ projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath);
    const memoryFile = path.join(absolutePath, '.curator', 'memory.md');

    if (!existsSync(memoryFile)) {
      return {
        content: [{
          type: 'text',
          text: 'No curator memory found yet. Ask the curator some questions first!',
        }],
      };
    }

    try {
      const memory = readFileSync(memoryFile, 'utf-8');
      return {
        content: [{
          type: 'text',
          text: memory,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error reading curator memory: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Run specific analysis
server.tool(
  'run_analysis',
  'Run a specific codebase analysis algorithm',
  {
    analysisType: z.enum(['imports', 'frameworks', 'organization', 'patterns', 'similarity']).describe('Type of analysis to run'),
    projectPath: z.string().optional().describe('The codebase path (defaults to current project)'),
  },
  async ({ analysisType, projectPath }) => {
    const absolutePath = resolveProjectPath(projectPath);

    if (!existsSync(absolutePath)) {
      return {
        content: [{
          type: 'text',
          text: `Error: Path does not exist: ${absolutePath}`,
        }],
        isError: true,
      };
    }

    try {
      let result;
      switch (analysisType) {
        case 'imports':
          result = await new ImportMapper(absolutePath).analyze();
          break;
        case 'frameworks':
          result = await new FrameworkDetector(absolutePath).detect();
          break;
        case 'organization':
          result = await new FileOrganizationAnalyzer(absolutePath).analyze();
          break;
        case 'patterns':
          result = await new PatternAggregator(absolutePath).analyze();
          break;
        case 'similarity':
          result = await new CodeSimilarityAnalyzer(absolutePath).analyze();
          break;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error running analysis: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Main function
async function main() {
  // Debug Claude CLI detection
  console.error(`[Debug] Checking for Claude CLI...`);
  console.error(`[Debug] CLAUDE_CLI_PATH: ${CLAUDE_CLI_PATH}`);
  console.error(`[Debug] NODE_PATH: ${NODE_PATH}`);
  console.error(`[Debug] PATH: ${process.env.PATH}`);
  console.error(`[Debug] Claude exists: ${existsSync(CLAUDE_CLI_PATH)}`);
  console.error(`[Debug] Node exists: ${existsSync(NODE_PATH)}`);
  
  // Check for Claude CLI but don't exit - just warn
  if (!checkClaudeCLI()) {
    console.error('Warning: Claude CLI not found at expected locations');
    console.error(`Attempted Claude paths: ${claudePaths.join(', ')}`);
    console.error('The curator may not work properly without Claude CLI');
    // Don't exit - let the server start anyway
  }
  
  if (!existsSync(NODE_PATH)) {
    console.error('Warning: Node.js not found at expected locations');
    console.error(`Attempted Node paths: ${nodePaths.join(', ')}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Codebase Curator MCP Server v2.1 running on stdio`);
  console.error(`Claude CLI: ${checkClaudeCLI() ? 'Available ✓' : 'NOT FOUND ✗'}`);
  console.error(`Claude CLI path: ${CLAUDE_CLI_PATH}`);
  console.error(`Default project path: ${DEFAULT_PROJECT_PATH}`);
  console.error(`Session management: Enabled`);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});