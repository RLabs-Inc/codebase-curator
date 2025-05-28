/**
 * Curator Service
 * Main orchestration service that coordinates all curator functionality
 */

import { ContextManager } from "../services/contextManager";
import { AnalysisService } from "./AnalysisService";
import { CuratorProcessService } from "./CuratorProcessService";
import { SessionService } from "./SessionService";
import {
  getCuratorContext,
  OVERVIEW_PROMPT,
  ADD_FEATURE_PROMPT,
  IMPLEMENT_CHANGE_PROMPT,
  INTEGRATION_PROMPT,
  ADD_FEATURE_DIRECT_PROMPT,
  IMPLEMENT_CHANGE_DIRECT_PROMPT,
} from "./curatorPrompts";
import type {
  CoreService,
  CuratorOptions,
  ServiceStatus,
  AnalysisRequest,
  AnalysisResult,
  CuratorQuery,
  CuratorResponse,
  FeatureRequest,
  ChangeRequest,
} from "../types/core";

/**
 * Main curator service that orchestrates all functionality
 */
export class CuratorService implements CoreService {
  private contextManager: ContextManager;
  private analysisService: AnalysisService;
  private curatorProcess: CuratorProcessService;
  private sessionService: SessionService;
  private options: Required<CuratorOptions>;
  private initialized = false;

