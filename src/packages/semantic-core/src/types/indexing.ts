// Indexing-related type definitions

// From HashTree.ts
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

// From IncrementalIndexer.ts
export interface IndexingStatus {
  totalFiles: number;
  indexedFiles: number;
  isWatching: boolean;
  lastUpdate: number;
}

// From CodebaseStreamer.ts
export interface StreamBatch {
  files: Map<string, string>;         // Files with content
  hashes: Map<string, string>;        // Content hashes for files
  metadata: {
    totalFiles: number;
    currentBatch: number;
    totalBatches: number;
    memoryUsed: number;
    filesInBatch: string[];
    unchanged?: number;               // Count of unchanged files
  };
}

export interface StreamOptions {
  batchSize?: number;                // Number of files per batch (default: 20)
  memoryLimit?: number;              // Max memory per batch in bytes (default: 50MB)
  priorityPattern?: string;          // Process these files first (e.g., "*.ts")
  filePattern?: string;              // Which files to include (default: "**/*")
  chunkSize?: number;                // Size for streaming large files (default: 64KB)
}