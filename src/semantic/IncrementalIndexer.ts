import { HashTree, type HashTreeDiff } from './HashTree.js';
import { SemanticService } from './SemanticService.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface IndexingStatus {
  totalFiles: number;
  indexedFiles: number;
  isWatching: boolean;
  lastUpdate: number;
}

export class IncrementalIndexer {
  private hashTree: HashTree;
  private semanticService: SemanticService;
  private indexPath: string;
  private hashTreePath: string;
  private isBuilding = false;
  private buildPromise?: Promise<void>;

  constructor(projectPath: string) {
    this.hashTree = new HashTree(projectPath);
    this.semanticService = new SemanticService(projectPath);
    this.indexPath = path.join(projectPath, '.curator', 'semantic');
    this.hashTreePath = path.join(this.indexPath, 'hashtree.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.indexPath, { recursive: true });
    
    // Load existing hash tree if available
    try {
      await this.hashTree.load(this.hashTreePath);
      console.error('Loaded existing hash tree from disk');
    } catch (error) {
      console.error('No existing hash tree found, will build from scratch');
    }
  }

  async buildIndex(patterns: string[] = ['**/*.{ts,tsx,js,jsx}']): Promise<void> {
    if (this.isBuilding) {
      return this.buildPromise;
    }

    this.isBuilding = true;
    this.buildPromise = this._buildIndex(patterns);
    
    try {
      await this.buildPromise;
    } finally {
      this.isBuilding = false;
      this.buildPromise = undefined;
    }
  }

  private async _buildIndex(patterns: string[]): Promise<void> {
    console.error('Building hash tree...');
    const startTime = Date.now();
    
    // Build hash tree with file patterns
    await this.hashTree.build(patterns);
    
    // Build semantic index for all files
    await this.semanticService.buildIndex();
    
    // Save hash tree state
    await this.hashTree.save(this.hashTreePath);
    
    const duration = Date.now() - startTime;
    console.error(`Index built in ${duration}ms`);
  }

  async updateIndex(diff: HashTreeDiff): Promise<void> {
    console.error(`Updating index: +${diff.added.length} ~${diff.modified.length} -${diff.deleted.length}`);
    
    // Remove deleted files from semantic index
    for (const deletedFile of diff.deleted) {
      await this.semanticService.removeFile(deletedFile);
    }

    // Add/update files in semantic index
    const filesToIndex = [...diff.added, ...diff.modified];
    if (filesToIndex.length > 0) {
      await this.semanticService.indexFiles(filesToIndex);
    }

    // Save updated hash tree
    await this.hashTree.save(this.hashTreePath);
  }

  async startWatching(): Promise<void> {
    await this.hashTree.startWatching(async (diff) => {
      await this.updateIndex(diff);
    });
    console.error('Started watching for file changes');
  }

  stopWatching(): void {
    this.hashTree.stopWatching();
    console.error('Stopped watching for file changes');
  }

  async getStatus(): Promise<IndexingStatus> {
    const allHashes = this.hashTree.getAllFileHashes();
    const indexStats = await this.semanticService.getStats();
    
    return {
      totalFiles: allHashes.size,
      indexedFiles: indexStats.totalFiles,
      isWatching: this.hashTree['watcher'] !== undefined,
      lastUpdate: Date.now() // Could track actual last update
    };
  }

  async forceRebuild(): Promise<void> {
    console.error('Force rebuilding index...');
    
    // Clear existing state
    await this.semanticService.clearIndex();
    
    // Rebuild everything
    await this.buildIndex();
  }

  async checkIntegrity(): Promise<{ consistent: boolean; issues: string[] }> {
    const issues: string[] = [];
    const allHashes = this.hashTree.getAllFileHashes();
    const indexStats = await this.semanticService.getStats();

    // Check if hash tree and semantic index are in sync
    if (allHashes.size !== indexStats.totalFiles) {
      issues.push(`Hash tree has ${allHashes.size} files but semantic index has ${indexStats.totalFiles}`);
    }

    // Could add more integrity checks here
    // - Check if files in semantic index exist in hash tree
    // - Verify file hashes haven't changed since last index
    
    return {
      consistent: issues.length === 0,
      issues
    };
  }

  async getHashTree(): Promise<HashTree> {
    return this.hashTree;
  }

  async getSemanticService(): Promise<SemanticService> {
    return this.semanticService;
  }

  async dispose(): Promise<void> {
    this.stopWatching();
    await this.hashTree.save(this.hashTreePath);
  }
}