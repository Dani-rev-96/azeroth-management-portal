import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { RealmId } from '~/types'

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data', 'mappings.db')

let db: Database.Database | null = null

/**
 * Get or initialize the SQLite database connection
 * Creates the database file and schema if they don't exist
 */
export function getDatabase() {
  if (!db) {
    // Ensure data directory exists
    const dataDir = join(process.cwd(), 'data')
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL') // Write-Ahead Logging for better concurrency
    db.pragma('foreign_keys = ON')
    
    initSchema()
  }
  return db
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
      keycloak_id TEXT NOT NULL,
      keycloak_username TEXT NOT NULL,
      wow_account_id INTEGER NOT NULL,
      wow_account_username TEXT NOT NULL,
      realm_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME,
      metadata TEXT,
      UNIQUE(keycloak_id, wow_account_id, realm_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_keycloak_id 
      ON account_mappings(keycloak_id);
    
    CREATE INDEX IF NOT EXISTS idx_wow_account_id 
      ON account_mappings(wow_account_id);
    
    CREATE INDEX IF NOT EXISTS idx_realm_id 
      ON account_mappings(realm_id);
  `)
}

/**
 * Account mapping data structure
 */
export interface DBAccountMapping {
  id: number
  keycloak_id: string
  keycloak_username: string
  wow_account_id: number
  wow_account_username: string
  realm_id: RealmId
  created_at: string
  last_used: string | null
  metadata: string | null
}

/**
 * Database operations for account mappings
 */
export const AccountMappingDB = {
  /**
   * Find all mappings for a Keycloak user
   */
  findByKeycloakId(keycloakId: string): DBAccountMapping[] {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM account_mappings WHERE keycloak_id = ?')
    return stmt.all(keycloakId) as DBAccountMapping[]
  },

  /**
   * Find a specific mapping
   */
  findByIds(keycloakId: string, wowAccountId: number, realmId: RealmId): DBAccountMapping | undefined {
    const db = getDatabase()
    const stmt = db.prepare(
      'SELECT * FROM account_mappings WHERE keycloak_id = ? AND wow_account_id = ? AND realm_id = ?'
    )
    return stmt.get(keycloakId, wowAccountId, realmId) as DBAccountMapping | undefined
  },

  /**
   * Create a new account mapping
   */
  create(mapping: {
    keycloakId: string
    keycloakUsername: string
    wowAccountId: number
    wowAccountUsername: string
    realmId: RealmId
    metadata?: Record<string, any>
  }): DBAccountMapping {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO account_mappings 
        (keycloak_id, keycloak_username, wow_account_id, wow_account_username, realm_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      mapping.keycloakId,
      mapping.keycloakUsername,
      mapping.wowAccountId,
      mapping.wowAccountUsername,
      mapping.realmId,
      mapping.metadata ? JSON.stringify(mapping.metadata) : null
    )

    // Return the created mapping
    const created = db.prepare('SELECT * FROM account_mappings WHERE id = ?').get(result.lastInsertRowid)
    return created as DBAccountMapping
  },

  /**
   * Update last_used timestamp
   */
  updateLastUsed(keycloakId: string, wowAccountId: number): void {
    const db = getDatabase()
    const stmt = db.prepare(
      'UPDATE account_mappings SET last_used = CURRENT_TIMESTAMP WHERE keycloak_id = ? AND wow_account_id = ?'
    )
    stmt.run(keycloakId, wowAccountId)
  },

  /**
   * Delete a mapping
   */
  delete(keycloakId: string, wowAccountId: number): boolean {
    const db = getDatabase()
    const stmt = db.prepare(
      'DELETE FROM account_mappings WHERE keycloak_id = ? AND wow_account_id = ?'
    )
    const result = stmt.run(keycloakId, wowAccountId)
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
  exists(keycloakId: string, wowAccountId: number, realmId: RealmId): boolean {
    const db = getDatabase()
    const stmt = db.prepare(
      'SELECT 1 FROM account_mappings WHERE keycloak_id = ? AND wow_account_id = ? AND realm_id = ? LIMIT 1'
    )
    return stmt.get(keycloakId, wowAccountId, realmId) !== undefined
  },
}

/**
 * Close database connection (useful for cleanup in tests)
 */
export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
