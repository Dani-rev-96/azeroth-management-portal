#!/usr/bin/env node

/**
 * Import ItemDisplayInfo.json into SQLite database for efficient querying
 * This script reads the large JSON file and creates a searchable SQLite database
 */

import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

const ITEM_DB_PATH = join(process.cwd(), 'data', 'items.db')
const JSON_PATH = join(process.cwd(), 'data', 'ItemDisplayInfo.json')

console.log('📦 Starting ItemDisplayInfo import...')
console.log('Reading JSON file:', JSON_PATH)

// Read the JSON file
const jsonData = readFileSync(JSON_PATH, 'utf-8')
const items = JSON.parse(jsonData)

console.log(`✅ Loaded ${items.length} items from JSON`)

// Create/open database
const db = new Database(ITEM_DB_PATH)
db.pragma('journal_mode = WAL')

console.log('Creating database schema...')

// Create table
db.exec(`
  DROP TABLE IF EXISTS item_display_info;

  CREATE TABLE item_display_info (
    id INTEGER PRIMARY KEY,
    model_name_1 TEXT,
    model_name_2 TEXT,
    model_texture_1 TEXT,
    model_texture_2 TEXT,
    inventory_icon_1 TEXT,
    inventory_icon_2 TEXT,
    geoset_group_1 INTEGER,
    geoset_group_2 INTEGER,
    geoset_group_3 INTEGER,
    flags INTEGER,
    spell_visual_id INTEGER,
    group_sound_index INTEGER,
    helmet_geoset_vis_1 INTEGER,
    helmet_geoset_vis_2 INTEGER,
    texture_1 TEXT,
    texture_2 TEXT,
    texture_3 TEXT,
    texture_4 TEXT,
    texture_5 TEXT,
    texture_6 TEXT,
    texture_7 TEXT,
    texture_8 TEXT,
    item_visual INTEGER,
    particle_color_id INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_icon_1 ON item_display_info(inventory_icon_1);
  CREATE INDEX IF NOT EXISTS idx_inventory_icon_2 ON item_display_info(inventory_icon_2);
`)

console.log('✅ Schema created')

// Prepare insert statement
const insert = db.prepare(`
  INSERT INTO item_display_info (
    id, model_name_1, model_name_2, model_texture_1, model_texture_2,
    inventory_icon_1, inventory_icon_2,
    geoset_group_1, geoset_group_2, geoset_group_3,
    flags, spell_visual_id, group_sound_index,
    helmet_geoset_vis_1, helmet_geoset_vis_2,
    texture_1, texture_2, texture_3, texture_4, texture_5,
    texture_6, texture_7, texture_8,
    item_visual, particle_color_id
  ) VALUES (
    @ID, @ModelName_1, @ModelName_2, @ModelTexture_1, @ModelTexture_2,
    @InventoryIcon_1, @InventoryIcon_2,
    @GeosetGroup_1, @GeosetGroup_2, @GeosetGroup_3,
    @Flags, @SpellVisualID, @GroupSoundIndex,
    @HelmetGeosetVis_1, @HelmetGeosetVis_2,
    @Texture_1, @Texture_2, @Texture_3, @Texture_4, @Texture_5,
    @Texture_6, @Texture_7, @Texture_8,
    @ItemVisual, @ParticleColorID
  )
`)

console.log('Importing items in batches...')

// Insert in transaction for speed
const insertMany = db.transaction((items) => {
  for (const item of items) {
    insert.run(item)
  }
})

const batchSize = 10000
let imported = 0

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize)
  insertMany(batch)
  imported += batch.length
  console.log(`  Progress: ${imported}/${items.length} (${Math.round(imported / items.length * 100)}%)`)
}

console.log('✅ Import complete!')

// Verify
const count = db.prepare('SELECT COUNT(*) as count FROM item_display_info').get()
console.log(`📊 Total records in database: ${count.count}`)

// Show some examples with icons
const examples = db.prepare(`
  SELECT id, inventory_icon_1, inventory_icon_2
  FROM item_display_info
  WHERE inventory_icon_1 != '' OR inventory_icon_2 != ''
  LIMIT 5
`).all()

console.log('\n📸 Sample items with icons:')
examples.forEach(item => {
  console.log(`  ID ${item.id}: ${item.inventory_icon_1 || item.inventory_icon_2}`)
})

db.close()
console.log('\n✨ Done!')
