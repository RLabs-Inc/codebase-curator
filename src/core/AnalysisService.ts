/**
 * Analysis Service
 * Unified wrapper for all analysis algorithms
 */

import { ImportMapper } from '../algorithms/importMapper'
import { FrameworkDetector } from '../algorithms/frameworkDetector'
import { FileOrganizationAnalyzer } from '../algorithms/fileOrganizationAnalyzer'
import { PatternAggregator } from '../algorithms/patternAggregator'
import { CodeSimilarityAnalyzer } from '../algorithms/codeSimilarityAnalyzer'
import { ContextManager } from '../services/contextManager'
import type {
  CoreService,
  AnalysisRequest,
  AnalysisResult,
  ServiceStatus,
} from '../types/core'

/**
 * Available analysis algorithms
 */
const ANALYSIS_ALGORITHMS = {
  imports: ImportMapper,
  frameworks: FrameworkDetector,
  organization: FileOrganizationAnalyzer,
  patterns: PatternAggregator,
  similarity: CodeSimilarityAnalyzer,
} as const

type AnalysisType = keyof typeof ANALYSIS_ALGORITHMS

/**
 * Service that orchestrates all analysis algorithms
 */
export class AnalysisService implements CoreService {
  private contextManager: ContextManager
  private initialized = false

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Any initialization logic here
    this.initialized = true
  }

  /**
   * Run a specific analysis
   */
  async runAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now()
    const errors: string[] = []

    try {
      // Check cache first
      const cacheKey = `${request.type}-${request.projectPath}`
      const cached = await this.contextManager.getCachedAnalysis(
        request.projectPath,
        request.type
      )

      if (cached && this.isCacheValid(cached)) {
        return {
          type: request.type,
          timestamp: cached.timestamp || Date.now(),
          projectPath: request.projectPath,
          data: cached,
          summary: this.generateSummary(request.type, cached),
          metrics: {
            duration: Date.now() - startTime,
            filesAnalyzed: 0, // From cache
          },
        }
      }

      // Run the analysis
      const result = await this.executeAnalysis(request)

      // Cache the result
      await this.contextManager.cacheAnalysis(
        request.projectPath,
        request.type,
        result
      )

      return {
        type: request.type,
        timestamp: Date.now(),
        projectPath: request.projectPath,
        data: result,
        summary: this.generateSummary(request.type, result),
        errors: errors.length > 0 ? errors : undefined,
        metrics: {
          duration: Date.now() - startTime,
          filesAnalyzed: this.getFileCount(result),
        },
      }
    } catch (error) {
      console.error(`[AnalysisService] Analysis failed:`, error)
      errors.push(error instanceof Error ? error.message : String(error))

      return {
        type: request.type,
        timestamp: Date.now(),
        projectPath: request.projectPath,
        data: null,
        errors,
        metrics: {
          duration: Date.now() - startTime,
          filesAnalyzed: 0,
        },
      }
    }
  }

  /**
   * Run all analyses
   */
  async runAllAnalyses(
    projectPath: string
  ): Promise<Record<string, AnalysisResult>> {
    const results: Record<string, AnalysisResult> = {}

    // Run analyses in parallel
    const promises = Object.keys(ANALYSIS_ALGORITHMS).map(async (type) => {
      const result = await this.runAnalysis({
        type: type as AnalysisType,
        projectPath,
      })
      results[type] = result
    })

    await Promise.all(promises)
    return results
  }

  /**
   * Execute a specific analysis algorithm
   */
  private async executeAnalysis(request: AnalysisRequest): Promise<any> {
    const AlgorithmClass = ANALYSIS_ALGORITHMS[request.type as AnalysisType]

    if (!AlgorithmClass) {
      throw new Error(`Unknown analysis type: ${request.type}`)
    }

    // Instantiate and run the algorithm based on type
    let algorithm: any
    
    switch (request.type) {
      case 'imports':
        algorithm = new ImportMapper(
          request.projectPath,
          request.options?.exclude,
          request.options?.include
        )
        break
      case 'frameworks':
        algorithm = new FrameworkDetector(request.projectPath)
        break
      case 'organization':
        algorithm = new FileOrganizationAnalyzer(request.projectPath)
        break
      case 'patterns':
        algorithm = new PatternAggregator(
          request.projectPath,
          request.options?.exclude,
          request.options?.include
        )
        break
      case 'similarity':
        algorithm = new CodeSimilarityAnalyzer(
          request.projectPath,
          request.options?.exclude,
          request.options?.include
        )
        break
      default:
        throw new Error(`Unknown analysis type: ${request.type}`)
    }

    return await algorithm.analyze()
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(cached: any): boolean {
    // For now, rely on ContextManager's TTL
    // Could add additional validation here
    return true
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(type: string, data: any): string {
    switch (type) {
      case 'imports':
        return data?.summary || 'Import analysis complete'

      case 'frameworks':
        return data?.summary || 'Framework detection complete'

      case 'organization':
        return `Found ${data?.patterns?.length || 0} organizational patterns`

      case 'patterns':
        return `Discovered ${
          data?.statistics?.totalPatterns || 0
        } code patterns`

      case 'similarity':
        return `Found ${
          data?.statistics?.totalClusters || 0
        } similar code clusters`

      default:
        return 'Analysis complete'
    }
  }

  /**
   * Extract file count from result
   */
  private getFileCount(result: any): number {
    if (result?.summary?.totalFiles) return result.summary.totalFiles
    if (result?.statistics?.filesAnalyzed)
      return result.statistics.filesAnalyzed
    if (result?.files?.length) return result.files.length
    return 0
  }

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    return {
      ready: this.initialized,
      cache: {
        enabled: true,
        size: 0, // Would need to implement cache size tracking
        hits: 0, // Would need to implement hit tracking
        misses: 0, // Would need to implement miss tracking
      },
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Any cleanup logic here
    this.initialized = false
  }
}
