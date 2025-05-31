#!/usr/bin/env bun

/**
 * MCP Server - Thin presentation layer
 * Uses the core curator service for all functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { createCuratorService } from '../core'
import type { CuratorService } from '../core'
import { getCompactSystemExplanation } from '../core/curatorPrompts'

// Server metadata
const serverInfo = {
  name: 'codebase-curator',
  version: '2.3.0',
}

// Initialize core service
const curator: CuratorService = createCuratorService()

// Create MCP server
const server = new Server(serverInfo, {
  capabilities: {
    tools: {},
  },
})

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_codebase_overview',
      description:
        'Get a comprehensive, practical overview of how the codebase actually works. Use set_project_path first or provide projectPath.',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description:
              'Path to the project (optional, uses set_project_path value if not provided)',
          },
        },
      },
    },
    {
      name: 'ask_curator',
      description:
        'Ask questions about the codebase architecture, patterns, or implementation details. Use set_project_path first or provide projectPath.',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Your question about the codebase',
          },
          projectPath: {
            type: 'string',
            description:
              'Path to the project (optional, uses set_project_path value if not provided)',
          },
          newSession: {
            type: 'boolean',
            description:
              'Start a new session instead of continuing existing one',
            default: false,
          },
        },
        required: ['question'],
      },
    },
    {
      name: 'add_new_feature',
      description:
        'Get comprehensive guidance for implementing a new feature in the codebase. Use set_project_path first or provide projectPath.',
      inputSchema: {
        type: 'object',
        properties: {
          feature: {
            type: 'string',
            description: 'Description of the feature to implement',
          },
          projectPath: {
            type: 'string',
            description:
              'Path to the project (optional, uses set_project_path value if not provided)',
          },
        },
        required: ['feature'],
      },
    },
    {
      name: 'implement_change',
      description:
        'Get focused action plan for implementing a specific change or fix. Use set_project_path first or provide projectPath.',
      inputSchema: {
        type: 'object',
        properties: {
          change: {
            type: 'string',
            description: 'Description of the change or fix to implement',
          },
          projectPath: {
            type: 'string',
            description:
              'Path to the project (optional, uses set_project_path value if not provided)',
          },
          scope: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific files or areas to focus on',
          },
        },
        required: ['change'],
      },
    },
    {
      name: 'get_curator_memory',
      description:
        "Retrieve the curator's accumulated knowledge and insights about the codebase. Use set_project_path first or provide projectPath.",
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description:
              'Path to the project (optional, uses set_project_path value if not provided)',
          },
        },
      },
    },
    {
      name: 'clear_curator_session',
      description:
        "Clear the curator's session for a fresh start. Use set_project_path first or provide projectPath.",
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description:
              'Path to the project (optional, uses set_project_path value if not provided)',
          },
        },
      },
    },
    {
      name: 'get_cache_stats',
      description: 'Get cache statistics including hit rates and memory usage',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_context_management_help',
      description:
        'Learn how to use the /compact command to preserve context when approaching token limits',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'set_project_path',
      description: 'Set the project path for all subsequent operations',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the project directory',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'get_project_path',
      description: 'Get the currently set project path',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_curator_activity',
      description: 'View recent curator activity logs',
      inputSchema: {
        type: 'object',
        properties: {
          lines: {
            type: 'number',
            description: 'Number of recent log lines to show (default: 50)',
          },
        },
      },
    },
  ],
}))

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    // Initialize curator if needed
    await curator.initialize()

    switch (name) {
      case 'get_codebase_overview': {
        const result = await curator.getOverview(args?.projectPath as string)
        return {
          content: [{ type: 'text', text: result }],
        }
      }

      case 'ask_curator': {
        const response = await curator.askCurator({
          question: args?.question as string,
          projectPath: args?.projectPath as string,
          newSession: args?.newSession as boolean,
        })
        return {
          content: [{ type: 'text', text: response.content }],
        }
      }

      case 'add_new_feature': {
        const result = await curator.addNewFeature({
          feature: args?.feature as string,
          projectPath: args?.projectPath as string,
        })
        return {
          content: [{ type: 'text', text: result }],
        }
      }

      case 'implement_change': {
        const result = await curator.implementChange({
          change: args?.change as string,
          projectPath: args?.projectPath as string,
          scope: args?.scope as string[],
        })
        return {
          content: [{ type: 'text', text: result }],
        }
      }

      case 'get_curator_memory': {
        const result = await curator.getCuratorMemory(
          args?.projectPath as string
        )
        return {
          content: [{ type: 'text', text: result }],
        }
      }

      case 'clear_curator_session': {
        await curator.clearSession(args?.projectPath as string)
        return {
          content: [
            {
              type: 'text',
              text: 'Curator session cleared successfully.',
            },
          ],
        }
      }

      case 'get_context_management_help': {
        const explanation = getCompactSystemExplanation()
        return {
          content: [
            {
              type: 'text',
              text: explanation,
            },
          ],
        }
      }

      case 'set_project_path': {
        curator.setProjectPath(args?.path as string)
        return {
          content: [
            {
              type: 'text',
              text: `Project path set to: ${args?.path}`,
            },
          ],
        }
      }

      case 'get_project_path': {
        const path = curator.getProjectPath()
        return {
          content: [
            {
              type: 'text',
              text: path || 'No project path set',
            },
          ],
        }
      }

      case 'get_curator_activity': {
        const { join } = await import('path')
        const { existsSync } = await import('fs')
        
        const lines = (args?.lines as number) || 50
        const logsDir = join(process.env.HOME || '', '.codebase-curator', 'logs')
        const today = new Date().toISOString().split('T')[0]
        const logFile = join(logsDir, `curator-activity-${today}.log`)
        
        let content = ''
        if (existsSync(logFile)) {
          // Read last N lines of the log file
          const logContent = await Bun.file(logFile).text()
          const logLines = logContent.trim().split('\n')
          const recentLines = logLines.slice(-lines)
          content = `📄 Recent Curator Activity (last ${lines} lines):\n\n${recentLines.join('\n')}\n\n📁 Full logs at: ${logsDir}`
        } else {
          content = `No curator activity logged today. Activity logs are saved to: ${logsDir}`
        }
        
        return {
          content: [{ type: 'text', text: content }],
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    console.error(`[MCP] Error in ${name}:`, error)
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    }
  }
})

/**
 * Start the server
 */
async function main() {
  console.error('[MCP] Starting Codebase Curator server...')

  try {
    // Initialize curator service
    await curator.initialize()
    console.error('[MCP] Curator service initialized')

    // Start MCP server
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('[MCP] Server connected via stdio')

    // Cleanup on exit
    process.on('SIGINT', async () => {
      console.error('[MCP] Shutting down...')
      await curator.cleanup()
      process.exit(0)
    })
  } catch (error) {
    console.error('[MCP] Failed to start server:', error)
    process.exit(1)
  }
}

// Run the server
main().catch((error) => {
  console.error('[MCP] Fatal error:', error)
  process.exit(1)
})
