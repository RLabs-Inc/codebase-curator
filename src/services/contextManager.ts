import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';
import { Glob } from 'bun';
import type { 
  AnalysisCache, 
  CacheEntry, 
  CacheOptions, 
  FileMetadata, 
  ProjectMetadata,
  HashTreeNode
} from '../types/context';

export class ContextManager {
  private cache: Map<string, AnalysisCache> = new Map();
  private projectMetadata: Map<string, ProjectMetadata> = new Map();
  private cacheDir: string;
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 3600000, // 1 hour default
      maxSize: options.maxSize || 100, // 100MB default
      compressionEnabled: options.compressionEnabled ?? true
    };
    
    // Set cache directory to a writable location
    // Use temp directory when running in restricted environments (like MCP)
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const tempDir = process.env.TMPDIR || process.env.TEMP || '/tmp';
    
    // Try to use home directory first, fallback to temp
    const baseDir = existsSync(homeDir) && homeDir !== '/' ? homeDir : tempDir;
    this.cacheDir = resolve(baseDir, '.codebase-curator-cache');
    
    try {
      if (!existsSync(this.cacheDir)) {
        mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.error(`[ContextManager] Failed to create cache directory at ${this.cacheDir}:`, error);
      console.error(`[ContextManager] Caching will be disabled for this session`);
      this.options.ttl = 0; // Disable caching if we can't write
    }
    
    // Load existing cache from disk
    this.loadPersistedCache();
  }

  /**
   * Get cached analysis results or return null if not found/expired
   */
  async getCachedAnalysis<T>(
    projectPath: string, 
    analysisType: keyof AnalysisCache
  ): Promise<T | null> {
    const cache = this.cache.get(projectPath);
    if (!cache || !cache[analysisType]) return null;

    const entry = cache[analysisType]!;
    
    // Check if cache is expired
    if (Date.now() - entry.timestamp > this.options.ttl) {
      delete cache[analysisType];
      return null;
    }

    // Check if any files have changed
    const hasChanges = await this.detectFileChanges(projectPath, entry.timestamp);
    if (hasChanges) {
      delete cache[analysisType];
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store analysis results in cache
   */
  async setCachedAnalysis<T>(
    projectPath: string, 
    analysisType: keyof AnalysisCache,
    data: T
  ): Promise<void> {
    if (!this.cache.has(projectPath)) {
      this.cache.set(projectPath, {});
    }

    const cache = this.cache.get(projectPath)!;
    const hash = await this.calculateProjectHash(projectPath);
    
    cache[analysisType] = {
      data,
      timestamp: Date.now(),
      hash,
      projectPath
    };

    // Update project metadata
    await this.updateProjectMetadata(projectPath);
    
    // Persist to disk
    await this.persistCache(projectPath);
  }

  /**
   * Get file changes since last analysis
   */
  async getChangedFiles(projectPath: string, since: number): Promise<string[]> {
    const metadata = this.projectMetadata.get(projectPath);
    if (!metadata) return [];

    const changedFiles: string[] = [];
    const currentFiles = await this.scanProjectFiles(projectPath);

    for (const [path, fileMeta] of currentFiles) {
      const oldMeta = metadata.files.get(path);
      if (!oldMeta || oldMeta.hash !== fileMeta.hash || fileMeta.lastModified > since) {
        changedFiles.push(path);
      }
    }

    // Check for deleted files
    for (const [path] of metadata.files) {
      if (!currentFiles.has(path)) {
        changedFiles.push(path);
      }
    }

    return changedFiles;
  }

  /**
   * Clear cache for a specific project or all projects
   */
  clearCache(projectPath?: string): void {
    if (projectPath) {
      this.cache.delete(projectPath);
      this.projectMetadata.delete(projectPath);
      // Remove persisted cache file
      const cacheFile = join(this.cacheDir, `${this.hashPath(projectPath)}.json`);
      if (existsSync(cacheFile)) {
        Bun.write(cacheFile, '');
      }
    } else {
      this.cache.clear();
      this.projectMetadata.clear();
      // Clear all cache files
      const glob = new Glob('*.json');
      for (const file of glob.scanSync(this.cacheDir)) {
        Bun.write(join(this.cacheDir, file), '');
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    projects: number;
    totalSize: number;
    analysisTypes: Record<string, number>;
  } {
    let totalSize = 0;
    const analysisTypes: Record<string, number> = {};

    for (const [_, cache] of this.cache) {
      for (const [type, entry] of Object.entries(cache)) {
        if (entry) {
          totalSize += JSON.stringify(entry.data).length;
          analysisTypes[type] = (analysisTypes[type] || 0) + 1;
        }
      }
    }

    return {
      projects: this.cache.size,
      totalSize: totalSize / 1024 / 1024, // Convert to MB
      analysisTypes
    };
  }

  /**
   * Original compact command functionality
   */
  getCompactSystemExplanation(): string {
    return `# Context Management System

## How It Works
When your context window approaches capacity (below ~25-30%), you can use the /compact command to instruct the summarizer Claude on what to preserve. If you don't act before reaching 0%, the system will auto-compact without your specific instructions, potentially losing important details.

## The /compact Command
Format: /compact <your-instruction-sentence>

The instruction sentence tells the summarizer Claude exactly what information is critical for continuing your work.

## Best Practices for Compact Instructions
1. Be specific about the current task and its requirements
2. List critical files, functions, or code sections by name
3. Mention any unresolved issues or errors being debugged
4. Include key decisions or implementation approaches
5. Reference any complex logic or algorithms being worked on

## Examples of Effective Instructions
- "Keep all implementation details of the Context Management System including the MCP tool integration, Bun file API usage patterns, and the current debugging of the server.ts integration at line 594"
- "Preserve the complete Redux migration strategy, all modified files in src/store/*, the circular dependency issue in userSlice.ts, and the test failures in auth.test.ts"
- "Maintain full context of the WebSocket implementation bug, the race condition in handleMessage(), all console logs showing the error sequence, and the proposed fix using mutex locks"

## Your Turn
Based on our current conversation, analyze what's critical and provide a single instruction sentence that the user can copy and use with the /compact command. Focus on:
- The specific task/feature being implemented
- Any bugs or issues being resolved
- Key files and their modifications
- Important decisions or approaches taken
- Any context needed to continue seamlessly

Generate your instruction sentence now, and I'll format it for easy copying.`;
  }

  // Private helper methods

  private async detectFileChanges(projectPath: string, since: number): Promise<boolean> {
    const metadata = this.projectMetadata.get(projectPath);
    if (!metadata) return true; // No metadata means we should re-analyze

    // Use hash tree for efficient change detection
    if (metadata.hashTree) {
      const changedFiles = await this.detectChangesWithHashTree(projectPath, metadata.hashTree);
      return changedFiles.length > 0;
    }

    // Fallback to full scan if no hash tree
    const currentFiles = await this.scanProjectFiles(projectPath);
    
    // Quick check: different number of files
    if (currentFiles.size !== metadata.files.size) return true;

    // Check each file
    for (const [path, fileMeta] of currentFiles) {
      const oldMeta = metadata.files.get(path);
      if (!oldMeta || oldMeta.hash !== fileMeta.hash || fileMeta.lastModified > since) {
        return true;
      }
    }

    return false;
  }

  private async scanProjectFiles(projectPath: string): Promise<Map<string, FileMetadata>> {
    const files = new Map<string, FileMetadata>();
    const patterns = ['**/*.{ts,tsx,js,jsx,mjs}'];
    
    for (const pattern of patterns) {
      const glob = new Glob(pattern);
      
      for await (const file of glob.scan({
        cwd: projectPath,
        absolute: true,
        onlyFiles: true,
        followSymlinks: false
      })) {
        if (this.shouldSkipFile(file)) continue;
        
        try {
          const stat = statSync(file);
          const content = await Bun.file(file).text();
          // Use Bun's fast hash instead of crypto
          const hash = Bun.hash(content).toString();
          
          files.set(file, {
            path: file,
            hash,
            lastModified: stat.mtimeMs,
            size: stat.size
          });
        } catch (e) {
          // Skip files we can't read
        }
      }
    }
    
    return files;
  }

  private shouldSkipFile(path: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.curator/cache'
    ];
    
    return skipPatterns.some(pattern => path.includes(pattern));
  }

  private async calculateProjectHash(projectPath: string): Promise<string> {
    const files = await this.scanProjectFiles(projectPath);
    const hashes = Array.from(files.values())
      .map(f => f.hash)
      .sort()
      .join('');
    
    return createHash('md5').update(hashes).digest('hex');
  }

  private async updateProjectMetadata(projectPath: string): Promise<void> {
    const files = await this.scanProjectFiles(projectPath);
    const hashTree = await this.buildHashTree(projectPath, files);
    
    this.projectMetadata.set(projectPath, {
      path: projectPath,
      fileCount: files.size,
      lastAnalyzed: Date.now(),
      files,
      hashTree
    });
  }

  /**
   * Build a hierarchical hash tree for efficient change detection
   */
  private async buildHashTree(
    projectPath: string, 
    files: Map<string, FileMetadata>
  ): Promise<HashTreeNode> {
    const root: HashTreeNode = {
      path: projectPath,
      hash: '',
      type: 'directory',
      children: new Map()
    };

    // Build tree structure
    for (const [filePath, metadata] of files) {
      const relativePath = relative(projectPath, filePath);
      const parts = relativePath.split('/');
      
      let currentNode = root;
      
      // Navigate/create directory nodes
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!currentNode.children) {
          currentNode.children = new Map();
        }
        
        if (!currentNode.children.has(part)) {
          currentNode.children.set(part, {
            path: join(currentNode.path, part),
            hash: '',
            type: 'directory',
            children: new Map()
          });
        }
        
        currentNode = currentNode.children.get(part)!;
      }
      
      // Add file node
      const fileName = parts[parts.length - 1];
      if (!currentNode.children) {
        currentNode.children = new Map();
      }
      
      currentNode.children.set(fileName, {
        path: filePath,
        hash: metadata.hash,
        type: 'file',
        metadata
      });
    }
    
    // Calculate directory hashes bottom-up
    this.calculateDirectoryHashes(root);
    
    return root;
  }

  /**
   * Recursively calculate directory hashes based on children
   */
  private calculateDirectoryHashes(node: HashTreeNode): string {
    if (node.type === 'file') {
      return node.hash;
    }
    
    if (!node.children || node.children.size === 0) {
      node.hash = Bun.hash('').toString();
      return node.hash;
    }
    
    // Sort children by name for consistent hashing
    const childHashes: string[] = [];
    const sortedChildren = Array.from(node.children.entries()).sort((a, b) => 
      a[0].localeCompare(b[0])
    );
    
    for (const [name, child] of sortedChildren) {
      const childHash = this.calculateDirectoryHashes(child);
      childHashes.push(`${name}:${childHash}`);
    }
    
    // Use Bun's fast hash for directory
    node.hash = Bun.hash(childHashes.join('\n')).toString();
    return node.hash;
  }

  /**
   * Efficiently detect changes using hash tree
   */
  private async detectChangesWithHashTree(
    projectPath: string,
    oldTree: HashTreeNode
  ): Promise<string[]> {
    const currentFiles = await this.scanProjectFiles(projectPath);
    const newTree = await this.buildHashTree(projectPath, currentFiles);
    
    const changedFiles: string[] = [];
    
    // If root hash matches, no changes
    if (oldTree.hash === newTree.hash) {
      return changedFiles;
    }
    
    // Traverse only changed branches
    this.findChangedFiles(oldTree, newTree, changedFiles);
    
    return changedFiles;
  }

  /**
   * Recursively find changed files by comparing hash trees
   */
  private findChangedFiles(
    oldNode: HashTreeNode,
    newNode: HashTreeNode,
    changedFiles: string[]
  ): void {
    // If hashes match, entire subtree is unchanged
    if (oldNode.hash === newNode.hash) {
      return;
    }
    
    // File changed
    if (oldNode.type === 'file' || newNode.type === 'file') {
      changedFiles.push(newNode.path);
      return;
    }
    
    // Check children
    const oldChildren = oldNode.children || new Map();
    const newChildren = newNode.children || new Map();
    
    // Check for added/modified files
    for (const [name, newChild] of newChildren) {
      const oldChild = oldChildren.get(name);
      if (!oldChild) {
        // New file/directory
        this.collectAllFiles(newChild, changedFiles);
      } else if (oldChild.hash !== newChild.hash) {
        // Changed - recursively check
        this.findChangedFiles(oldChild, newChild, changedFiles);
      }
    }
    
    // Check for deleted files
    for (const [name, oldChild] of oldChildren) {
      if (!newChildren.has(name)) {
        this.collectAllFiles(oldChild, changedFiles);
      }
    }
  }

  /**
   * Collect all files in a subtree
   */
  private collectAllFiles(node: HashTreeNode, files: string[]): void {
    if (node.type === 'file') {
      files.push(node.path);
      return;
    }
    
    if (node.children) {
      for (const child of node.children.values()) {
        this.collectAllFiles(child, files);
      }
    }
  }

  private hashPath(path: string): string {
    return createHash('md5').update(path).digest('hex');
  }

  private async persistCache(projectPath: string): Promise<void> {
    const cache = this.cache.get(projectPath);
    if (!cache) return;

    const cacheFile = join(this.cacheDir, `${this.hashPath(projectPath)}.json`);
    
    try {
      const data = this.options.compressionEnabled 
        ? await this.compress(JSON.stringify(cache))
        : JSON.stringify(cache);
        
      writeFileSync(cacheFile, data);
    } catch (e) {
      console.error('Failed to persist cache:', e);
    }
  }

  private loadPersistedCache(): void {
    if (!existsSync(this.cacheDir)) return;

    const glob = new Glob('*.json');
    for (const file of glob.scanSync(this.cacheDir)) {
      try {
        const content = readFileSync(join(this.cacheDir, file), 'utf-8');
        if (!content) continue;
        
        const data = this.options.compressionEnabled
          ? JSON.parse(this.decompress(content))
          : JSON.parse(content);
          
        // Reconstruct cache entry
        for (const [type, entry] of Object.entries(data)) {
          if (entry && typeof entry === 'object' && 'projectPath' in entry) {
            const projectPath = (entry as any).projectPath;
            if (!this.cache.has(projectPath)) {
              this.cache.set(projectPath, {});
            }
            this.cache.get(projectPath)![type as keyof AnalysisCache] = entry as any;
          }
        }
      } catch (e) {
        // Skip corrupted cache files
      }
    }
  }

  private compress(data: string): string {
    // Simple compression using Bun's built-in gzip
    // In a real implementation, we'd use proper compression
    return Buffer.from(data).toString('base64');
  }

  private decompress(data: string): string {
    // Simple decompression
    return Buffer.from(data, 'base64').toString('utf-8');
  }
}