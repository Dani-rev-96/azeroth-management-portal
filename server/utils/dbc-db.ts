import Database from 'better-sqlite3'
import { writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Database connection pool
 */
const dbConnections: Record<string, Database.Database> = {}
const initPromises: Record<string, Promise<Database.Database>> = {}

/**
 * Get or initialize a database connection
 */
async function getDatabase(dbName: string): Promise<Database.Database> {
  if (dbConnections[dbName]) {
    return dbConnections[dbName]
  }

  if (initPromises[dbName]) {
    return initPromises[dbName]
  }

  initPromises[dbName] = (async () => {
    let dbPath: string

    // Check for environment variable override first
    const envVarName = `${dbName.toUpperCase().replace(/\./g, '_')}_PATH`
    if (process.env[envVarName]) {
      dbPath = process.env[envVarName]!
      console.log(`[dbc-db] Using ${dbName} from ${envVarName}: ${dbPath}`)
    } else {
      // Get the database from Nitro server assets
      const { useStorage } = await import('#imports')
      const storage = useStorage('assets:server')
      const dbBuffer = await storage.getItemRaw(dbName)

      if (!dbBuffer) {
        throw new Error(`${dbName} not found in server assets`)
      }

      // Write to temp file since better-sqlite3 needs a file path
      const tempDir = join(tmpdir(), 'wow-frontend')
      mkdirSync(tempDir, { recursive: true })
      dbPath = join(tempDir, dbName)

      writeFileSync(dbPath, dbBuffer)
      console.log(`[dbc-db] Extracted ${dbName} to: ${dbPath}`)
    }

    const db = new Database(dbPath, { readonly: true })
    db.pragma('journal_mode = WAL')
    dbConnections[dbName] = db
    return db
  })()

  return initPromises[dbName]
}

// ==================== Item Display Info ====================

export interface ItemDisplayInfo {
  id: number
  inventory_icon_1: string | null
  inventory_icon_2: string | null
  model_name_1: string | null
  model_name_2: string | null
  model_texture_1: string | null
  model_texture_2: string | null
}

export async function getItemDisplayInfo(displayId: number): Promise<ItemDisplayInfo | undefined> {
  const db = await getDatabase('item_display_info.db')
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

export async function getItemDisplayInfoBatch(displayIds: number[]): Promise<ItemDisplayInfo[]> {
  if (displayIds.length === 0) return []

  const db = await getDatabase('item_display_info.db')
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

// ==================== Spell Item Enchantment ====================

export interface SpellItemEnchantment {
  id: number
  charges: number
  effect_1: number
  effect_2: number
  effect_3: number
  effect_points_min_1: number
  effect_points_min_2: number
  effect_points_min_3: number
  effect_points_max_1: number
  effect_points_max_2: number
  effect_points_max_3: number
  effect_arg_1: number
  effect_arg_2: number
  effect_arg_3: number
  name: string
  item_visual: number
  flags: number
  src_item_id: number
  condition_id: number
  required_skill_id: number
  required_skill_rank: number
}

export async function getSpellItemEnchantment(enchantId: number): Promise<SpellItemEnchantment | undefined> {
  const db = await getDatabase('spell_item_enchantment.db')
  const stmt = db.prepare('SELECT * FROM spell_item_enchantment WHERE id = ?')
  return stmt.get(enchantId) as SpellItemEnchantment | undefined
}

export async function getSpellItemEnchantmentBatch(enchantIds: number[]): Promise<SpellItemEnchantment[]> {
  if (enchantIds.length === 0) return []

  const db = await getDatabase('spell_item_enchantment.db')
  const placeholders = enchantIds.map(() => '?').join(',')
  const stmt = db.prepare(`SELECT * FROM spell_item_enchantment WHERE id IN (${placeholders})`)
  return stmt.all(...enchantIds) as SpellItemEnchantment[]
}

// ==================== Spell ====================

export interface Spell {
  id: number
  name: string
  rank: string
  description: string
  tooltip: string
  school_mask: number
  spell_icon_id: number
  // Effect type and aura type for each of 3 effects
  duration_index: number
  effect_1: number
  effect_2: number
  effect_3: number
  effect_aura_1: number
  effect_aura_2: number
  effect_aura_3: number
  effect_base_points_1: number
  effect_base_points_2: number
  effect_base_points_3: number
  effect_die_sides_1: number
  effect_die_sides_2: number
  effect_die_sides_3: number
  effect_misc_value_1: number
  effect_misc_value_2: number
  effect_misc_value_3: number
  effect_aura_period_1: number
  effect_aura_period_2: number
  effect_aura_period_3: number
  effect_amplitude_1: number
  effect_amplitude_2: number
  effect_amplitude_3: number
  effect_chain_targets_1: number
  effect_chain_targets_2: number
  effect_chain_targets_3: number
  effect_points_per_combo_1: number
  effect_points_per_combo_2: number
  effect_points_per_combo_3: number
  effect_radius_index_1: number
  effect_radius_index_2: number
  effect_radius_index_3: number
  proc_chance: number
  proc_charges: number
}

export async function getSpell(spellId: number): Promise<Spell | undefined> {
  const db = await getDatabase('spell.db')
  const stmt = db.prepare('SELECT * FROM spell WHERE id = ?')
  return stmt.get(spellId) as Spell | undefined
}

export async function getSpellBatch(spellIds: number[]): Promise<Spell[]> {
  if (spellIds.length === 0) return []

  const db = await getDatabase('spell.db')
  const placeholders = spellIds.map(() => '?').join(',')
  const stmt = db.prepare(`SELECT * FROM spell WHERE id IN (${placeholders})`)
  return stmt.all(...spellIds) as Spell[]
}

// ==================== Talent ====================

export interface Talent {
  id: number
  tab_id: number
  tier_id: number
  column_index: number
  rank_id_1: number
  rank_id_2: number
  rank_id_3: number
  rank_id_4: number
  rank_id_5: number
  prereq_talent: number
  prereq_rank: number
  flags: number
  required_spell_id: number
  category_mask_1: number
  category_mask_2: number
}

export async function getTalentsByTab(tabId: number): Promise<Talent[]> {
  const db = await getDatabase('talent.db')
  const stmt = db.prepare('SELECT * FROM talent WHERE tab_id = ? ORDER BY tier_id, column_index')
  return stmt.all(tabId) as Talent[]
}

export async function getTalentBySpellId(spellId: number): Promise<Talent | undefined> {
  const db = await getDatabase('talent.db')
  const stmt = db.prepare(`
    SELECT * FROM talent
    WHERE rank_id_1 = ? OR rank_id_2 = ? OR rank_id_3 = ? OR rank_id_4 = ? OR rank_id_5 = ?
  `)
  return stmt.get(spellId, spellId, spellId, spellId, spellId) as Talent | undefined
}

export async function getAllTalents(): Promise<Talent[]> {
  const db = await getDatabase('talent.db')
  const stmt = db.prepare('SELECT * FROM talent ORDER BY tab_id, tier_id, column_index')
  return stmt.all() as Talent[]
}

// ==================== Talent Tab ====================

export interface TalentTab {
  id: number
  name: string
  spell_icon_id: number
  race_mask: number
  class_mask: number
  pet_talent_mask: number
  order_index: number
  background_file: string
}

export async function getTalentTabsByClass(classMask: number): Promise<TalentTab[]> {
  const db = await getDatabase('talent_tab.db')
  const stmt = db.prepare(`
    SELECT * FROM talent_tab
    WHERE (class_mask & ?) != 0
    ORDER BY order_index
  `)
  return stmt.all(classMask) as TalentTab[]
}

export async function getTalentTab(tabId: number): Promise<TalentTab | undefined> {
  const db = await getDatabase('talent_tab.db')
  const stmt = db.prepare('SELECT * FROM talent_tab WHERE id = ?')
  return stmt.get(tabId) as TalentTab | undefined
}

// ==================== Item Random Suffix ====================

export interface ItemRandomSuffix {
  id: number
  name: string
  name_deDE?: string
  internal_name: string
  enchantment_1: number
  enchantment_2: number
  enchantment_3: number
  enchantment_4: number
  enchantment_5: number
  allocation_pct_1: number
  allocation_pct_2: number
  allocation_pct_3: number
  allocation_pct_4: number
  allocation_pct_5: number
}

export async function getItemRandomSuffix(suffixId: number): Promise<ItemRandomSuffix | undefined> {
  const db = await getDatabase('item_random_suffix.db')
  const stmt = db.prepare('SELECT * FROM item_random_suffix WHERE id = ?')
  return stmt.get(suffixId) as ItemRandomSuffix | undefined
}

// ==================== Item Random Properties ====================

export interface ItemRandomProperties {
  id: number
  name: string
  name_deDE?: string
  enchantment_1: number
  enchantment_2: number
  enchantment_3: number
  enchantment_4: number
  enchantment_5: number
}

export async function getItemRandomProperties(propId: number): Promise<ItemRandomProperties | undefined> {
  const db = await getDatabase('item_random_properties.db')
  const stmt = db.prepare('SELECT * FROM item_random_properties WHERE id = ?')
  return stmt.get(propId) as ItemRandomProperties | undefined
}

// ==================== Spell Icon ====================

export interface SpellIcon {
  id: number
  texture_filename: string
}

export async function getSpellIcon(iconId: number): Promise<SpellIcon | undefined> {
  const db = await getDatabase('spell_icon.db')
  const stmt = db.prepare('SELECT * FROM spell_icon WHERE id = ?')
  return stmt.get(iconId) as SpellIcon | undefined
}

export async function getSpellIconBatch(iconIds: number[]): Promise<SpellIcon[]> {
  if (iconIds.length === 0) return []

  const db = await getDatabase('spell_icon.db')
  const placeholders = iconIds.map(() => '?').join(',')
  const stmt = db.prepare(`SELECT * FROM spell_icon WHERE id IN (${placeholders})`)
  return stmt.all(...iconIds) as SpellIcon[]
}

// ==================== Spell Duration ====================

export interface SpellDuration {
  id: number
  duration: number // Duration in milliseconds
  duration_per_level: number
  max_duration: number
}

export async function getSpellDuration(durationId: number): Promise<SpellDuration | undefined> {
  const db = await getDatabase('spell_duration.db')
  const stmt = db.prepare('SELECT * FROM spell_duration WHERE id = ?')
  return stmt.get(durationId) as SpellDuration | undefined
}

export async function getSpellDurationBatch(durationIds: number[]): Promise<SpellDuration[]> {
  if (durationIds.length === 0) return []

  const db = await getDatabase('spell_duration.db')
  const uniqueIds = [...new Set(durationIds.filter(id => id > 0))]
  if (uniqueIds.length === 0) return []

  const placeholders = uniqueIds.map(() => '?').join(',')
  const stmt = db.prepare(`SELECT * FROM spell_duration WHERE id IN (${placeholders})`)
  return stmt.all(...uniqueIds) as SpellDuration[]
}
