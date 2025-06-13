/**
 * Flow Tracer - Tracks data flow through the codebase
 * Uses semantic index data to trace how values move through functions
 */

import type { SemanticIndex, SemanticInfo, CrossReference } from './types/semantic'
import type { FlowNode, FlowPath } from './types/flow'

export class FlowTracer {
  constructor(private index: SemanticIndex) {}

  /**
   * Trace the flow of a variable/value through the codebase
   */
  async traceFlow(searchTerm: string): Promise<FlowPath> {
    const nodes: FlowNode[] = []
    const visited = new Set<string>()
    const filesTraversed = new Set<string>()
    const functionsInvolved = new Set<string>()

    // Find all occurrences of the term
    const results = this.index.search(searchTerm, { maxResults: 1000 })

    // Build initial nodes from search results
    for (const result of results) {
      const nodeId = `${result.info.location.file}:${result.info.location.line}`
      if (visited.has(nodeId)) continue
      visited.add(nodeId)

      const node = this.createFlowNode(result.info, searchTerm)
      nodes.push(node)
      filesTraversed.add(result.info.location.file)

      // Track function if we can identify it
      const funcName = this.extractFunctionName(result.info)
      if (funcName) functionsInvolved.add(funcName)
    }

    // Connect nodes based on data flow patterns
    this.connectFlowNodes(nodes, searchTerm)

    // Sort nodes by likely execution order
    const sortedNodes = this.sortByDataFlow(nodes)

    return {
      startTerm: searchTerm,
      nodes: sortedNodes,
      summary: {
        filesTraversed: Array.from(filesTraversed),
        functionsInvolved: Array.from(functionsInvolved),
        totalSteps: nodes.length,
      },
    }
  }

  /**
   * Create a flow node from semantic info
   */
  private createFlowNode(info: SemanticInfo, searchTerm: string): FlowNode {
    const type = this.determineFlowType(info, searchTerm)

    return {
      id: `${info.location.file}:${info.location.line}`,
      type,
      location: info.location,
      code: info.context.trim(),
      term: info.term,
      metadata: {
        functionName: this.extractFunctionName(info),
        variableName: this.extractVariableName(info, searchTerm),
      },
      children: [],
    }
  }

  /**
   * Determine the type of flow node based on context
   */
  private determineFlowType(
    info: SemanticInfo,
    searchTerm: string
  ): FlowNode['type'] {
    const code = info.context.toLowerCase()
    const term = searchTerm.toLowerCase()

    // Check for function parameters
    if (info.type === 'function' && code.includes(`(`) && code.includes(term)) {
      return 'parameter'
    }

    // Check for assignments
    if (code.includes('=') && !code.includes('==') && !code.includes('=>')) {
      const beforeEquals = code.substring(0, code.indexOf('='))
      const afterEquals = code.substring(code.indexOf('=') + 1)

      if (beforeEquals.includes(term)) {
        return 'assignment'
      } else if (afterEquals.includes(term)) {
        return 'usage'
      }
    }

    // Check for function calls
    if (code.includes('(') && code.includes(')')) {
      const beforeParen = code.substring(0, code.indexOf('('))
      const inParen = code.substring(code.indexOf('('), code.lastIndexOf(')'))

      if (inParen.includes(term)) {
        return 'call'
      }
    }

    // Check for returns
    if (code.includes('return') && code.includes(term)) {
      return 'return'
    }

    // Check for destructuring or property access
    if (code.includes('{') && code.includes('}') && code.includes(term)) {
      return 'input'
    }

    return 'usage'
  }

