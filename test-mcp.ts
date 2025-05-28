#!/usr/bin/env bun

/**
 * MCP Server Integration Test
 * Tests all 9 MCP tools systematically
 */

import { spawn } from 'child_process'
import { resolve } from 'path'

const TEST_PROJECT = '/Users/rusty/Documents/Projects/AI/Tools/project-planner'

interface MCPRequest {
  jsonrpc: '2.0'
  method: string
  params: any
  id: number
}

interface MCPResponse {
  jsonrpc: '2.0'
  result?: any
  error?: any
  id: number
}

class MCPClient {
  private proc: any
  private buffer = ''
  private requestId = 0
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>()

  async start() {
    console.log('🚀 Starting MCP server...\n')
    
    this.proc = spawn('bun', ['run', 'src/presentation/mcp/server.ts'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    })

    this.proc.stdout.on('data', (data: Buffer) => {
      this.buffer += data.toString()
      this.processBuffer()
    })

    this.proc.stderr.on('data', (data: Buffer) => {
      console.error('[MCP stderr]:', data.toString())
    })

    // Initialize connection
    await this.sendRequest('initialize', {
      protocolVersion: '0.1.0',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    })
  }

  private processBuffer() {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as MCPResponse
          const pending = this.pendingRequests.get(response.id)
          if (pending) {
            this.pendingRequests.delete(response.id)
            if (response.error) {
              pending.reject(new Error(response.error.message))
            } else {
              pending.resolve(response.result)
            }
          }
        } catch (e) {
          // Not JSON, ignore
        }
      }
    }
  }

  async sendRequest(method: string, params: any): Promise<any> {
    const id = ++this.requestId
    const request: MCPRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      this.proc.stdin.write(JSON.stringify(request) + '\n')
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request ${method} timed out`))
        }
      }, 30000)
    })
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.sendRequest('tools/call', {
      name,
      arguments: args
    })
  }

  stop() {
    this.proc.kill()
  }
}

async function testTool(client: MCPClient, name: string, args: any, description: string) {
  console.log(`\n🧪 Testing ${name}...`)
  console.log(`   ${description}`)
  
  try {
    const start = Date.now()
    const result = await client.callTool(name, args)
    const duration = Date.now() - start
    
    console.log(`✅ Success (${duration}ms)`)
    
    // Show preview of results
    if (result.content?.[0]?.text) {
      const text = result.content[0].text
      const preview = text.substring(0, 200) + (text.length > 200 ? '...' : '')
      console.log(`   Preview: ${preview}`)
    }
    
    return result
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`)
    return null
  }
}

async function main() {
  const client = new MCPClient()
  
  try {
    await client.start()
    console.log('✅ MCP server started successfully\n')
    
    console.log('='.repeat(80))
    console.log('🧪 TESTING ALL 9 MCP TOOLS')
    console.log(`📁 Test Project: ${TEST_PROJECT}`)
    console.log('='.repeat(80))

    // Tool 1: get_codebase_overview
    await testTool(
      client,
      'get_codebase_overview',
      { projectPath: TEST_PROJECT },
      'Get a comprehensive overview of the codebase'
    )

    // Tool 2: ask_curator
    await testTool(
      client,
      'ask_curator',
      { 
        question: 'What testing framework does this project use?',
        projectPath: TEST_PROJECT,
        newSession: true
      },
      'Ask the curator a question about the codebase'
    )

    // Tool 3: add_new_feature
    await testTool(
      client,
      'add_new_feature',
      {
        feature: 'Add user authentication with JWT tokens',
        projectPath: TEST_PROJECT
      },
      'Get guidance for adding a new feature'
    )

    // Tool 4: implement_change
    await testTool(
      client,
      'implement_change',
      {
        change: 'Fix the date formatting bug in reports',
        projectPath: TEST_PROJECT
      },
      'Get guidance for implementing a change'
    )

    // Tool 5: run_analysis
    console.log('\n📊 Testing analysis tools...')
    
    for (const analysisType of ['imports', 'frameworks', 'organization', 'patterns', 'similarity']) {
      await testTool(
        client,
        'run_analysis',
        {
          analysisType,
          projectPath: TEST_PROJECT
        },
        `Run ${analysisType} analysis`
      )
    }

    // Tool 6: get_curator_memory
    await testTool(
      client,
      'get_curator_memory',
      { projectPath: TEST_PROJECT },
      'Retrieve curator memory and insights'
    )

    // Tool 7: clear_curator_session
    await testTool(
      client,
      'clear_curator_session',
      { projectPath: TEST_PROJECT },
      'Clear the curator session'
    )

    // Tool 8: get_cache_stats
    await testTool(
      client,
      'get_cache_stats',
      {},
      'Get cache statistics'
    )

    // Tool 9: get_context_management_help
    await testTool(
      client,
      'get_context_management_help',
      {},
      'Get context management help'
    )

    console.log('\n' + '='.repeat(80))
    console.log('✅ ALL TESTS COMPLETED!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('Fatal error:', error)
  } finally {
    client.stop()
    process.exit(0)
  }
}

main().catch(console.error)