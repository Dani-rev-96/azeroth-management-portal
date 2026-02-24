import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'

const DB_PATH = process.env.USER_SETTINGS_DB_PATH || join(process.cwd(), 'data', 'user-settings.db')

const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000

let db: Database.Database | null = null
let checkpointTimer: ReturnType<typeof setInterval> | null = null
let shutdownHandlersRegistered = false

// ─── Feature ID Registry ───────────────────────────────────────────────────────
// Every admin/GM feature has a unique ID used for granting time-limited access.

export const ADMIN_FEATURES = {
  'admin.accounts': { label: 'All Accounts', description: 'View and manage all WoW accounts', icon: '👥' },
  'admin.mappings': { label: 'Account Mappings', description: 'View external → WoW account mappings', icon: '🔗' },
  'admin.link-accounts': { label: 'Link Accounts', description: 'Create and manage account links', icon: '🔧' },
  'admin.gm': { label: 'GM Management', description: 'Set GM levels and send mail', icon: '🛡️' },
  'admin.mail': { label: 'Send Mail', description: 'Send in-game mail with items', icon: '✉️' },
  'admin.files': { label: 'File Management', description: 'Upload and manage download files', icon: '📁' },
  'admin.backup': { label: 'Backup & Restore', description: 'Create database backups and restore from files', icon: '💾' },
  'admin.dressingroom': { label: 'Dressing Room', description: 'Edit character items, stats, professions, reputations, quests, achievements, titles', icon: '👗' },
  'admin.export': { label: 'Data Export', description: 'Export admin data as CSV/JSON', icon: '📤' },
  'admin.portal-config': { label: 'Portal Config', description: 'Manage portal settings, perks, shop categories via self-managed database', icon: '⚙️' },
} as const

export type AdminFeatureId = keyof typeof ADMIN_FEATURES

// ─── Database Connection ────────────────────────────────────────────────────────

export function getUserSettingsDatabase() {
  if (!db) {
    const dataDir = dirname(DB_PATH)
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    initUserSettingsSchema()
    startPeriodicCheckpoint()
    registerShutdownHandlers()
  }
  return db
}

// ─── Schema ─────────────────────────────────────────────────────────────────────

