import Database from 'better-sqlite3'
import { writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let itemsDb: Database.Database | null = null
let initPromise: Promise<Database.Database> | null = null

/**
 * Get or initialize the items SQLite database connection
 */
async function getItemsDatabase(): Promise<Database.Database> {
  if (itemsDb) {
    return itemsDb
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    let dbPath: string

    // Check for environment variable override first
    if (process.env.ITEMS_DB_PATH) {
      dbPath = process.env.ITEMS_DB_PATH
      console.log(`[items-db] Using database from ITEMS_DB_PATH: ${dbPath}`)
    } else {
      // Get the database from Nitro server assets
      const { useStorage } = await import('#imports')
      const storage = useStorage('assets:server')
      const dbBuffer = await storage.getItemRaw('items.db')

      if (!dbBuffer) {
        throw new Error('items.db not found in server assets')
      }

      // Write to temp file since better-sqlite3 needs a file path
      const tempDir = join(tmpdir(), 'wow-frontend')
      mkdirSync(tempDir, { recursive: true })
      dbPath = join(tempDir, 'items.db')

      writeFileSync(dbPath, dbBuffer)
      console.log(`[items-db] Extracted database to: ${dbPath}`)
    }

    itemsDb = new Database(dbPath, { readonly: true })
    itemsDb.pragma('journal_mode = WAL')
    return itemsDb
  })()

  return initPromise
}

/**
 * Item display info type
 */
export interface ItemDisplayInfo {
  id: number
  inventory_icon_1: string | null
  inventory_icon_2: string | null
  model_name_1: string | null
  model_name_2: string | null
  model_texture_1: string | null
  model_texture_2: string | null
}

/**
 * Get item display info by ID
 */
export async function getItemDisplayInfo(displayId: number): Promise<ItemDisplayInfo | undefined> {
  const db = await getItemsDatabase()
  const stmt = db.prepare(`
    SELECT
      id,
      inventory_icon_1,
      inventory_icon_2,
      model_name_1,
      model_name_2,
      model_texture_1,
      model_texture_2
    FROM item_display_info
    WHERE id = ?
  `)
  return stmt.get(displayId) as ItemDisplayInfo | undefined
}

/**
 * Get multiple item display infos by IDs
 */
export async function getItemDisplayInfoBatch(displayIds: number[]): Promise<ItemDisplayInfo[]> {
  if (displayIds.length === 0) return []

  const db = await getItemsDatabase()
  const placeholders = displayIds.map(() => '?').join(',')
  const stmt = db.prepare(`
    SELECT
      id,
      inventory_icon_1,
      inventory_icon_2,
      model_name_1,
      model_name_2,
      model_texture_1,
      model_texture_2
    FROM item_display_info
    WHERE id IN (${placeholders})
  `)
  return stmt.all(...displayIds) as ItemDisplayInfo[]
}
