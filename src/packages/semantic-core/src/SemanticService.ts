/**
 * Semantic Service
 * Orchestrates semantic indexing using the CodebaseStreamer
 * Includes automatic freshness checking for always up-to-date indexes
 */

import { CodebaseStreamer } from './indexing/CodebaseStreamer'
import { SemanticIndexImpl } from './SemanticIndexImpl'
import { TypeScriptExtractor } from './extractors/TypeScriptExtractor'
import { PythonExtractor } from './extractors/PythonExtractor'
import { GoExtractor } from './extractors/GoExtractor'
import { RustExtractor } from './extractors/RustExtractor'
import { SwiftExtractor } from './extractors/SwiftExtractor'
import { ShellExtractor } from './extractors/ShellExtractor'
import { JsonExtractor } from './extractors/JsonExtractor'
import { YamlExtractor } from './extractors/YamlExtractor'
import { TomlExtractor } from './extractors/TomlExtractor'
import { EnvExtractor } from './extractors/EnvExtractor'
import { FrameworkExtractor } from './extractors/FrameworkExtractor'
import { StoryExtractor } from './analyzers/StoryExtractor'
import type {
  LanguageExtractor,
  SemanticInfo,
  SearchOptions,
  SearchResult,
  CrossReference,
} from './types'
import type { CodebaseStory } from './types/story'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import * as fs from 'fs/promises'

export class SemanticService {
  private index = new SemanticIndexImpl()
  private extractors: LanguageExtractor[] = [
    // Framework files (must come before TypeScript to handle .svelte, .vue, etc.)
    new FrameworkExtractor(),
    // Programming languages
    new TypeScriptExtractor(),
    new PythonExtractor(),
    new GoExtractor(),
    new RustExtractor(),
    new SwiftExtractor(),
    new ShellExtractor(),
    // Configuration files
    new JsonExtractor(),
    new YamlExtractor(),
    new TomlExtractor(),
    new EnvExtractor(),
  ]
  private storyExtractor = new StoryExtractor()
  private cachedStory: CodebaseStory | null = null
  private projectPath: string
  private silentMode = false
  private isEnsuring = false
  private ensurePromise?: Promise<void>
  private hasLoadedIndex = false

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  setSilentMode(silent: boolean): void {
    this.silentMode = silent
  }

  /**
   * Ensures the semantic index is fresh by checking for file changes
   * This method is called automatically by all public methods
   * Uses file stats (size+mtime) for efficient change detection
   */
  private async ensureFresh(): Promise<void> {
    // Prevent concurrent ensureFresh calls
    if (this.isEnsuring) {
      return this.ensurePromise
    }

    this.isEnsuring = true
    this.ensurePromise = this._ensureFresh()

    try {
      await this.ensurePromise
    } finally {
      this.isEnsuring = false
      this.ensurePromise = undefined
    }
  }

  private async _ensureFresh(): Promise<void> {
    const startTime = Date.now()

    // Load existing index if not already loaded
    if (!this.hasLoadedIndex) {
      const indexPath = this.getIndexPath(this.projectPath)
      try {
        await this.index.load(indexPath)
        this.hasLoadedIndex = true
        if (!this.silentMode) {
          console.log(`📖 Loaded semantic index from ${indexPath}`)
        }
      } catch {
        // No existing index, build from scratch
        if (!this.silentMode) {
          console.log('🔍 No existing index found, building...')
        }
        await this.buildIndex()
        this.hasLoadedIndex = true
        return
      }
    }

    // Stream with incremental updates
    const streamer = new CodebaseStreamer(this.projectPath)
    let changedFiles = 0

    for await (const batch of streamer.streamFiles()) {
      // Process changed/new files
      for (const [filePath, content] of batch.files) {
        const extractor = this.extractors.find((e) => e.canHandle(filePath))

        if (extractor) {
          try {
            const result = extractor.extract(content, filePath)

            // Remove old entries and add new ones
            this.index.removeFile(filePath)

            result.definitions.forEach((info) => {
              this.index.add(info)
            })

            result.references.forEach((ref) => {
              this.index.addCrossReference(ref)
            })

            changedFiles++
          } catch (error) {
            if (!this.silentMode) {
              console.warn(`Error processing ${filePath}:`, error)
            }
          }
        }
      }
    }

    if (changedFiles > 0) {
      // Save index only if there were changes
      const indexPath = this.getIndexPath(this.projectPath)
      await this.saveIndex(indexPath)

      if (!this.silentMode) {
        const duration = Date.now() - startTime
        console.log(
          `✅ Index updated: ${changedFiles} changed in ${duration}ms`
        )
      }
    } else if (!this.silentMode) {
      const duration = Date.now() - startTime
      console.log(`✅ Index is up-to-date (checked in ${duration}ms)`)
    }
  }