function initUserSettingsSchema() {
  if (!db) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS feature_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      feature_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      granted_by TEXT NOT NULL,
      reason TEXT,
      own_account_only INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, feature_id, start_time)
    );

    CREATE INDEX IF NOT EXISTS idx_feature_grants_user
      ON feature_grants(user_id);

    CREATE INDEX IF NOT EXISTS idx_feature_grants_feature
      ON feature_grants(feature_id);

    CREATE INDEX IF NOT EXISTS idx_feature_grants_active
      ON feature_grants(user_id, feature_id, start_time, end_time);
  `)

  // Migration: add own_account_only column if missing (existing DBs)
  try {
    const columns = db.prepare("PRAGMA table_info('feature_grants')").all() as Array<{ name: string }>
    if (!columns.some(c => c.name === 'own_account_only')) {
      db.exec('ALTER TABLE feature_grants ADD COLUMN own_account_only INTEGER NOT NULL DEFAULT 0')
      console.log('[UserSettings] Migrated: added own_account_only column')
    }
  } catch {
    // Column already exists or table doesn't exist yet
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface DBFeatureGrant {
  id: number
  user_id: string
  username: string
  feature_id: string
  start_time: string
  end_time: string
  granted_by: string
  reason: string | null
  own_account_only: number  // 0 = all characters, 1 = own account only
  created_at: string
}

// ─── Feature Grant CRUD ─────────────────────────────────────────────────────────

export const FeatureGrantDB = {
  /**
   * Check if a user has an active grant for a feature right now
   */
  hasActiveGrant(userId: string, featureId: string): boolean {
    const db = getUserSettingsDatabase()
    const stmt = db.prepare(`
      SELECT 1 FROM feature_grants
      WHERE user_id = ?
        AND feature_id = ?
        AND datetime(start_time) <= datetime('now')
        AND datetime(end_time) > datetime('now')
      LIMIT 1
    `)
    return stmt.get(userId, featureId) !== undefined
  },

  /**
   * Get the active grant details for a user+feature (including own_account_only)
   * Returns undefined if no active grant
   */
  getActiveGrant(userId: string, featureId: string): DBFeatureGrant | undefined {
    const db = getUserSettingsDatabase()
    const stmt = db.prepare(`
      SELECT * FROM feature_grants
      WHERE user_id = ?
        AND feature_id = ?
        AND datetime(start_time) <= datetime('now')
        AND datetime(end_time) > datetime('now')
      ORDER BY end_time DESC
      LIMIT 1
    `)
    return stmt.get(userId, featureId) as DBFeatureGrant | undefined
  },

  /**
   * Check if a user has active grants for ANY feature right now
   * Returns the set of active feature IDs
   */
  getActiveFeatures(userId: string): Set<string> {
    const db = getUserSettingsDatabase()
    const stmt = db.prepare(`
      SELECT DISTINCT feature_id FROM feature_grants
      WHERE user_id = ?
        AND datetime(start_time) <= datetime('now')
        AND datetime(end_time) > datetime('now')
    `)
    const rows = stmt.all(userId) as Array<{ feature_id: string }>
    return new Set(rows.map(r => r.feature_id))
  },

  /**
   * Get all grants for a user (including expired)
   */
  findByUserId(userId: string): DBFeatureGrant[] {
    const db = getUserSettingsDatabase()
    const stmt = db.prepare(
      'SELECT * FROM feature_grants WHERE user_id = ? ORDER BY end_time DESC'
    )
    return stmt.all(userId) as DBFeatureGrant[]
  },

  /**
   * Get all grants (for admin listing)
   */
  findAll(): DBFeatureGrant[] {
    const db = getUserSettingsDatabase()
    const stmt = db.prepare('SELECT * FROM feature_grants ORDER BY end_time DESC, created_at DESC')
    return stmt.all() as DBFeatureGrant[]
  },

  /**
   * Create a new feature grant
   */
  create(grant: {
    userId: string
    username: string
    featureId: string
    startTime: string
    endTime: string
    grantedBy: string
    reason?: string
    ownAccountOnly?: boolean
  }): DBFeatureGrant {
    const db = getUserSettingsDatabase()
    const stmt = db.prepare(`
      INSERT INTO feature_grants
        (user_id, username, feature_id, start_time, end_time, granted_by, reason, own_account_only)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      grant.userId,
      grant.username,
      grant.featureId,
      grant.startTime,
      grant.endTime,
      grant.grantedBy,
      grant.reason || null,
      grant.ownAccountOnly ? 1 : 0,
    )

    return db.prepare('SELECT * FROM feature_grants WHERE id = ?').get(result.lastInsertRowid) as DBFeatureGrant
  },

  /**
   * Delete a grant by ID
   */
  deleteById(id: number): boolean {
    const db = getUserSettingsDatabase()
    const stmt = db.prepare('DELETE FROM feature_grants WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  },

  /**
   * Find a grant by ID
   */
  findById(id: number): DBFeatureGrant | undefined {
    const db = getUserSettingsDatabase()
    const stmt = db.prepare('SELECT * FROM feature_grants WHERE id = ?')
    return stmt.get(id) as DBFeatureGrant | undefined
  },

  /**
   * Delete all expired grants (cleanup)
   */
  deleteExpired(): number {
    const db = getUserSettingsDatabase()
    const stmt = db.prepare("DELETE FROM feature_grants WHERE datetime(end_time) < datetime('now')")
    const result = stmt.run()
    return result.changes
  },
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────────

function startPeriodicCheckpoint() {
  if (checkpointTimer) return

  checkpointTimer = setInterval(() => {
    if (!db) return
    try {
      const result = db.pragma('wal_checkpoint(PASSIVE)') as Array<{ busy: number; log: number; checkpointed: number }>
      const first = result[0]
      if (first && first.log > 0) {
        console.log(`[UserSettings] Checkpoint: ${first.checkpointed}/${first.log} pages`)
      }
    } catch (error) {
      console.error('[UserSettings] Checkpoint failed:', error)
    }
  }, CHECKPOINT_INTERVAL_MS)

  checkpointTimer.unref()
}

function registerShutdownHandlers() {
  if (shutdownHandlersRegistered) return
  shutdownHandlersRegistered = true

  const shutdown = () => {
    closeUserSettingsDatabase()
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  process.on('beforeExit', shutdown)
}

export function closeUserSettingsDatabase() {
  if (checkpointTimer) {
    clearInterval(checkpointTimer)
    checkpointTimer = null
  }

  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
      console.log('[UserSettings] Final checkpoint completed')
    } catch (error) {
      console.error('[UserSettings] Final checkpoint failed:', error)
    }

    db.close()
    db = null
    console.log('[UserSettings] Database connection closed')
  }
}
