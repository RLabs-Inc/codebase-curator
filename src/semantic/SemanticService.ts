/**
 * Semantic Service
 * Orchestrates semantic indexing using the CodebaseStreamer
 */

import { CodebaseStreamerBun } from '../core/CodebaseStreamerBun';
import { SemanticIndexImpl } from './SemanticIndexImpl';
import { TypeScriptExtractor } from './extractors/TypeScriptExtractor';
import { LanguageExtractor, SemanticInfo, SearchOptions, SearchResult } from './types';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export class SemanticService {
  private index = new SemanticIndexImpl();
  private extractors: LanguageExtractor[] = [
    new TypeScriptExtractor(),
    // Add more extractors here as you implement them
  ];

  async indexCodebase(projectPath: string): Promise<void> {
    console.log('🔍 Building semantic index...');
    
    const streamer = new CodebaseStreamerBun(projectPath);
    const startTime = Date.now();
    let filesProcessed = 0;
    let entriesIndexed = 0;

    // Clear existing index
    this.index.clear();

    // Process files in batches
    for await (const batch of streamer.streamFiles()) {
      for (const [filePath, content] of batch.files) {
        const extractor = this.extractors.find(e => e.canHandle(filePath));
        
        if (extractor) {
          try {
            const semanticInfo = extractor.extract(content, filePath);
            semanticInfo.forEach(info => {
              this.index.add(info);
              entriesIndexed++;
            });
            filesProcessed++;
          } catch (error) {
            console.warn(`Error processing ${filePath}:`, error);
          }
        }
      }

      // Show progress
      if (filesProcessed % 10 === 0) {
        console.log(`Processed ${filesProcessed} files, indexed ${entriesIndexed} entries...`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Semantic index complete: ${filesProcessed} files, ${entriesIndexed} entries in ${duration}ms`);

    // Save index to disk
    const indexPath = this.getIndexPath(projectPath);
    await this.saveIndex(indexPath);
    console.log(`💾 Index saved to ${indexPath}`);
  }

  async loadIndex(projectPath: string): Promise<boolean> {
    const indexPath = this.getIndexPath(projectPath);
    try {
      await this.index.load(indexPath);
      console.log(`📖 Loaded semantic index from ${indexPath}`);
      return true;
    } catch {
      return false;
    }
  }

  async saveIndex(indexPath: string): Promise<void> {
    const dir = dirname(indexPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await this.index.save(indexPath);
  }

  search(query: string, options?: SearchOptions): SearchResult[] {
    return this.index.search(query, options);
  }

  searchGroup(terms: string[]): SearchResult[] {
    return this.index.searchGroup(terms);
  }

  private getIndexPath(projectPath: string): string {
    return join(projectPath, '.curator', 'semantic-index.json');
  }

  /**
   * Get index statistics
   */
  getStats(): { totalEntries: number; totalFiles: number } {
    // TODO: Add stats tracking to index
    return {
      totalEntries: 0,
      totalFiles: 0,
    };
  }
}