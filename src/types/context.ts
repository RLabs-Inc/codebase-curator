// Context Management System Types
// These types support the educational tool that helps AI assistants
// understand and use the /compact command effectively

export interface CompactInstructionExample {
  scenario: string;
  instruction: string;
  explanation: string;
}

// Analysis Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hash: string;
  projectPath: string;
}

export interface AnalysisCache {
  imports?: CacheEntry<any>;
  frameworks?: CacheEntry<any>;
  organization?: CacheEntry<any>;
  patterns?: CacheEntry<any>;
  similarity?: CacheEntry<any>;
}

export interface FileMetadata {
  path: string;
  hash: string;
  lastModified: number;
  size: number;
}

export interface HashTreeNode {
  path: string;
  hash: string;
  type: 'file' | 'directory';
  children?: Map<string, HashTreeNode>;
  metadata?: FileMetadata;
}

export interface ProjectMetadata {
  path: string;
  fileCount: number;
  lastAnalyzed: number;
  files: Map<string, FileMetadata>;
  hashTree?: HashTreeNode;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Max cache size in MB
  compressionEnabled?: boolean;
}