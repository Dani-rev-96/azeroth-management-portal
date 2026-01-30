import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { RealmId } from '~/types'

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data', 'mappings.db')

// Checkpoint interval in milliseconds (default: 5 minutes)
const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000

let db: Database.Database | null = null
let checkpointTimer: ReturnType<typeof setInterval> | null = null
let shutdownHandlersRegistered = false

/**
 * Get or initialize the SQLite database connection
 * Creates the database file and schema if they don't exist
 */
export function getDatabase() {
  if (!db) {
    // Ensure data directory exists (based on DB_PATH)
    const dataDir = dirname(DB_PATH)
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL') // Write-Ahead Logging for better concurrency
    db.pragma('foreign_keys = ON')

    initSchema()
    startPeriodicCheckpoint()
    registerShutdownHandlers()
  }
  return db
}

/**
 * Perform a WAL checkpoint to write changes back to the main database file
 * Uses PASSIVE mode to avoid blocking concurrent readers
 */
export function checkpoint(): { walPages: number; movedPages: number } {
  if (!db) return { walPages: 0, movedPages: 0 }

  try {
    const result = db.pragma('wal_checkpoint(PASSIVE)') as Array<{ busy: number; log: number; checkpointed: number }>
    const first = result[0]
    if (first) {
      return { walPages: first.log, movedPages: first.checkpointed }
    }
  } catch (error) {
    console.error('[SQLite] Checkpoint failed:', error)
  }
  return { walPages: 0, movedPages: 0 }
}

/**
 * Start periodic WAL checkpointing to prevent unbounded WAL growth
 */
function startPeriodicCheckpoint() {
  if (checkpointTimer) return

  checkpointTimer = setInterval(() => {
    const { walPages, movedPages } = checkpoint()
    if (walPages > 0) {
      console.log(`[SQLite] Checkpoint completed: ${movedPages}/${walPages} pages written to main database`)
    }
  }, CHECKPOINT_INTERVAL_MS)

  // Don't let the timer prevent the process from exiting
  checkpointTimer.unref()
}

/**
 * Register handlers for graceful shutdown
 * Ensures WAL is checkpointed and database is closed properly
 */
function registerShutdownHandlers() {
  if (shutdownHandlersRegistered) return
  shutdownHandlersRegistered = true

  const gracefulShutdown = (signal: string) => {
    console.log(`[SQLite] Received ${signal}, performing graceful shutdown...`)
    closeDatabase()
    process.exit(0)
  }

  // Handle common termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  // Handle process exit (but can't do async work here)
  process.on('beforeExit', () => {
    closeDatabase()
  })
}

/**
 * Initialize database schema
 * Creates tables and indexes if they don't exist
 */
function initSchema() {
  if (!db) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS account_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      wow_account_id INTEGER NOT NULL,
      wow_account_username TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME,
      metadata TEXT,
      UNIQUE(external_id, wow_account_id)
    );

    CREATE INDEX IF NOT EXISTS idx_external_id
      ON account_mappings(external_id);

    CREATE INDEX IF NOT EXISTS idx_wow_account_id
      ON account_mappings(wow_account_id);
  `)
}

/**
 * Account mapping data structure
 */
export interface DBAccountMapping {
  id: number
  external_id: string
  display_name: string
  email: string | null
  wow_account_id: number
  wow_account_username: string
  created_at: string
  last_used: string | null
  metadata: string | null
}

/**
 * Database operations for account mappings
 */
export const AccountMappingDB = {
  /**
   * Find all mappings for an external user
   */
  findByExternalId(externalId: string): DBAccountMapping[] {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM account_mappings WHERE external_id = ?')
    return stmt.all(externalId) as DBAccountMapping[]
  },

  /**
   * Find a specific mapping
   */
  findByIds(externalId: string, wowAccountId: number): DBAccountMapping | undefined {
    const db = getDatabase()
    const stmt = db.prepare(
      'SELECT * FROM account_mappings WHERE external_id = ? AND wow_account_id = ?'
    )
    return stmt.get(externalId, wowAccountId) as DBAccountMapping | undefined
  },

  /**
   * Create a new account mapping
   */
  create(mapping: {
    externalId: string
    displayName: string
    email?: string
    wowAccountId: number
    wowAccountUsername: string
    metadata?: Record<string, any>
  }): DBAccountMapping {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO account_mappings
        (external_id, display_name, email, wow_account_id, wow_account_username, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      mapping.externalId,
      mapping.displayName,
      mapping.email || null,
      mapping.wowAccountId,
      mapping.wowAccountUsername,
      mapping.metadata ? JSON.stringify(mapping.metadata) : null
    )

    // Return the created mapping
    const created = db.prepare('SELECT * FROM account_mappings WHERE id = ?').get(result.lastInsertRowid)
    return created as DBAccountMapping
  },

  /**
   * Update last_used timestamp
   */
  updateLastUsed(externalId: string, wowAccountId: number): void {
    const db = getDatabase()
    const stmt = db.prepare(
      'UPDATE account_mappings SET last_used = CURRENT_TIMESTAMP WHERE external_id = ? AND wow_account_id = ?'
    )
    stmt.run(externalId, wowAccountId)
  },

  /**
   * Delete a mapping
   */
  delete(externalId: string, wowAccountId: number): boolean {
    const db = getDatabase()
    const stmt = db.prepare(
      'DELETE FROM account_mappings WHERE external_id = ? AND wow_account_id = ?'
    )
    const result = stmt.run(externalId, wowAccountId)
    return result.changes > 0
  },

  /**
   * Get all mappings (for export/admin)
   */
  findAll(): DBAccountMapping[] {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM account_mappings ORDER BY created_at DESC')
    return stmt.all() as DBAccountMapping[]
  },

  /**
   * Check if a mapping exists
   */
  exists(externalId: string, wowAccountId: number): boolean {
    const db = getDatabase()
    const stmt = db.prepare(
      'SELECT 1 FROM account_mappings WHERE external_id = ? AND wow_account_id = ? LIMIT 1'
    )
    return stmt.get(externalId, wowAccountId) !== undefined
  },

  /**
   * Delete a mapping by its ID (for admin use)
   */
  deleteById(id: number): boolean {
    const db = getDatabase()
    const stmt = db.prepare('DELETE FROM account_mappings WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  },

  /**
   * Find a mapping by ID
   */
  findById(id: number): DBAccountMapping | undefined {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM account_mappings WHERE id = ?')
    return stmt.get(id) as DBAccountMapping | undefined
  },
}

/**
 * Close database connection (useful for cleanup in tests)
 * Performs a final checkpoint to ensure all WAL changes are written to the main database
 */
export function closeDatabase() {
  if (checkpointTimer) {
    clearInterval(checkpointTimer)
    checkpointTimer = null
  }

  if (db) {
    try {
      // Final checkpoint with TRUNCATE to reset the WAL file
      db.pragma('wal_checkpoint(TRUNCATE)')
      console.log('[SQLite] Final checkpoint completed, WAL truncated')
    } catch (error) {
      console.error('[SQLite] Final checkpoint failed:', error)
    }

    db.close()
    db = null
    console.log('[SQLite] Database connection closed')
  }
}
