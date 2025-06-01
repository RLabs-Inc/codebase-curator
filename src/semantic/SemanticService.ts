/**
 * Semantic Service
 * Orchestrates semantic indexing using the CodebaseStreamer
 */

import { CodebaseStreamerBun } from '../core/CodebaseStreamerBun';
import { SemanticIndexImpl } from './SemanticIndexImpl';
import { TypeScriptExtractor } from './extractors/TypeScriptExtractor';
import { LanguageExtractor, SemanticInfo, SearchOptions, SearchResult, CrossReference } from './types';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export class SemanticService {
  private index = new SemanticIndexImpl();
  private extractors: LanguageExtractor[] = [
    new TypeScriptExtractor(),
    // Add more extractors here as you implement them
  ];
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

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
            const result = extractor.extract(content, filePath);
            
            // Add definitions
            result.definitions.forEach(info => {
              this.index.add(info);
              entriesIndexed++;
            });
            
            // Add cross-references
            result.references.forEach(ref => {
              this.index.addCrossReference(ref);
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

  getImpactAnalysis(term: string): { directReferences: CrossReference[]; fileCount: number; byType: Record<string, number> } {
    return this.index.getImpactAnalysis(term);
  }

  private getIndexPath(projectPath: string): string {
    return join(projectPath, '.curator', 'semantic-index.json');
  }

  /**
   * Build index for the configured project path
   */
  async buildIndex(): Promise<void> {
    await this.indexCodebase(this.projectPath);
  }

  /**
   * Index specific files (for incremental updates)
   */
  async indexFiles(files: string[]): Promise<void> {
    console.log(`🔄 Indexing ${files.length} files...`);
    let entriesIndexed = 0;

    for (const filePath of files) {
      const extractor = this.extractors.find(e => e.canHandle(filePath));
      
      if (extractor) {
        try {
          const file = Bun.file(filePath);
          const content = await file.text();
          const result = extractor.extract(content, filePath);
          
          // Remove existing entries for this file first
          this.index.removeFile(filePath);
          
          // Add new definitions
          result.definitions.forEach(info => {
            this.index.add(info);
            entriesIndexed++;
          });
          
          // Add cross-references
          result.references.forEach(ref => {
            this.index.addCrossReference(ref);
          });
        } catch (error) {
          console.warn(`Error processing ${filePath}:`, error);
        }
      }
    }

    console.log(`✅ Indexed ${entriesIndexed} entries from ${files.length} files`);
    
    // Save updated index
    const indexPath = this.getIndexPath(this.projectPath);
    await this.saveIndex(indexPath);
  }

  /**
   * Remove a file from the semantic index
   */
  async removeFile(filePath: string): Promise<void> {
    this.index.removeFile(filePath);
    
    // Save updated index
    const indexPath = this.getIndexPath(this.projectPath);
    await this.saveIndex(indexPath);
  }

  /**
   * Clear the entire index
   */
  async clearIndex(): Promise<void> {
    this.index.clear();
  }

  /**
   * Get index statistics
   */
  getStats(): { totalEntries: number; totalFiles: number } {
    return this.index.getStats();
  }
}