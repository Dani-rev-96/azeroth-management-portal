import Database from 'better-sqlite3'
import { join } from 'path'

const ITEMS_DB_PATH = process.env.ITEMS_DB_PATH || join(process.cwd(), 'data', 'items.db')

let itemsDb: Database.Database | null = null

/**
 * Get or initialize the items SQLite database connection
 */
export function getItemsDatabase() {
  if (!itemsDb) {
    itemsDb = new Database(ITEMS_DB_PATH, { readonly: true })
    itemsDb.pragma('journal_mode = WAL')
  }
  return itemsDb
}

/**
 * Get item display info by ID
 */
export function getItemDisplayInfo(displayId: number) {
  const db = getItemsDatabase()
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
export function getItemDisplayInfoBatch(displayIds: number[]) {
  if (displayIds.length === 0) return []

  const db = getItemsDatabase()
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

export type ItemDisplayInfo = {
  id: number
  inventory_icon_1: string | null
  inventory_icon_2: string | null
  model_name_1: string | null
  model_name_2: string | null
  model_texture_1: string | null
  model_texture_2: string | null
}
