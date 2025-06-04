import * as fs from 'fs/promises';
import * as path from 'path';
import { watch, type FSWatcher } from 'fs';
import { Glob } from 'bun';
import { shouldExclude, loadConfig, mergeExclusions } from '../config/config';
import { DEFAULT_EXCLUSIONS } from '../types/config';

export interface HashNode {
  path: string;
  hash: string;
  type: 'file' | 'directory';
  children?: Map<string, HashNode>;
  lastModified: number;
  size?: number;
}

export interface HashTreeDiff {
  added: string[];
  modified: string[];
  deleted: string[];
}

export class HashTree {
  private root: HashNode;
  private hashCache: Map<string, string> = new Map();
  private watcher?: FSWatcher;
  private watchCallbacks: Set<(changes: HashTreeDiff) => void> = new Set();
  private debounceTimers: Map<string, Timer> = new Map();

  constructor(rootPath: string) {
    this.root = {
      path: rootPath,
      hash: '',
      type: 'directory',
      children: new Map(),
      lastModified: 0
    };
  }

  async startWatching(callback: (changes: HashTreeDiff) => void): Promise<void> {
    this.watchCallbacks.add(callback);
    
    if (!this.watcher) {
      // Load exclusions
      const config = loadConfig(this.root.path);
      const exclusions = mergeExclusions(DEFAULT_EXCLUSIONS, config.exclude);
      
      this.watcher = watch(this.root.path, { recursive: true }, async (eventType, filename) => {
        if (!filename) return;
        
        const fullPath = path.join(this.root.path, filename);
        const relativePath = path.relative(this.root.path, fullPath);
        
        // Skip excluded files
        if (shouldExclude(relativePath, exclusions)) {
          return;
        }
        
        // Skip .curator directory files (hash tree, indexes, etc.)
        if (fullPath.includes('/.curator/') || fullPath.includes('\\.curator\\')) {
          return;
        }
        
        // Debounce file changes - clear existing timer and set new one
        const existingTimer = this.debounceTimers.get(fullPath);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        
        // Wait 500ms before processing change to allow for rapid successive events
        const timer = setTimeout(async () => {
          this.debounceTimers.delete(fullPath);
          
          const changes = await this.updatePath(fullPath);
          if (changes) {
            for (const cb of this.watchCallbacks) {
              cb(changes);
            }
          }
        }, 500);
        
        this.debounceTimers.set(fullPath, timer);
      });
    }
  }

  stopWatching(callback?: (changes: HashTreeDiff) => void): void {
    if (callback) {
      this.watchCallbacks.delete(callback);
    } else {
      this.watchCallbacks.clear();
    }
    
    if (this.watchCallbacks.size === 0 && this.watcher) {
      // Clear all pending debounce timers
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();
      
      this.watcher.close();
      this.watcher = undefined;
    }
  }

  async build(patterns?: string[]): Promise<void> {
    if (patterns && patterns.length > 0) {
      // Use Bun's optimized glob for pattern matching
      await this.buildWithGlob(patterns);
    } else {
      await this.buildNode(this.root);
    }
  }

  private async buildWithGlob(patterns: string[]): Promise<void> {
    this.root.children = new Map();
    const allFiles = new Set<string>();
    
    // Load exclusions from config
    const config = loadConfig(this.root.path);
    const exclusions = mergeExclusions(DEFAULT_EXCLUSIONS, config.exclude);

    for (const pattern of patterns) {
      const glob = new Glob(pattern);
      for await (const file of glob.scan(this.root.path)) {
        const relativePath = path.relative(this.root.path, file);
        // Skip excluded files
        if (!shouldExclude(relativePath, exclusions)) {
          allFiles.add(path.resolve(this.root.path, file));
        }
      }
    }

    for (const filepath of allFiles) {
      await this.addFileToTree(filepath);
    }

    // Compute directory hashes
    await this.computeDirectoryHashes(this.root);
  }

  private async addFileToTree(filepath: string): Promise<void> {
    const relativePath = path.relative(this.root.path, filepath);
    const segments = relativePath.split(path.sep);
    let current = this.root;

    // Create directory nodes as needed
    for (let i = 0; i < segments.length - 1; i++) {
      if (!current.children!.has(segments[i])) {
        current.children!.set(segments[i], {
          path: path.join(current.path, ...segments.slice(0, i + 1)),
          hash: '',
          type: 'directory',
          children: new Map(),
          lastModified: 0
        });
      }
      current = current.children!.get(segments[i])!;
    }

    // Add file node
    const filename = segments[segments.length - 1];
    const fileNode: HashNode = {
      path: filepath,
      hash: '',
      type: 'file',
      lastModified: 0
    };

    await this.buildNode(fileNode);
    current.children!.set(filename, fileNode);
  }

