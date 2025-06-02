/**
 * Semantic Core - Main exports
 * This package provides the core semantic indexing functionality
 */

// Re-export everything from the semantic service
export * from './SemanticService'
export * from './SemanticIndexImpl'
export * from './types'

// Re-export extractors
export * from './extractors/TypeScriptExtractor'
export * from './extractors/PythonExtractor'
export * from './extractors/GoExtractor'
export * from './extractors/RustExtractor'
export * from './extractors/SwiftExtractor'
export * from './extractors/ShellExtractor'
export * from './extractors/JsonExtractor'
export * from './extractors/YamlExtractor'
export * from './extractors/TomlExtractor'
export * from './extractors/EnvExtractor'

// Re-export indexing services
export * from './indexing/CodebaseStreamer'
export * from './indexing/HashTree'
export * from './indexing/IncrementalIndexer'

// Re-export config utilities
export * from './config/config'
export * from './types/config'
export * from './types/core'