  /**
   * Extract function name from context
   */
  private extractFunctionName(info: SemanticInfo): string | undefined {
    // Look in surrounding lines for function declaration
    if (info.surroundingLines && info.surroundingLines.length > 0) {
      for (const line of info.surroundingLines) {
        // Match various function patterns
        const patterns = [
          /function\s+(\w+)/,
          /(\w+)\s*:\s*function/,
          /(\w+)\s*=\s*function/,
          /(\w+)\s*=\s*\(/,
          /(\w+)\s*:\s*\(/,
          /async\s+(\w+)/,
          /export\s+function\s+(\w+)/,
          /export\s+async\s+function\s+(\w+)/,
          /const\s+(\w+)\s*=\s*async/,
          /class\s+\w+\s*{[\s\S]*?(\w+)\s*\(/,
        ]

        for (const pattern of patterns) {
          const match = line.match(pattern)
          if (match && match[1]) {
            return match[1]
          }
        }
      }
    }

    return undefined
  }

  /**
   * Extract variable name from context
   */
  private extractVariableName(
    info: SemanticInfo,
    searchTerm: string
  ): string | undefined {
    const code = info.context

    // Match patterns like: const email = user.email
    const assignmentPattern = new RegExp(`(\\w+)\\s*=\\s*[^=]*${searchTerm}`)
    const match = code.match(assignmentPattern)
    if (match && match[1]) {
      return match[1]
    }

    // Match destructuring: const { email } = user
    const destructurePattern = new RegExp(`{[^}]*\\b(${searchTerm})\\b[^}]*}`)
    const destructMatch = code.match(destructurePattern)
    if (destructMatch) {
      return searchTerm
    }

    return undefined
  }

  /**
   * Connect flow nodes based on data flow patterns
   */
  private connectFlowNodes(nodes: FlowNode[], searchTerm: string): void {
    // Get all cross-references for related terms
    const refs = this.index.getReferences(searchTerm)

    // Build a map for quick lookup
    const nodeMap = new Map<string, FlowNode>()
    nodes.forEach((node) => nodeMap.set(node.id, node))

    // Connect based on cross-references
    for (const ref of refs) {
      const fromId = `${ref.fromLocation.file}:${ref.fromLocation.line}`
      const fromNode = nodeMap.get(fromId)

      if (fromNode) {
        // Find target nodes that might receive this data
        for (const node of nodes) {
          if (this.isDataFlowTarget(fromNode, node, ref)) {
            fromNode.children.push(node)
          }
        }
      }
    }
  }

  /**
   * Check if one node flows data to another
   */
  private isDataFlowTarget(
    from: FlowNode,
    to: FlowNode,
    ref: CrossReference
  ): boolean {
    // Same file, nearby lines (likely in same function)
    if (from.location.file === to.location.file) {
      const lineDiff = Math.abs(from.location.line - to.location.line)
      if (lineDiff > 0 && lineDiff < 20) {
        return true
      }
    }

    // Cross-file: check if it's a function call passing data
    if (ref.referenceType === 'call' && to.type === 'parameter') {
      return true
    }

    return false
  }

  /**
   * Sort nodes by likely execution order
   */
  private sortByDataFlow(nodes: FlowNode[]): FlowNode[] {
    // Simple topological sort based on connections
    const sorted: FlowNode[] = []
    const visited = new Set<string>()

    // Find root nodes (no incoming edges)
    const roots = nodes.filter((node) => {
      return !nodes.some((other) => other.children.includes(node))
    })

    // DFS from each root
    const visit = (node: FlowNode) => {
      if (visited.has(node.id)) return
      visited.add(node.id)

      for (const child of node.children) {
        visit(child)
      }

      sorted.unshift(node) // Add to beginning for correct order
    }

    // Start from roots
    roots.forEach(visit)

    // Add any unvisited nodes (cycles or disconnected)
    nodes.forEach((node) => {
      if (!visited.has(node.id)) {
        sorted.push(node)
      }
    })

    return sorted
  }

  /**
   * Format flow path for display
   */
  formatFlowPath(path: FlowPath): string {
    let output = `📊 Data Flow Analysis: ${path.startTerm}\n`
    output += `${'━'.repeat(50)}\n\n`

    path.nodes.forEach((node, index) => {
      const typeIcon = this.getFlowTypeIcon(node.type)
      const stepNumber = index + 1

      output += `${stepNumber}. ${typeIcon} ${node.type.toUpperCase()}: ${
        node.location.file
      }:${node.location.line}\n`
      output += `   ${node.code}\n`

      if (node.metadata?.functionName) {
        output += `   └─ in function: ${node.metadata.functionName}()\n`
      }

      if (node.children.length > 0) {
        output += `   ➡️  flows to ${node.children.length} location(s)\n`
      }

      output += '\n'
    })

    output += `📈 Summary:\n`
    output += `   • Files traversed: ${path.summary.filesTraversed.length}\n`
    output += `   • Functions involved: ${path.summary.functionsInvolved.length}\n`
    output += `   • Total steps: ${path.summary.totalSteps}\n`

    return output
  }

  private getFlowTypeIcon(type: FlowNode['type']): string {
    const icons: Record<FlowNode['type'], string> = {
      input: '📥',
      assignment: '📝',
      parameter: '🔄',
      call: '📞',
      return: '📤',
      usage: '🔍',
    }
    return icons[type] || '•'
  }
}
