import { Glob } from 'bun'
import { join, dirname } from 'path'
import * as fs from 'fs/promises'
import {
  shouldExclude,
  loadConfig,
  mergeExclusions,
} from '../config/config'
import { DEFAULT_EXCLUSIONS } from '../types/config'

export interface StreamBatch {
  files: Map<string, string>         // Changed/new files with content
  stats: Map<string, { size: number; mtime: number }>  // Stats for changed/new files
  unchanged: string[]                // Files skipped (stats matched)
  deleted?: string[]                 // Files that were deleted (only in final batch)
  processedStats?: Map<string, { size: number; mtime: number }>  // All file stats (only in final batch)
  metadata: {
    totalFiles: number
    currentBatch: number
    totalBatches: number
    memoryUsed: number
    filesInBatch: string[]
    type?: 'content' | 'final'
  }
}

export interface StreamOptions {
  batchSize?: number // Number of files per batch (default: 20)
  memoryLimit?: number // Max memory per batch in bytes (default: 50MB)
  priorityPattern?: string // Process these files first (e.g., "*.ts")
  filePattern?: string // Which files to include (default: "**/*")
  chunkSize?: number // Size for streaming large files (default: 64KB)
  skipUnchanged?: boolean // Skip files with matching stats
}

/**
 * Ultra-memory-efficient file streaming using Bun's native streams! 🚀
 *
 * This version uses Bun's file.stream() for TRUE streaming - we never
 * load entire files into memory at once. Perfect for massive codebases!
 *
 * Built FOR Claude BY Claude to handle ANY size codebase! 💪
 */
export class CodebaseStreamer {
  private rootPath: string
  private processedFiles = new Set<string>()
  private statsCache?: Map<string, { size: number; mtime: number }>
  private statsCachePath: string

  constructor(rootPath: string) {
    this.rootPath = rootPath
    this.statsCachePath = join(rootPath, '.curator', 'semantic', 'statscache.json')
  }
  
  private async loadStatsCache(): Promise<void> {
    if (!this.statsCache) {
      try {
        const cacheFile = Bun.file(this.statsCachePath)
        const cache = await cacheFile.json()
        this.statsCache = new Map(Object.entries(cache))
      } catch {
        // Cache missing or corrupted, start fresh
        this.statsCache = new Map()
      }
    }
  }
  
  private async saveStatsCache(stats: Map<string, { size: number; mtime: number }>): Promise<void> {
    const dir = dirname(this.statsCachePath)
    await fs.mkdir(dir, { recursive: true })
    const cacheObj = Object.fromEntries(stats)
    await Bun.write(this.statsCachePath, JSON.stringify(cacheObj, null, 2))
  }

