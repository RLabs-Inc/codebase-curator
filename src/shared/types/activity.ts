/**
 * Activity tracking types for curator operations
 * Supports hierarchical tracking with parent_tool_use_id
 */

export interface ActivityNode {
  id: string
  parent_tool_use_id?: string
  type: 'task' | 'tool_use' | 'message' | 'thinking'
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime: number
  endTime?: number
  duration?: number
  
  // Tool-specific data
  tool?: {
    name: string
    input?: any
    output?: any
    error?: string
  }
  
  // Message data
  message?: {
    role: 'user' | 'assistant'
    content: string
    preview?: string
  }
  
  // Nested activities
  children: ActivityNode[]
  
  // Metadata
  metadata?: {
    sessionId?: string
    turnNumber?: number
    tokenCount?: number
    [key: string]: any
  }
}

export interface ActivityTree {
  rootNodes: ActivityNode[]
  nodeMap: Map<string, ActivityNode>
  activeNodes: Set<string>
  
  // Stats
  stats: {
    totalNodes: number
    completedNodes: number
    failedNodes: number
    totalDuration: number
    toolUsage: Map<string, number>
  }
}

export interface StreamingActivity {
  type: 'activity_update'
  activity: ActivityNode
  event: 'start' | 'update' | 'complete' | 'error'
  timestamp: number
}

export class ActivityTracker {
  private tree: ActivityTree = {
    rootNodes: [],
    nodeMap: new Map(),
    activeNodes: new Set(),
    stats: {
      totalNodes: 0,
      completedNodes: 0,
      failedNodes: 0,
      totalDuration: 0,
      toolUsage: new Map()
    }
  }
  
  addActivity(activity: Partial<ActivityNode> & { id: string }): ActivityNode {
    const node: ActivityNode = {
      status: 'pending',
      startTime: Date.now(),
      children: [],
      ...activity
    }
    
    this.tree.nodeMap.set(node.id, node)
    this.tree.stats.totalNodes++
    
    if (node.parent_tool_use_id && this.tree.nodeMap.has(node.parent_tool_use_id)) {
      const parent = this.tree.nodeMap.get(node.parent_tool_use_id)!
      parent.children.push(node)
    } else {
      this.tree.rootNodes.push(node)
    }
    
    if (node.tool?.name) {
      const count = this.tree.stats.toolUsage.get(node.tool.name) || 0
      this.tree.stats.toolUsage.set(node.tool.name, count + 1)
    }
    
    return node
  }
  
  updateActivity(id: string, updates: Partial<ActivityNode>): void {
    const node = this.tree.nodeMap.get(id)
    if (!node) return
    
    Object.assign(node, updates)
    
    if (updates.status === 'running') {
      this.tree.activeNodes.add(id)
    } else if (updates.status === 'completed' || updates.status === 'failed') {
      this.tree.activeNodes.delete(id)
      node.endTime = Date.now()
      node.duration = node.endTime - node.startTime
      
      if (updates.status === 'completed') {
        this.tree.stats.completedNodes++
      } else {
        this.tree.stats.failedNodes++
      }
      
      this.tree.stats.totalDuration += node.duration
    }
  }
  
  getTree(): ActivityTree {
    return this.tree
  }
  
  getActiveNodes(): ActivityNode[] {
    return Array.from(this.tree.activeNodes).map(id => this.tree.nodeMap.get(id)!).filter(Boolean)
  }
  
  getNodePath(id: string): ActivityNode[] {
    const path: ActivityNode[] = []
    let node = this.tree.nodeMap.get(id)
    
    while (node) {
      path.unshift(node)
      node = node.parent_tool_use_id ? this.tree.nodeMap.get(node.parent_tool_use_id) : undefined
    }
    
    return path
  }
  
  printTree(node?: ActivityNode, indent = 0): string {
    const nodes = node ? [node] : this.tree.rootNodes
    let output = ''
    
    for (const n of nodes) {
      const prefix = ' '.repeat(indent)
      const status = n.status === 'completed' ? '✅' : 
                    n.status === 'failed' ? '❌' : 
                    n.status === 'running' ? '🔄' : '⏳'
      
      const duration = n.duration ? ` (${(n.duration / 1000).toFixed(1)}s)` : ''
      const toolInfo = n.tool ? ` [${n.tool.name}]` : ''
      
      output += `${prefix}${status} ${n.name}${toolInfo}${duration}\n`
      
      if (n.children.length > 0) {
        for (const child of n.children) {
          output += this.printTree(child, indent + 2)
        }
      }
    }
    
    return output
  }
}