  async indexCodebase(projectPath: string): Promise<void> {
    // Clear any existing index and hash cache
    this.index.clear()
    this.hasLoadedIndex = false

    // Delete hash cache to force full reindex
    const hashCachePath = join(
      projectPath,
      '.curator',
      'semantic',
      'filehashes.json'
    )
    try {
      await fs.unlink(hashCachePath)
    } catch {
      // Ignore if doesn't exist
    }

    // Use ensureFresh which handles everything
    await this.ensureFresh()
  }

  async loadIndex(projectPath: string): Promise<boolean> {
    const indexPath = this.getIndexPath(projectPath)
    try {
      await this.index.load(indexPath)
      // Check if index actually has content
      const stats = await this.index.getStats()
      if (stats.totalEntries === 0) {
        return false
      }
      this.hasLoadedIndex = true
      console.log(`📖 Loaded semantic index from ${indexPath}`)
      return true
    } catch {
      return false
    }
  }

  async saveIndex(indexPath: string): Promise<void> {
    const dir = dirname(indexPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    await this.index.save(indexPath)
  }

  async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    return this.index.search(query, options)
  }

  async searchGroup(terms: string[]): Promise<SearchResult[]> {
    return this.index.searchGroup(terms)
  }

  async getImpactAnalysis(term: string): Promise<{
    directReferences: CrossReference[]
    fileCount: number
    byType: Record<string, number>
  }> {
    return this.index.getImpactAnalysis(term)
  }

  private getIndexPath(projectPath: string): string {
    return join(projectPath, '.curator', 'semantic-index.json')
  }

  /**
   * Build index for the configured project path
   */
  private async buildIndex(): Promise<void> {
    console.log('🔍 Building semantic index...')
    const startTime = Date.now()
    let filesProcessed = 0
    let entriesIndexed = 0

    // Clear existing index
    this.index.clear()

    // Process files using streamer
    const streamer = new CodebaseStreamer(this.projectPath)
    for await (const batch of streamer.streamFiles()) {
      // Process files
      for (const [filePath, content] of batch.files) {
        const extractor = this.extractors.find((e) => e.canHandle(filePath))

        if (extractor) {
          try {
            const result = extractor.extract(content, filePath)

            result.definitions.forEach((info) => {
              this.index.add(info)
              entriesIndexed++
            })

            result.references.forEach((ref) => {
              this.index.addCrossReference(ref)
            })

            filesProcessed++
          } catch (error) {
            console.warn(`Error processing ${filePath}:`, error)
          }
        }
      }

      // Show progress
      if (filesProcessed % 10 === 0) {
        console.log(
          `Processed ${filesProcessed} files, indexed ${entriesIndexed} entries...`
        )
      }
    }

    const duration = Date.now() - startTime
    console.log(
      `✅ Semantic index complete: ${filesProcessed} files, ${entriesIndexed} entries in ${duration}ms`
    )

    // Save index
    const indexPath = this.getIndexPath(this.projectPath)
    await this.saveIndex(indexPath)
    console.log(`💾 Index saved`)
  }