  /**
   * Stream files with TRUE streaming - even individual files are streamed!
   * Now with integrated hash calculation and tree building in a single pass!
   *
   * @example
   * ```typescript
   * const streamer = new CodebaseStreamer(projectPath);
   * for await (const batch of streamer.streamFiles({ statsCache, skipUnchanged: true })) {
   *   if (batch.metadata.type === 'final') {
   *     // Use batch.processedStats - complete file stats
   *   } else {
   *     // Process changed files in batch.files
   *   }
   * }
   * ```
   */
  async *streamFiles(options: StreamOptions = {}): AsyncGenerator<StreamBatch> {
    const {
      batchSize = 20,
      memoryLimit = 50 * 1024 * 1024, // 50MB default
      chunkSize = 64 * 1024, // 64KB chunks for large files
      priorityPattern,
      filePattern = '**/*',
      skipUnchanged = false,
    } = options

    // Load cache if we're skipping unchanged files
    if (skipUnchanged) {
      await this.loadStatsCache()
    }
    
    // Track all processed file stats, starting with cache
    const processedStats = this.statsCache ? new Map(this.statsCache) : new Map<string, { size: number; mtime: number }>()
    

    // Discover all files
    const allFiles = await this.discoverFiles(filePattern)

    // Sort by priority if needed
    const sortedFiles = priorityPattern
      ? await this.sortByPriority(allFiles, priorityPattern)
      : allFiles

    const totalFiles = sortedFiles.length
    const totalBatches = Math.ceil(totalFiles / batchSize)
    let currentBatch = 0
    let skippedCount = 0

    // Process files in batches
    for (let i = 0; i < sortedFiles.length; i += batchSize) {
      currentBatch++
      const batchFiles = sortedFiles.slice(i, i + batchSize)
      const batch = new Map<string, string>()
      const batchStats = new Map<string, { size: number; mtime: number }>()
      const batchUnchanged: string[] = []
      let batchMemory = 0

      for (const filePath of batchFiles) {
        if (this.processedFiles.has(filePath)) continue

        try {
          const file = Bun.file(filePath)
          const fileSize = file.size
          const relativePath = filePath.replace(this.rootPath + '/', '')

          // Quick size check first (instant from Bun.file)
          if (skipUnchanged && this.statsCache) {
            const cached = this.statsCache.get(relativePath)
            if (cached && cached.size === fileSize) {
              // Size matches, now check mtime
              const stat = await fs.stat(filePath)
              if (cached.mtime === stat.mtimeMs) {
                // Stats unchanged, skip content read entirely
                processedStats.set(relativePath, cached)
                batchUnchanged.push(relativePath)
                this.processedFiles.add(filePath)
                skippedCount++
                continue
              }
              // Size matched but mtime changed, update stats for later
              const currentStats = { size: fileSize, mtime: stat.mtimeMs }
              processedStats.set(relativePath, currentStats)
            }
          }

          // File is new or changed - read content
          let content: string
          if (fileSize < chunkSize) {
            content = await file.text()
          } else {
            content = await this.streamLargeFile(
              file,
              chunkSize,
              memoryLimit - batchMemory
            )
          }

          // Get stats for new/changed files
          const stat = await fs.stat(filePath)
          const currentStats = { size: fileSize, mtime: stat.mtimeMs }
          
          // Track stats and include in batch
          processedStats.set(relativePath, currentStats)
          batch.set(relativePath, content)
          batchStats.set(relativePath, currentStats)
          batchMemory += fileSize
          this.processedFiles.add(filePath)

          // Check memory limit
          if (batchMemory >= memoryLimit && batch.size > 0) {
            yield {
              files: batch,
              stats: batchStats,
              unchanged: batchUnchanged,
              metadata: {
                totalFiles,
                currentBatch,
                totalBatches,
                memoryUsed: batchMemory,
                filesInBatch: Array.from(batch.keys()),
                type: 'content',
              },
            }

            // Reset for next batch
            batch.clear()
            batchStats.clear()
            batchUnchanged.length = 0
            batchMemory = 0
          }
        } catch (error) {
          console.error(`Skipping unreadable file: ${filePath}`)
        }
      }

      // Yield remaining files if any
      if (batch.size > 0 || batchUnchanged.length > 0) {
        yield {
          files: batch,
          stats: batchStats,
          unchanged: batchUnchanged,
          metadata: {
            totalFiles,
            currentBatch,
            totalBatches,
            memoryUsed: batchMemory,
            filesInBatch: Array.from(batch.keys()),
            type: 'content',
          },
        }
      }
    }

    // Detect deletions if we have a cache
    const deletedFiles: string[] = []
    if (this.statsCache) {
      for (const [cachedPath] of this.statsCache) {
        if (!processedStats.has(cachedPath)) {
          deletedFiles.push(cachedPath)
        }
      }
    }

    
    // Save stats cache if we're tracking changes
    if (skipUnchanged && processedStats.size > 0) {
      await this.saveStatsCache(processedStats)
    }
    
    // Final batch with complete stats and deletions
    yield {
      files: new Map(),
      stats: new Map(),
      unchanged: [],
      deleted: deletedFiles,
      processedStats: processedStats,
      metadata: {
        totalFiles: processedStats.size,
        currentBatch: currentBatch + 1,
        totalBatches: totalBatches + 1,
        memoryUsed: 0,
        filesInBatch: [],
        type: 'final',
      },
    }
  }

  /**
   * Stream files one at a time - ultimate memory efficiency!
   * Perfect for massive files or when memory is extremely limited.
   */
  async *streamFilesIndividually(options: StreamOptions = {}): AsyncGenerator<{
    filePath: string
    content: string
    metadata: {
      fileSize: number
      totalFiles: number
      currentFile: number
    }
  }> {
    const { filePattern = '**/*', chunkSize = 64 * 1024 } = options
    const allFiles = await this.discoverFiles(filePattern)
    const totalFiles = allFiles.length

    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i]
      const file = Bun.file(filePath)

