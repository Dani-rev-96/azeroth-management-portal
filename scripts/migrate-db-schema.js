#!/usr/bin/env node
/**
 * Database Migration Script
 * Migrates account_mappings table from keycloak-specific naming to generic naming
 *
 * Old schema:
 *   - keycloak_id TEXT NOT NULL
 *   - keycloak_username TEXT NOT NULL
 *
 * New schema:
 *   - external_id TEXT NOT NULL
 *   - display_name TEXT NOT NULL
 *   - email TEXT (nullable, new column)
 *
 * Usage:
 *   node scripts/migrate-db-schema.js [path-to-database]
 *
 * If no path is provided, uses the default path: data/mappings.db
 */

import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { existsSync, copyFileSync } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Get database path from args or use default
const dbPath = process.argv[2] || process.env.DB_PATH || join(process.cwd(), 'data', 'mappings.db')

console.log('═══════════════════════════════════════════════════════════════')
console.log('  Account Mappings Database Migration')
console.log('  Migrating from Keycloak-specific to generic auth schema')
console.log('═══════════════════════════════════════════════════════════════')
console.log()

// Check if database exists
if (!existsSync(dbPath)) {
  console.log(`⚠️  Database not found at: ${dbPath}`)
  console.log('   No migration needed - the new schema will be created automatically.')
  process.exit(0)
}

console.log(`📁 Database path: ${dbPath}`)

// Create backup
const backupDir = dirname(dbPath)
const backupPath = join(backupDir, `mappings.db.backup-${Date.now()}`)
console.log(`📦 Creating backup at: ${backupPath}`)
copyFileSync(dbPath, backupPath)
console.log('   ✅ Backup created successfully')
console.log()

// Open database
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

try {
  // Check if migration is needed by looking at column names
  const tableInfo = db.prepare("PRAGMA table_info(account_mappings)").all()
  const columns = tableInfo.map(col => col.name)

  console.log('📋 Current columns:', columns.join(', '))
  console.log()

  // Check if already migrated
  if (columns.includes('external_id')) {
    console.log('✅ Database already using new schema - no migration needed.')
    db.close()
    process.exit(0)
  }

  // Check if old schema exists
  if (!columns.includes('keycloak_id')) {
    console.log('❌ Error: Could not find keycloak_id column.')
    console.log('   This database may have an unexpected schema.')
    db.close()
    process.exit(1)
  }

  console.log('🔄 Starting migration...')
  console.log()

  // Start transaction
  db.exec('BEGIN TRANSACTION')

  try {
    // Step 1: Create new table with updated schema
    console.log('   1️⃣  Creating new table with updated schema...')
    db.exec(`
      CREATE TABLE account_mappings_new (
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
      )
    `)

    // Step 2: Copy data from old table to new table
    console.log('   2️⃣  Copying data to new schema...')
    const copyResult = db.exec(`
      INSERT INTO account_mappings_new
        (id, external_id, display_name, email, wow_account_id, wow_account_username, created_at, last_used, metadata)
      SELECT
        id,
        keycloak_id,
        keycloak_username,
        NULL,
        wow_account_id,
        wow_account_username,
        created_at,
        last_used,
        metadata
      FROM account_mappings
    `)

    // Count migrated rows
    const countResult = db.prepare('SELECT COUNT(*) as count FROM account_mappings_new').get()
    console.log(`      Migrated ${countResult.count} records`)

    // Step 3: Drop old table
    console.log('   3️⃣  Dropping old table...')
    db.exec('DROP TABLE account_mappings')

    // Step 4: Rename new table
    console.log('   4️⃣  Renaming new table...')
    db.exec('ALTER TABLE account_mappings_new RENAME TO account_mappings')

    // Step 5: Recreate indexes with new column names
    console.log('   5️⃣  Recreating indexes...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_external_id
        ON account_mappings(external_id);

      CREATE INDEX IF NOT EXISTS idx_wow_account_id
        ON account_mappings(wow_account_id);
    `)

    // Commit transaction
    db.exec('COMMIT')

    console.log()
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('  ✅ Migration completed successfully!')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log()
    console.log('New schema:')
    const newTableInfo = db.prepare("PRAGMA table_info(account_mappings)").all()
    newTableInfo.forEach(col => {
      console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`)
    })
    console.log()
    console.log(`Backup saved at: ${backupPath}`)
    console.log('You can safely delete the backup once you verify the migration.')

  } catch (migrationError) {
    // Rollback on error
    console.error('❌ Migration failed:', migrationError.message)
    db.exec('ROLLBACK')
    console.log('   Transaction rolled back. Database unchanged.')
    console.log(`   Backup available at: ${backupPath}`)
    throw migrationError
  }

} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
} finally {
  db.close()
}
