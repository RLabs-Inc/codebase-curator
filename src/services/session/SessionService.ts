/**
 * Session Service
 * Manages curator session persistence and history
 */

import { existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import type { CoreService, ServiceStatus } from '../../shared/types/core.js'
import type { Session, SessionHistoryEntry } from '../../shared/types/session.js'

/**
 * Service for managing curator sessions
 */
export class SessionService implements CoreService {
  private sessionsDir: string
  private sessions: Map<string, Session> = new Map()

  constructor(baseDir: string = '.curator') {
    this.sessionsDir = baseDir
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Load existing sessions
    await this.loadSessions()
  }

  /**
   * Get or create a session
   */
  async getOrCreateSession(
    projectPath: string,
    sessionId?: string
  ): Promise<Session> {
    // If session ID provided, try to get it
    if (sessionId) {
      const session = this.sessions.get(sessionId)
      if (session && session.projectPath === projectPath) {
        // Update last accessed time
        session.lastAccessedAt = Date.now()
        await this.saveSession(session)
        return session
      }
    }

    // Look for existing session for this project
    for (const [id, session] of this.sessions) {
      if (session.projectPath === projectPath) {
        session.lastAccessedAt = Date.now()
        await this.saveSession(session)
        return session
      }
    }

    // Create new session
    const newSession: Session = {
      id: this.generateSessionId(),
      projectPath,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      metadata: {
        questionsAsked: 0,
        toolsUsed: [],
      },
    }

    this.sessions.set(newSession.id, newSession)
    await this.saveSession(newSession)

    return newSession
  }

  /**
   * Update session metadata
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    // Merge updates
    Object.assign(session, updates)
    session.lastAccessedAt = Date.now()

    // Update metadata
    if (updates.metadata) {
      session.metadata = { ...session.metadata, ...updates.metadata }
    }

    await this.saveSession(session)
  }

  /**
   * Add to session history
   */
  async addToHistory(
    sessionId: string,
    entry: SessionHistoryEntry
  ): Promise<void> {
    const historyFile = this.getHistoryFile(sessionId)
    const history = await this.loadHistory(sessionId)

    history.push(entry)

    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100)
    }

    await this.saveHistory(sessionId, history)
  }

  /**
   * Get session history
   */
  async getHistory(sessionId: string): Promise<SessionHistoryEntry[]> {
    return await this.loadHistory(sessionId)
  }

  /**
   * Get all sessions for a project
   */
  getProjectSessions(projectPath: string): Session[] {
    const sessions: Session[] = []

    for (const session of this.sessions.values()) {
      if (session.projectPath === projectPath) {
        sessions.push(session)
      }
    }

    return sessions.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAgeDays: number = 30): number {
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000
    const now = Date.now()
    let cleaned = 0

    for (const [id, session] of this.sessions) {
      if (now - session.lastAccessedAt > maxAge) {
        this.sessions.delete(id)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Load sessions from disk
   */
  private async loadSessions(): Promise<void> {
    const sessionDir = this.getSessionDir()

    if (!existsSync(sessionDir)) {
      return
    }

    try {
      const files = readdirSync(sessionDir)

      for (const file of files) {
        if (file.endsWith('.json') && file.startsWith('session-')) {
          const sessionPath = join(sessionDir, file)
          const sessionFile = Bun.file(sessionPath)
          const session = (await sessionFile.json()) as Session
          this.sessions.set(session.id, session)
        }
      }
    } catch (error) {
      console.error('[SessionService] Error loading sessions:', error)
    }
  }

  /**
   * Save a session
   */
  private async saveSession(session: Session): Promise<void> {
    const sessionDir = this.getSessionDir()

    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true })
    }

    const sessionPath = join(sessionDir, `session-${session.id}.json`)
    await Bun.write(sessionPath, JSON.stringify(session, null, 2))
  }

  /**
   * Load session history
   */
  private async loadHistory(sessionId: string): Promise<SessionHistoryEntry[]> {
    const historyFile = this.getHistoryFile(sessionId)

    if (!existsSync(historyFile)) {
      return []
    }

    try {
      const file = Bun.file(historyFile)
      return await file.json()
    } catch {
      return []
    }
  }

  /**
   * Save session history
   */
  private async saveHistory(
    sessionId: string,
    history: SessionHistoryEntry[]
  ): Promise<void> {
    const historyFile = this.getHistoryFile(sessionId)
    const dir = dirname(historyFile)

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    await Bun.write(historyFile, JSON.stringify(history, null, 2))
  }

  /**
   * Get session directory
   */
  private getSessionDir(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || ''
    return join(homeDir, '.codebase-curator', 'sessions')
  }

  /**
   * Get history file path
   */
  private getHistoryFile(sessionId: string): string {
    return join(this.getSessionDir(), `history-${sessionId}.json`)
  }

  /**
   * Generate a new session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    return {
      ready: true,
      sessions: {
        count: this.sessions.size,
        active: Array.from(this.sessions.keys()),
      },
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Save all sessions before cleanup
    for (const session of this.sessions.values()) {
      await this.saveSession(session)
    }
    this.sessions.clear()
  }
}