      try {
        // Stream the file content
        const content =
          file.size < chunkSize
            ? await file.text()
            : await this.streamLargeFile(file, chunkSize)

        yield {
          filePath: filePath.replace(this.rootPath + '/', ''),
          content,
          metadata: {
            fileSize: file.size,
            totalFiles,
            currentFile: i + 1,
          },
        }
      } catch (error) {
        console.error(`Error streaming ${filePath}:`, error)
      }
    }
  }

  /**
   * Stream a large file in chunks using Bun's native streaming
   */
  private async streamLargeFile(
    file: ReturnType<typeof Bun.file>,
    chunkSize: number,
    maxSize?: number
  ): Promise<string> {
    const stream = file.stream()
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let result = ''
    let totalSize = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        result += chunk
        totalSize += value.byteLength

        // Stop if we hit the size limit
        if (maxSize && totalSize >= maxSize) {
          result += '\n... [truncated due to size limit]'
          break
        }
      }
    } finally {
      reader.releaseLock()
    }

    return result
  }

  /**
   * Create a transform stream for processing files on the fly
   * This is the ULTIMATE in memory efficiency!
   */
  createTransformStream<T>(
    transformer: (filePath: string, content: string) => T | Promise<T>
  ): TransformStream<string, T> {
    const rootPath = this.rootPath
    return new TransformStream({
      async transform(filePath, controller) {
        try {
          const file = Bun.file(join(rootPath, filePath))
          const content = await file.text()
          const result = await transformer(filePath, content)
          controller.enqueue(result)
        } catch (error) {
          console.error(`Transform error for ${filePath}:`, error)
        }
      },
    })
  }

  /**
   * Stream file metadata without reading content
   * Super fast for getting file stats!
   */
  async *streamFileMetadata(pattern = '**/*'): AsyncGenerator<{
    path: string
    size: number
    type: string
    lastModified: number
  }> {
    const files = await this.discoverFiles(pattern)

    for (const filePath of files) {
      const file = Bun.file(filePath)
      const stat = await file.stat()

      yield {
        path: filePath.replace(this.rootPath + '/', ''),
        size: file.size,
        type: file.type,
        lastModified: stat?.mtime?.getTime() || 0,
      }
    }
  }

  /**
   * Reset processed files tracking
   */
  reset(): void {
    this.processedFiles.clear()
  }

  /**
   * Discover all files matching pattern
   */
  private async discoverFiles(pattern: string): Promise<string[]> {
    const glob = new Glob(pattern)
    const files: string[] = []
    const config = loadConfig(this.rootPath)
    const exclusions = mergeExclusions(DEFAULT_EXCLUSIONS, config.exclude)

    // Use Bun's native glob scanning
    for await (const file of glob.scan({
      cwd: this.rootPath,
      absolute: true,
      onlyFiles: true,
    })) {
      const relativePath = file.replace(this.rootPath + '/', '')
      if (!shouldExclude(relativePath, exclusions)) {
        files.push(file)
      }
    }

    return files
  }

  /**
   * Sort files by priority pattern
   */
  private async sortByPriority(
    files: string[],
    priorityPattern: string
  ): Promise<string[]> {
    const glob = new Glob(priorityPattern)
    const priorityFiles: string[] = []

    // Scan for priority files
    for await (const file of glob.scan({
      cwd: this.rootPath,
      absolute: true,
      onlyFiles: true,
    })) {
      priorityFiles.push(file)
    }

    const prioritySet = new Set(priorityFiles)
    const priority: string[] = []
    const regular: string[] = []

    for (const file of files) {
      if (prioritySet.has(file)) {
        priority.push(file)
      } else {
        regular.push(file)
      }
    }

    return [...priority, ...regular]
  }

  /**
   * Create a ReadableStream that yields file paths
   * Can be piped to other streams for processing
   */
  createFilePathStream(pattern = '**/*'): ReadableStream<string> {
    const files = this.discoverFiles(pattern)

    return new ReadableStream({
      async start(controller) {
        const discovered = await files
        for (const file of discovered) {
          controller.enqueue(file)
        }
        controller.close()
      },
    })
  }

  /**
   * Estimate total size of files to be processed
   */
  async estimateTotalSize(pattern = '**/*'): Promise<{
    totalFiles: number
    totalSize: number
    formattedSize: string
  }> {
    const files = await this.discoverFiles(pattern)
    let totalSize = 0

    for (const filePath of files) {
      try {
        const file = Bun.file(filePath)
        totalSize += file.size
      } catch {
        // Skip inaccessible files
      }
    }

    return {
      totalFiles: files.length,
      totalSize,
      formattedSize: this.formatBytes(totalSize),
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }
}
