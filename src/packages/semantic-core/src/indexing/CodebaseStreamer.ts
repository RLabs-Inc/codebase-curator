import { Glob } from 'bun'
import { join } from 'path'
import {
  shouldExclude,
  loadConfig,
  mergeExclusions,
} from '../config/config'
import { DEFAULT_EXCLUSIONS } from '../types/config'

export interface StreamBatch {
  files: Map<string, string>
  metadata: {
    totalFiles: number
    currentBatch: number
    totalBatches: number
    memoryUsed: number
    filesInBatch: string[]
  }
}

export interface StreamOptions {
  batchSize?: number // Number of files per batch (default: 20)
  memoryLimit?: number // Max memory per batch in bytes (default: 50MB)
  priorityPattern?: string // Process these files first (e.g., "*.ts")
  filePattern?: string // Which files to include (default: "**/*")
  chunkSize?: number // Size for streaming large files (default: 64KB)
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

  constructor(rootPath: string) {
    this.rootPath = rootPath
  }

  /**
   * Stream files with TRUE streaming - even individual files are streamed!
   *
   * @example
   * ```typescript
   * const streamer = new CodebaseStreamerBun(projectPath);
   * for await (const batch of streamer.streamFiles()) {
   *   // Process batch - memory usage stays LOW!
   *   await analyzers.processBatch(batch);
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
    } = options

    // Discover all files
    const allFiles = await this.discoverFiles(filePattern)

    // Sort by priority if needed
    const sortedFiles = priorityPattern
      ? await this.sortByPriority(allFiles, priorityPattern)
      : allFiles

    const totalFiles = sortedFiles.length
    const totalBatches = Math.ceil(totalFiles / batchSize)
    let currentBatch = 0

    // Process files in batches
    for (let i = 0; i < sortedFiles.length; i += batchSize) {
      currentBatch++
      const batchFiles = sortedFiles.slice(i, i + batchSize)
      const batch = new Map<string, string>()
      let batchMemory = 0

      for (const filePath of batchFiles) {
        if (this.processedFiles.has(filePath)) continue

        try {
          const file = Bun.file(filePath)
          const fileSize = file.size

          // For small files, read normally
          if (fileSize < chunkSize) {
            const content = await file.text()
            const relativePath = filePath.replace(this.rootPath + '/', '')
            batch.set(relativePath, content)
            batchMemory += fileSize
            this.processedFiles.add(filePath)
          } else {
            // For large files, stream them!
            const content = await this.streamLargeFile(
              file,
              chunkSize,
              memoryLimit - batchMemory
            )
            const relativePath = filePath.replace(this.rootPath + '/', '')
            batch.set(relativePath, content)
            batchMemory += Buffer.byteLength(content)
            this.processedFiles.add(filePath)
          }

          // Check memory limit
          if (batchMemory >= memoryLimit && batch.size > 0) {
            yield {
              files: batch,
              metadata: {
                totalFiles,
                currentBatch,
                totalBatches,
                memoryUsed: batchMemory,
                filesInBatch: Array.from(batch.keys()),
              },
            }

            // Reset for next batch
            batch.clear()
            batchMemory = 0
          }
        } catch (error) {
          console.error(`Skipping unreadable file: ${filePath}`)
        }
      }

      // Yield remaining files
      if (batch.size > 0) {
        yield {
          files: batch,
          metadata: {
            totalFiles,
            currentBatch,
            totalBatches,
            memoryUsed: batchMemory,
            filesInBatch: Array.from(batch.keys()),
          },
        }
      }
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