  /**
   * Index specific files (for incremental updates)
   * This method is now integrated into ensureFresh using CodebaseStreamer
   */
  private async indexFiles(files: string[]): Promise<void> {
    // This method is no longer used directly
    // All indexing goes through CodebaseStreamer in ensureFresh
    throw new Error(
      'indexFiles is deprecated. Use ensureFresh() which handles incremental updates automatically.'
    )
  }

  /**
   * Remove a file from the semantic index
   */
  async removeFile(filePath: string): Promise<void> {
    this.index.removeFile(filePath)

    // Save updated index
    const indexPath = this.getIndexPath(this.projectPath)
    await this.saveIndex(indexPath)
  }

  /**
   * Clear the entire index
   */
  async clearIndex(): Promise<void> {
    this.index.clear()
    this.hasLoadedIndex = false
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<{ totalEntries: number; totalFiles: number }> {
    return this.index.getStats()
  }

  /**
   * Get the underlying semantic index (for advanced usage)
   * Note: This doesn't ensure freshness automatically
   */
  getIndex(): SemanticIndexImpl {
    return this.index
  }

  /**
   * Update the index with any file changes
   * - First run: Builds complete index
   * - Subsequent runs: Only processes changed/new/deleted files
   * Returns true if any changes were processed
   */
  async updateIndex(): Promise<boolean> {
    const startTime = Date.now()
    const statsBefore = await this.getStats()

    await this.ensureFresh()

    const statsAfter = await this.getStats()
    const duration = Date.now() - startTime

    // Clear cached story when index updates
    if (statsBefore.totalEntries !== statsAfter.totalEntries) {
      this.cachedStory = null
    }

    // Return true if index changed or it took more than 500ms
    return (
      statsBefore.totalEntries !== statsAfter.totalEntries ||
      statsBefore.totalFiles !== statsAfter.totalFiles ||
      duration > 500
    )
  }

  /**
   * Extract codebase story from all strings
   */
  async extractStory(): Promise<CodebaseStory> {
    // Use cached story if available
    if (this.cachedStory) {
      return this.cachedStory
    }

    // Ensure index is fresh
    await this.ensureFresh()

    // Get all strings from the index
    const allStrings = await this.search('', {
      type: ['string', 'comment'],
      maxResults: 10000, // Get as many as possible
    })

    // Extract story
    this.cachedStory = this.storyExtractor.extractStory(allStrings)
    
    // Save story with index
    await this.saveStory()

    return this.cachedStory
  }

  /**
   * Get story for a specific term
   */
  async getStoryForTerm(term: string): Promise<CodebaseStory> {
    // Get full story
    const fullStory = await this.extractStory()

    // Filter story elements related to the term
    const termLower = term.toLowerCase()

    return {
      flows: fullStory.flows.filter(flow =>
        flow.steps.some(step => step.text.toLowerCase().includes(termLower))
      ),
      errors: fullStory.errors.filter(error =>
        error.error.toLowerCase().includes(termLower) ||
        error.trigger.toLowerCase().includes(termLower)
      ),
      boundaries: fullStory.boundaries.filter(boundary =>
        boundary.identifier.toLowerCase().includes(termLower) ||
        boundary.usage.some(u => u.context.toLowerCase().includes(termLower))
      ),
      patterns: fullStory.patterns.filter(pattern =>
        pattern.examples.some(ex => ex.text.toLowerCase().includes(termLower))
      ),
      metadata: fullStory.metadata,
    }
  }

  /**
   * Save story to disk
   */
  private async saveStory(): Promise<void> {
    if (!this.cachedStory) return

    const storyPath = join(this.projectPath, '.curator', 'story.json')
    const dir = dirname(storyPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    await fs.writeFile(storyPath, JSON.stringify(this.cachedStory, null, 2))
  }

  /**
   * Load story from disk
   */
  private async loadStory(): Promise<boolean> {
    try {
      const storyPath = join(this.projectPath, '.curator', 'story.json')
      if (existsSync(storyPath)) {
        const data = await fs.readFile(storyPath, 'utf-8')
        this.cachedStory = JSON.parse(data)
        return true
      }
    } catch (error) {
      // Ignore errors, regenerate story
    }
    return false
  }
}
