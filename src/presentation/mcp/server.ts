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
import { createCuratorService } from '../../core'
import type { CuratorService } from '../../core'

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
      description: 'Get a comprehensive, practical overview of how the codebase actually works',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the project (defaults to current directory)',
          },
        },
      },
    },
    {
      name: 'ask_curator',
      description: 'Ask questions about the codebase architecture, patterns, or implementation details',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Your question about the codebase',
          },
          projectPath: {
            type: 'string',
            description: 'Path to the project (defaults to current directory)',
          },
          newSession: {
            type: 'boolean',
            description: 'Start a new session instead of continuing existing one',
            default: false,
          },
        },
        required: ['question'],
      },
    },
    {
      name: 'add_new_feature',
      description: 'Get comprehensive guidance for implementing a new feature in the codebase',
      inputSchema: {
        type: 'object',
        properties: {
          feature: {
            type: 'string',
            description: 'Description of the feature to implement',
          },
          projectPath: {
            type: 'string',
            description: 'Path to the project (defaults to current directory)',
          },
        },
        required: ['feature'],
      },
    },
    {
      name: 'implement_change',
      description: 'Get focused action plan for implementing a specific change or fix',
      inputSchema: {
        type: 'object',
        properties: {
          change: {
            type: 'string',
            description: 'Description of the change or fix to implement',
          },
          projectPath: {
            type: 'string',
            description: 'Path to the project (defaults to current directory)',
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
      name: 'run_analysis',
      description: 'Run a specific codebase analysis algorithm',
      inputSchema: {
        type: 'object',
        properties: {
          analysisType: {
            type: 'string',
            enum: ['imports', 'frameworks', 'organization', 'patterns', 'similarity'],
            description: 'Type of analysis to run',
          },
          projectPath: {
            type: 'string',
            description: 'Path to the project (defaults to current directory)',
          },
        },
        required: ['analysisType'],
      },
    },
    {
      name: 'get_curator_memory',
      description: 'Retrieve the curator\'s accumulated knowledge and insights about the codebase',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the project (defaults to current directory)',
          },
        },
      },
    },
    {
      name: 'clear_curator_session',
      description: 'Clear the curator\'s session for a fresh start',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the project (defaults to current directory)',
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
      description: 'Learn how to use the /compact command to preserve context when approaching token limits',
      inputSchema: {
        type: 'object',
        properties: {},
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
        const result = await curator.getOverview(args.projectPath)
        return {
          content: [{ type: 'text', text: result }],
        }
      }
      
      case 'ask_curator': {
        const response = await curator.askCurator({
          question: args.question,
          projectPath: args.projectPath || process.cwd(),
          newSession: args.newSession,
        })
        return {
          content: [{ type: 'text', text: response.content }],
        }
      }
      
      case 'add_new_feature': {
        const result = await curator.addNewFeature({
          feature: args.feature,
          projectPath: args.projectPath || process.cwd(),
        })
        return {
          content: [{ type: 'text', text: result }],
        }
      }
      
      case 'implement_change': {
        const result = await curator.implementChange({
          change: args.change,
          projectPath: args.projectPath || process.cwd(),
          scope: args.scope,
        })
        return {
          content: [{ type: 'text', text: result }],
        }
      }
      
      case 'run_analysis': {
        const result = await curator.runAnalysis({
          type: args.analysisType,
          projectPath: args.projectPath || process.cwd(),
        })
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }
      
      case 'get_curator_memory': {
        const result = await curator.getCuratorMemory(args.projectPath)
        return {
          content: [{ type: 'text', text: result }],
        }
      }
      
      case 'clear_curator_session': {
        await curator.clearSession(args.projectPath)
        return {
          content: [
            {
              type: 'text',
              text: 'Curator session cleared successfully.',
            },
          ],
        }
      }
      
      case 'get_cache_stats': {
        const stats = curator.getCacheStats()
        return {
          content: [
            {
              type: 'text',
              text: `Cache Statistics:\n${JSON.stringify(stats, null, 2)}`,
            },
          ],
        }
      }
      
      case 'get_context_management_help': {
        // Import ContextManager to get the help text
        const { ContextManager } = await import('../../services/contextManager')
        const contextManager = new ContextManager()
        const explanation = contextManager.getCompactSystemExplanation()
        return {
          content: [
            {
              type: 'text',
              text: explanation,
            },
          ],
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
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
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