  private async computeDirectoryHashes(node: HashNode): Promise<void> {
    if (node.type === 'directory' && node.children) {
      const childHashes: string[] = [];
      
      for (const child of node.children.values()) {
        await this.computeDirectoryHashes(child);
        childHashes.push(child.hash);
      }
      
      node.hash = this.computeHash(childHashes.sort().join('|'));
    }
  }

  private async buildNode(node: HashNode, patterns?: string[]): Promise<void> {
    const stats = await fs.stat(node.path);
    node.lastModified = stats.mtimeMs;

    if (stats.isDirectory()) {
      node.type = 'directory';
      node.children = new Map();
      
      const entries = await fs.readdir(node.path);
      const childHashes: string[] = [];

      for (const entry of entries) {
        const childPath = path.join(node.path, entry);
        
        // Skip if doesn't match patterns (if provided)
        if (patterns && !this.matchesPatterns(childPath, patterns)) {
          continue;
        }

        const childNode: HashNode = {
          path: childPath,
          hash: '',
          type: 'file',
          lastModified: 0
        };

        await this.buildNode(childNode, patterns);
        node.children.set(entry, childNode);
        childHashes.push(childNode.hash);
      }

      // Directory hash is combination of child hashes
      node.hash = this.computeHash(childHashes.sort().join('|'));
    } else {
      node.type = 'file';
      node.size = stats.size;
      
      // Use Bun.file for optimized file operations
      const file = Bun.file(node.path);
      
      // Fast metadata-based hash first - if mtime/size unchanged, skip content read
      const metadataHash = `${stats.mtimeMs}:${stats.size}`;
      const cachedHash = this.hashCache.get(node.path);
      
      if (cachedHash && cachedHash.startsWith(metadataHash)) {
        // File unchanged, reuse cached hash
        node.hash = cachedHash;
      } else {
        // File changed or new, compute content hash
        const content = await file.arrayBuffer();
        const contentHash = this.computeHash(content);
        node.hash = `${metadataHash}:${contentHash}`;
        this.hashCache.set(node.path, node.hash);
      }
    }
  }