  constructor(options: CuratorOptions = {}) {
    // Set default options
    this.options = {
      projectPath: options.projectPath || process.cwd(),
      cacheEnabled: options.cacheEnabled ?? true,
      cache: options.cache || {},
      sessionPersistence: options.sessionPersistence ?? true,
      claudePath: options.claudePath as string,
      maxMemory: options.maxMemory || 512,
    };

    // Initialize services
    this.contextManager = new ContextManager(this.options.cache);
    this.analysisService = new AnalysisService(this.contextManager);
    this.curatorProcess = new CuratorProcessService({
      claudePath: this.options.claudePath,
    });
    this.sessionService = new SessionService();
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.analysisService.initialize?.(),
      this.sessionService.initialize?.(),
    ]);

    this.initialized = true;
  }

  /**
   * Get a comprehensive overview of the codebase
   */
  async getOverview(projectPath?: string): Promise<string> {
    const targetPath = projectPath || this.options.projectPath;

    // Run all analyses in parallel
    const analyses = await this.analysisService.runAllAnalyses(targetPath);

    // Create initial context from analyses
    const context = this.createOverviewContext(analyses);

    // Ask curator for comprehensive overview
    const query: CuratorQuery = {
      question: this.getOverviewPrompt(context),
      projectPath: targetPath,
      newSession: true, // Always fresh for overviews
    };

    const response = await this.curatorProcess.ask(query);

    // Track in session history
    if (this.options.sessionPersistence) {
      const session = await this.sessionService.getOrCreateSession(targetPath);
      this.sessionService.addToHistory(session.id, {
        timestamp: Date.now(),
        type: "overview",
        query: "get_codebase_overview",
        responseSummary: response.content.substring(0, 200) + "...",
      });
    }

    return response.content;
  }

  /**
   * Ask a question about the codebase with dynamic prompt detection
   */
  async askCurator(query: CuratorQuery): Promise<CuratorResponse> {
    await this.initialize();

    const targetPath = query.projectPath || this.options.projectPath;

    // Detect request type based on keywords (matches original behavior)
    const question = query.question.toLowerCase();

    const isOverviewRequest =
      question.includes("overview") ||
      question.includes("what is this") ||
      question.includes("understand this codebase");

    const isAddFeatureRequest =
      question.includes("add") &&
      (question.includes("feature") || question.includes("implement"));

    const isIntegrationRequest =
      question.includes("where") &&
      (question.includes("integrate") ||
        question.includes("add") ||
        question.includes("put"));

    // Select appropriate specialized prompt
    let specializedPrompt = "";
    let promptType = "general";

    if (isOverviewRequest) {
      specializedPrompt = OVERVIEW_PROMPT;
      promptType = "overview";
    } else if (isAddFeatureRequest) {
      specializedPrompt = ADD_FEATURE_PROMPT;
      promptType = "feature";
    } else if (isIntegrationRequest) {
      specializedPrompt = INTEGRATION_PROMPT;
      promptType = "integration";
    } else {
      // Default: just pass through the question
      specializedPrompt = `USER QUESTION: ${query.question}`;
    }

    // Get analysis context
    const analyses = await this.analysisService.runAllAnalyses(targetPath);
    const contextSummary = this.createOverviewContext(analyses);

    // Build full prompt with curator context
    const fullPrompt = getCuratorContext(specializedPrompt, contextSummary);

    // Create the actual query with the full prompt
    const curatorQuery: CuratorQuery = {
      question: fullPrompt,
      projectPath: targetPath,
      newSession: query.newSession,
    };

    // Get or create session
    let session = null;
    if (this.options.sessionPersistence) {
      session = await this.sessionService.getOrCreateSession(
        targetPath,
        query.sessionId,
      );
      curatorQuery.sessionId = session.id;
    }

    // Ask the curator with the full prompt
    const response = await this.curatorProcess.ask(curatorQuery);

    // Update session
    if (session) {
      this.sessionService.updateSession(session.id, {
        metadata: {
          questionsAsked: (session.metadata?.questionsAsked || 0) + 1,
        },
      });

      await this.sessionService.addToHistory(session.id, {
        timestamp: Date.now(),
        type: promptType as "overview" | "question" | "feature" | "change",
        query: query.question,
        responseSummary: response.content.substring(0, 200) + "...",
      });
    }

    return response;
  }

  /**
   * Get guidance for adding a new feature
   */
  async addNewFeature(request: FeatureRequest): Promise<string> {
    const targetPath = request.projectPath || this.options.projectPath;

    // Run targeted analyses
    const [imports, frameworks, organization] = await Promise.all([
      this.analysisService.runAnalysis({
        type: "imports",
        projectPath: targetPath,
      }),
      this.analysisService.runAnalysis({
        type: "frameworks",
        projectPath: targetPath,
      }),
      this.analysisService.runAnalysis({
        type: "organization",
        projectPath: targetPath,
      }),
    ]);

    // Create feature-specific prompt
    const prompt = this.getFeaturePrompt(request.feature, {
      imports,
      frameworks,
      organization,
    });

    // Ask curator
    const query: CuratorQuery = {
      question: prompt,
      projectPath: targetPath,
      newSession: false, // Continue in context
    };

    const response = await this.curatorProcess.ask(query);

    // Track in session
    if (this.options.sessionPersistence) {
      const session = await this.sessionService.getOrCreateSession(targetPath);
      await this.sessionService.addToHistory(session.id, {
        timestamp: Date.now(),
        type: "feature",
        query: request.feature,
        responseSummary: `Feature guidance: ${request.feature.substring(0, 100)}...`,
      });
    }

    return response.content;
  }

  /**
   * Get guidance for implementing a change
   */
  async implementChange(request: ChangeRequest): Promise<string> {
    const targetPath = request.projectPath || this.options.projectPath;

    // Run targeted analyses
    const analyses = await this.analysisService.runAllAnalyses(targetPath);

    // Create change-specific prompt
    const prompt = this.getChangePrompt(
      request.change,
      analyses,
      request.scope,
    );

    // Ask curator
    const query: CuratorQuery = {
      question: prompt,
      projectPath: targetPath,
      newSession: false,
    };

    const response = await this.curatorProcess.ask(query);

    // Track in session
    if (this.options.sessionPersistence) {
      const session = await this.sessionService.getOrCreateSession(targetPath);
      await this.sessionService.addToHistory(session.id, {
        timestamp: Date.now(),
        type: "change",
        query: request.change,
        responseSummary: `Change guidance: ${request.change.substring(0, 100)}...`,
      });
    }

    return response.content;
  }

  /**
   * Run a specific analysis
   */
  async runAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    await this.initialize();
    return this.analysisService.runAnalysis(request);
  }

  /**
   * Get curator memory/notes
   */
  async getCuratorMemory(projectPath?: string): Promise<string> {
    const targetPath = projectPath || this.options.projectPath;

    // Read memory file
    const memoryPath = `${targetPath}/.curator/memory.md`;

    try {
      const { readFileSync } = await import("fs");
      return readFileSync(memoryPath, "utf-8");
    } catch {
      return "No curator memory found for this project.";
    }
  }

  /**
   * Clear curator session
   */
  async clearSession(projectPath?: string): Promise<void> {
    const targetPath = projectPath || this.options.projectPath;

    if (this.options.sessionPersistence) {
      const sessions = this.sessionService.getProjectSessions(targetPath);
      // Clear all sessions for this project
      for (const session of sessions) {
        this.sessionService.updateSession(session.id, {
          metadata: { cleared: true },
        });
      }
    }

    // Clear curator directory
    const { rmSync, existsSync } = await import("fs");
    const curatorDir = `${targetPath}/.curator`;

    if (existsSync(curatorDir)) {
      rmSync(curatorDir, { recursive: true, force: true });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return this.contextManager.getStats();
  }

  /**
   * Create overview context from analyses
   */
  private createOverviewContext(
    analyses: Record<string, AnalysisResult>,
  ): string {
    const summary = {
      projectPath: this.options.projectPath,
      imports: analyses.imports?.summary,
      frameworks: analyses.frameworks?.summary,
      organization: analyses.organization?.summary,
      patterns: analyses.patterns?.summary,
      similarity: analyses.similarity?.summary,
    };

    return JSON.stringify(summary, null, 2);
  }

  /**
   * Get overview prompt
   */
  private getOverviewPrompt(context: string): string {
    // Use the full curator context with the overview prompt
    return getCuratorContext(OVERVIEW_PROMPT, context);
  }

  /**
   * Get feature prompt (direct tool version)
   */
  private getFeaturePrompt(feature: string, analyses: any): string {
    // Build context summary
    const contextSummary = this.createOverviewContext({
      imports: analyses.imports,
      frameworks: analyses.frameworks,
      organization: analyses.organization,
    });

    // Use the direct prompt (simpler version)
    const directPrompt = ADD_FEATURE_DIRECT_PROMPT.replace(
      "{feature}",
      feature,
    );

    return getCuratorContext(directPrompt, contextSummary);
  }

  /**
   * Get change prompt (direct tool version)
   */
  private getChangePrompt(
    change: string,
    analyses: any,
    scope?: string[],
  ): string {
    // Build context summary
    const contextSummary = this.createOverviewContext(analyses);

    // Use the direct prompt (simpler version)
    let directPrompt = IMPLEMENT_CHANGE_DIRECT_PROMPT.replace(
      "{change}",
      change,
    );

    // Add scope if provided
    if (scope && scope.length > 0) {
      directPrompt = `SCOPE: ${scope.join(", ")}\n\n${directPrompt}`;
    }

    return getCuratorContext(directPrompt, contextSummary);
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<ServiceStatus> {
    const [analysisStatus, curatorStatus, sessionStatus] = await Promise.all([
      this.analysisService.getStatus?.() || { ready: true },
      this.curatorProcess.getStatus?.() || { ready: true },
      this.sessionService.getStatus?.() || { ready: true },
    ]);

    return {
      ready: this.initialized,
      cache: analysisStatus.cache,
      claude: curatorStatus.claude,
      sessions: sessionStatus.sessions,
    };
  }

  /**
   * Cleanup all services
   */
  async cleanup(): Promise<void> {
    await Promise.all([
      this.analysisService.cleanup?.(),
      this.sessionService.cleanup?.(),
    ]);

    this.initialized = false;
  }
}

/**
 * Factory function for creating curator service
 */
export function createCuratorService(options?: CuratorOptions): CuratorService {
  return new CuratorService(options);
}