  private matchesPatterns(filepath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filepath);
    });
  }

  private computeHash(data: string | ArrayBuffer | Uint8Array): string {
    // Use Bun's fast wyhash (default) for file content comparison
    return Bun.hash(data).toString(16);
  }

  async diff(other: HashTree): Promise<HashTreeDiff> {
    const diff: HashTreeDiff = {
      added: [],
      modified: [],
      deleted: []
    };

    await this.diffNodes(this.root, other.root, diff);
    return diff;
  }

  private async diffNodes(oldNode: HashNode, newNode: HashNode, diff: HashTreeDiff): Promise<void> {
    if (oldNode.type === 'file' && newNode.type === 'file') {
      if (oldNode.hash !== newNode.hash) {
        diff.modified.push(newNode.path);
      }
      return;
    }

    if (oldNode.type === 'directory' && newNode.type === 'directory') {
      const oldChildren = oldNode.children || new Map();
      const newChildren = newNode.children || new Map();

      // Check for deleted files
      for (const [name, child] of oldChildren) {
        if (!newChildren.has(name)) {
          this.collectPaths(child, diff.deleted);
        }
      }

      // Check for added/modified files
      for (const [name, newChild] of newChildren) {
        const oldChild = oldChildren.get(name);
        if (!oldChild) {
          this.collectPaths(newChild, diff.added);
        } else {
          await this.diffNodes(oldChild, newChild, diff);
        }
      }
    }
  }

  private collectPaths(node: HashNode, paths: string[]): void {
    if (node.type === 'file') {
      paths.push(node.path);
    } else if (node.children) {
      for (const child of node.children.values()) {
        this.collectPaths(child, paths);
      }
    }
  }

  async updatePath(filepath: string): Promise<HashTreeDiff | null> {
    const file = Bun.file(filepath);
    const exists = await file.exists();
    
    if (!exists) {
      // File deleted
      const deleted = await this.removePath(filepath);
      return deleted ? { added: [], modified: [], deleted: [filepath] } : null;
    }
    
    const segments = path.relative(this.root.path, filepath).split(path.sep);
    let current = this.root;
    
    // Navigate to parent directory, creating intermediate directories if needed
    for (let i = 0; i < segments.length - 1; i++) {
      if (!current.children?.has(segments[i])) {
        // Create missing directory nodes
        current.children!.set(segments[i], {
          path: path.join(current.path, segments[i]),
          hash: '',
          type: 'directory',
          children: new Map(),
          lastModified: 0
        });
      }
      current = current.children.get(segments[i])!;
    }

    const filename = segments[segments.length - 1];
    const node = current.children?.get(filename);
    
    if (!node) {
      // New file - add it
      const newNode: HashNode = {
        path: filepath,
        hash: '',
        type: 'file',
        lastModified: 0
      };
      await this.buildNode(newNode);
      current.children!.set(filename, newNode);
      
      // Update parent hashes up the tree
      await this.updateParentHashes(filepath);
      return { added: [filepath], modified: [], deleted: [] };
    }

    // Existing file - check if changed
    const oldHash = node.hash;
    await this.buildNode(node);
    
    if (oldHash !== node.hash) {
      await this.updateParentHashes(filepath);
      return { added: [], modified: [filepath], deleted: [] };
    }
    
    return null; // No changes
  }

  private async removePath(filepath: string): Promise<boolean> {
    const segments = path.relative(this.root.path, filepath).split(path.sep);
    let current = this.root;
    
    // Navigate to parent directory
    for (let i = 0; i < segments.length - 1; i++) {
      if (!current.children?.has(segments[i])) {
        return false; // Path not in tree
      }
      current = current.children.get(segments[i])!;
    }

    const filename = segments[segments.length - 1];
    if (current.children?.has(filename)) {
      current.children.delete(filename);
      this.hashCache.delete(filepath);
      
      // Update parent hashes up the tree
      await this.updateParentHashes(path.dirname(filepath));
      return true;
    }
    
    return false;
  }

  private async updateParentHashes(filepath: string): Promise<void> {
    const relativePath = path.relative(this.root.path, filepath);
    const segments = relativePath.split(path.sep);
    let current = this.root;
    const nodePath: HashNode[] = [current];

    // Build path to the file
    for (let i = 0; i < segments.length - 1; i++) {
      if (!current.children?.has(segments[i])) {
        return; // Path doesn't exist in tree
      }
      current = current.children.get(segments[i])!;
      nodePath.push(current);
    }

    // Update hashes from leaf to root
    for (let i = nodePath.length - 1; i >= 0; i--) {
      const node = nodePath[i];
      if (node.type === 'directory' && node.children) {
        const childHashes: string[] = [];
        for (const child of node.children.values()) {
          childHashes.push(child.hash);
        }
        node.hash = this.computeHash(childHashes.sort().join('|'));
      }
    }
  }

  async save(filepath: string): Promise<void> {
    const data = this.serialize();
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  async load(filepath: string): Promise<void> {
    const data = await fs.readFile(filepath, 'utf-8');
    const parsed = JSON.parse(data);
    this.root = this.deserialize(parsed);
  }

  private serialize(): any {
    const serializeNode = (node: HashNode): any => {
      const result: any = {
        path: node.path,
        hash: node.hash,
        type: node.type,
        lastModified: node.lastModified
      };

      if (node.size !== undefined) {
        result.size = node.size;
      }

      if (node.children) {
        result.children = {};
        for (const [name, child] of node.children) {
          result.children[name] = serializeNode(child);
        }
      }

      return result;
    };

    return serializeNode(this.root);
  }

  private deserialize(data: any): HashNode {
    const deserializeNode = (nodeData: any): HashNode => {
      const node: HashNode = {
        path: nodeData.path,
        hash: nodeData.hash,
        type: nodeData.type,
        lastModified: nodeData.lastModified
      };

      if (nodeData.size !== undefined) {
        node.size = nodeData.size;
      }

      if (nodeData.children) {
        node.children = new Map();
        for (const [name, childData] of Object.entries(nodeData.children)) {
          node.children.set(name, deserializeNode(childData));
        }
      }

      return node;
    };

    return deserializeNode(data);
  }

  getFileHash(filepath: string): string | undefined {
    return this.hashCache.get(filepath);
  }

  getAllFileHashes(): Map<string, string> {
    return new Map(this.hashCache);
  }
}