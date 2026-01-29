#!/usr/bin/env node

/**
 * Import DBC JSON files into SQLite databases for efficient querying
 * This script handles multiple DBC files with different schemas
 */

import Database from 'better-sqlite3'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DBC_JSON_DIR = join(process.cwd(), 'data', 'dbcJsons')
const DB_OUTPUT_DIR = join(process.cwd(), 'server', 'assets')

/**
 * Configuration for each DBC file
 */
const dbcConfigs = {
  Item: {
    jsonFile: 'Item.json',
    dbFile: 'item.db',
    tableName: 'item',
    schema: `
      CREATE TABLE item (
        id INTEGER PRIMARY KEY,
        class_id INTEGER,
        subclass_id INTEGER,
        sound_override_subclass_id INTEGER,
        material INTEGER,
        display_info_id INTEGER,
        inventory_type INTEGER,
        sheath_type INTEGER
      );
      CREATE INDEX idx_display_info ON item(display_info_id);
    `,
    mapping: (row) => ({
      id: row.ID,
      class_id: row.ClassID,
      subclass_id: row.SubclassID,
      sound_override_subclass_id: row.SoundOverrideSubclassID,
      material: row.Material,
      display_info_id: row.DisplayInfoID,
      inventory_type: row.InventoryType,
      sheath_type: row.SheathType
    })
  },

  ItemDisplayInfo: {
    jsonFile: 'ItemDisplayInfo.json',
    dbFile: 'item_display_info.db',
    tableName: 'item_display_info',
    schema: `
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
      CREATE INDEX idx_inventory_icon_1 ON item_display_info(inventory_icon_1);
      CREATE INDEX idx_inventory_icon_2 ON item_display_info(inventory_icon_2);
    `,
    mapping: (row) => ({
      id: row.ID,
      model_name_1: row.ModelName_1,
      model_name_2: row.ModelName_2,
      model_texture_1: row.ModelTexture_1,
      model_texture_2: row.ModelTexture_2,
      inventory_icon_1: row.InventoryIcon_1,
      inventory_icon_2: row.InventoryIcon_2,
      geoset_group_1: row.GeosetGroup_1,
      geoset_group_2: row.GeosetGroup_2,
      geoset_group_3: row.GeosetGroup_3,
      flags: row.Flags,
      spell_visual_id: row.SpellVisualID,
      group_sound_index: row.GroupSoundIndex,
      helmet_geoset_vis_1: row.HelmetGeosetVis_1,
      helmet_geoset_vis_2: row.HelmetGeosetVis_2,
      texture_1: row.Texture_1,
      texture_2: row.Texture_2,
      texture_3: row.Texture_3,
      texture_4: row.Texture_4,
      texture_5: row.Texture_5,
      texture_6: row.Texture_6,
      texture_7: row.Texture_7,
      texture_8: row.Texture_8,
      item_visual: row.ItemVisual,
      particle_color_id: row.ParticleColorID
    })
  },

  SpellItemEnchantment: {
    jsonFile: 'SpellItemEnchantment.json',
    dbFile: 'spell_item_enchantment.db',
    tableName: 'spell_item_enchantment',
    schema: `
      CREATE TABLE spell_item_enchantment (
        id INTEGER PRIMARY KEY,
        charges INTEGER,
        effect_1 INTEGER,
        effect_2 INTEGER,
        effect_3 INTEGER,
        effect_points_min_1 INTEGER,
        effect_points_min_2 INTEGER,
        effect_points_min_3 INTEGER,
        effect_points_max_1 INTEGER,
        effect_points_max_2 INTEGER,
        effect_points_max_3 INTEGER,
        effect_arg_1 INTEGER,
        effect_arg_2 INTEGER,
        effect_arg_3 INTEGER,
        name TEXT,
        item_visual INTEGER,
        flags INTEGER,
        src_item_id INTEGER,
        condition_id INTEGER,
        required_skill_id INTEGER,
        required_skill_rank INTEGER
      );
    `,
    mapping: (row) => ({
      id: row.ID,
      charges: row.Charges,
      effect_1: row.Effect_1,
      effect_2: row.Effect_2,
      effect_3: row.Effect_3,
      effect_points_min_1: row.EffectPointsMin_1,
      effect_points_min_2: row.EffectPointsMin_2,
      effect_points_min_3: row.EffectPointsMin_3,
      effect_points_max_1: row.EffectPointsMax_1,
      effect_points_max_2: row.EffectPointsMax_2,
      effect_points_max_3: row.EffectPointsMax_3,
      effect_arg_1: row.EffectArg_1,
      effect_arg_2: row.EffectArg_2,
      effect_arg_3: row.EffectArg_3,
      name: row.Name_enUS || row.Name_Lang || '',
      item_visual: row.ItemVisual,
      flags: row.Flags,
      src_item_id: row.Src_ItemID,
      condition_id: row.Condition_ID,
      required_skill_id: row.RequiredSkillID,
      required_skill_rank: row.RequiredSkillRank
    })
  },

  Spell: {
    jsonFile: 'Spell.json',
    dbFile: 'spell.db',
    tableName: 'spell',
    schema: `
      CREATE TABLE spell (
        id INTEGER PRIMARY KEY,
        name TEXT,
        rank TEXT,
        description TEXT,
        tooltip TEXT,
        school_mask INTEGER,
        spell_icon_id INTEGER,
        duration_index INTEGER,
        effect_1 INTEGER,
        effect_2 INTEGER,
        effect_3 INTEGER,
        effect_aura_1 INTEGER,
        effect_aura_2 INTEGER,
        effect_aura_3 INTEGER,
        effect_base_points_1 INTEGER,
        effect_base_points_2 INTEGER,
        effect_base_points_3 INTEGER,
        effect_die_sides_1 INTEGER,
        effect_die_sides_2 INTEGER,
        effect_die_sides_3 INTEGER,
        effect_misc_value_1 INTEGER,
        effect_misc_value_2 INTEGER,
        effect_misc_value_3 INTEGER,
        effect_aura_period_1 INTEGER,
        effect_aura_period_2 INTEGER,
        effect_aura_period_3 INTEGER,
        effect_amplitude_1 REAL,
        effect_amplitude_2 REAL,
        effect_amplitude_3 REAL,
        effect_chain_targets_1 INTEGER,
        effect_chain_targets_2 INTEGER,
        effect_chain_targets_3 INTEGER,
        effect_points_per_combo_1 REAL,
        effect_points_per_combo_2 REAL,
        effect_points_per_combo_3 REAL,
        effect_radius_index_1 INTEGER,
        effect_radius_index_2 INTEGER,
        effect_radius_index_3 INTEGER,
        proc_chance INTEGER,
        proc_charges INTEGER
      );
      CREATE INDEX idx_name ON spell(name);
    `,
    mapping: (row) => ({
      id: row.ID,
      name: row.Name_Lang_enUS || row.Name_Lang_enGB || row.Name_Lang_deDE || row.Name_Lang_frFR || '',
      rank: row.NameSubtext_Lang_enUS || row.NameSubtext_Lang_enGB || row.NameSubtext_Lang_deDE || row.NameSubtext_Lang_frFR || '',
      description: row.Description_Lang_enUS || row.Description_Lang_enGB || row.Description_Lang_deDE || row.Description_Lang_frFR || '',
      tooltip: row.Tooltip_Lang_enUS || row.Tooltip_Lang_enGB || row.Tooltip_Lang_deDE || row.Tooltip_Lang_frFR || '',
      school_mask: row.SchoolMask,
      spell_icon_id: row.SpellIconID,
      duration_index: row.DurationIndex || 0,
      effect_1: row.Effect_1 || 0,
      effect_2: row.Effect_2 || 0,
      effect_3: row.Effect_3 || 0,
      effect_aura_1: row.EffectAura_1 || 0,
      effect_aura_2: row.EffectAura_2 || 0,
      effect_aura_3: row.EffectAura_3 || 0,
      effect_base_points_1: row.EffectBasePoints_1 || 0,
      effect_base_points_2: row.EffectBasePoints_2 || 0,
      effect_base_points_3: row.EffectBasePoints_3 || 0,
      effect_die_sides_1: row.EffectDieSides_1 || 0,
      effect_die_sides_2: row.EffectDieSides_2 || 0,
      effect_die_sides_3: row.EffectDieSides_3 || 0,
      effect_misc_value_1: row.EffectMiscValue_1 || 0,
      effect_misc_value_2: row.EffectMiscValue_2 || 0,
      effect_misc_value_3: row.EffectMiscValue_3 || 0,
      effect_aura_period_1: row.EffectAuraPeriod_1 || 0,
      effect_aura_period_2: row.EffectAuraPeriod_2 || 0,
      effect_aura_period_3: row.EffectAuraPeriod_3 || 0,
      effect_amplitude_1: row.EffectMultipleValue_1 || 0,
      effect_amplitude_2: row.EffectMultipleValue_2 || 0,
      effect_amplitude_3: row.EffectMultipleValue_3 || 0,
      effect_chain_targets_1: row.EffectChainTargets_1 || 0,
      effect_chain_targets_2: row.EffectChainTargets_2 || 0,
      effect_chain_targets_3: row.EffectChainTargets_3 || 0,
      effect_points_per_combo_1: row.EffectPointsPerCombo_1 || 0,
      effect_points_per_combo_2: row.EffectPointsPerCombo_2 || 0,
      effect_points_per_combo_3: row.EffectPointsPerCombo_3 || 0,
      effect_radius_index_1: row.EffectRadiusIndex_1 || 0,
      effect_radius_index_2: row.EffectRadiusIndex_2 || 0,
      effect_radius_index_3: row.EffectRadiusIndex_3 || 0,
      proc_chance: row.ProcChance || 0,
      proc_charges: row.ProcCharges || 0
    })
  },

  Talent: {
    jsonFile: 'Talent.json',
    dbFile: 'talent.db',
    tableName: 'talent',
    schema: `
      CREATE TABLE talent (
        id INTEGER PRIMARY KEY,
        tab_id INTEGER,
        tier_id INTEGER,
        column_index INTEGER,
        rank_id_1 INTEGER,
        rank_id_2 INTEGER,
        rank_id_3 INTEGER,
        rank_id_4 INTEGER,
        rank_id_5 INTEGER,
        prereq_talent INTEGER,
        prereq_rank INTEGER,
        flags INTEGER,
        required_spell_id INTEGER,
        category_mask_1 INTEGER,
        category_mask_2 INTEGER
      );
      CREATE INDEX idx_tab_id ON talent(tab_id);
      CREATE INDEX idx_rank_ids ON talent(rank_id_1, rank_id_2, rank_id_3, rank_id_4, rank_id_5);
    `,
    mapping: (row) => ({
      id: row.ID,
      tab_id: row.TabID,
      tier_id: row.TierID,
      column_index: row.ColumnIndex,
      rank_id_1: row.SpellRank_1 || 0,
      rank_id_2: row.SpellRank_2 || 0,
      rank_id_3: row.SpellRank_3 || 0,
      rank_id_4: row.SpellRank_4 || 0,
      rank_id_5: row.SpellRank_5 || 0,
      prereq_talent: row.PrereqTalent_1 || 0,
      prereq_rank: row.PrereqRank_1 || 0,
      flags: row.Flags,
      required_spell_id: row.RequiredSpellID,
      category_mask_1: row.CategoryMask_1,
      category_mask_2: row.CategoryMask_2
    })
  },

  TalentTab: {
    jsonFile: 'TalentTab.json',
    dbFile: 'talent_tab.db',
    tableName: 'talent_tab',
    schema: `
      CREATE TABLE talent_tab (
        id INTEGER PRIMARY KEY,
        name TEXT,
        spell_icon_id INTEGER,
        race_mask INTEGER,
        class_mask INTEGER,
        pet_talent_mask INTEGER,
        order_index INTEGER,
        background_file TEXT
      );
      CREATE INDEX idx_class_mask ON talent_tab(class_mask);
    `,
    mapping: (row) => ({
      id: row.ID,
      name: row.Name_Lang_enUS || row.Name_Lang_enGB || row.Name_Lang_deDE || row.Name_Lang_frFR || row.BackgroundFile || '',
      spell_icon_id: row.SpellIconID,
      race_mask: row.RaceMask,
      class_mask: row.ClassMask,
      pet_talent_mask: row.PetTalentMask,
      order_index: row.OrderIndex,
      background_file: row.BackgroundFile
    })
  },

  ItemRandomSuffix: {
    jsonFile: 'ItemRandomSuffix.json',
    dbFile: 'item_random_suffix.db',
    tableName: 'item_random_suffix',
    schema: `
      CREATE TABLE item_random_suffix (
        id INTEGER PRIMARY KEY,
        name TEXT,
        name_deDE TEXT,
        internal_name TEXT,
        enchantment_1 INTEGER,
        enchantment_2 INTEGER,
        enchantment_3 INTEGER,
        enchantment_4 INTEGER,
        enchantment_5 INTEGER,
        allocation_pct_1 INTEGER,
        allocation_pct_2 INTEGER,
        allocation_pct_3 INTEGER,
        allocation_pct_4 INTEGER,
        allocation_pct_5 INTEGER
      );
    `,
    mapping: (row) => ({
      id: row.ID,
      // Use localized name if available, otherwise fall back to InternalName (which has proper English names)
      name: row.Name_Lang_enUS || row.Name_Lang_enGB || row.InternalName || '',
      // German names are incorrectly stored in frFR field in the export, also check deDE for future-proofing
      name_deDE: row.Name_Lang_deDE || row.Name_Lang_frFR || '',
      internal_name: row.InternalName,
      enchantment_1: row.Enchantment_1,
      enchantment_2: row.Enchantment_2,
      enchantment_3: row.Enchantment_3,
      enchantment_4: row.Enchantment_4,
      enchantment_5: row.Enchantment_5,
      allocation_pct_1: row.AllocationPct_1,
      allocation_pct_2: row.AllocationPct_2,
      allocation_pct_3: row.AllocationPct_3,
      allocation_pct_4: row.AllocationPct_4,
      allocation_pct_5: row.AllocationPct_5
    })
  },

  ItemRandomProperties: {
    jsonFile: 'ItemRandomProperties.json',
    dbFile: 'item_random_properties.db',
    tableName: 'item_random_properties',
    schema: `
      CREATE TABLE item_random_properties (
        id INTEGER PRIMARY KEY,
        name TEXT,
        name_deDE TEXT,
        enchantment_1 INTEGER,
        enchantment_2 INTEGER,
        enchantment_3 INTEGER,
        enchantment_4 INTEGER,
        enchantment_5 INTEGER
      );
    `,
    mapping: (row) => ({
      id: row.ID,
      // ItemRandomProperties has a plain "Name" field with English names
      name: row.Name || row.Name_Lang_enUS || row.Name_Lang_enGB || '',
      // German names are incorrectly stored in frFR field in the export, also check deDE for future-proofing
      name_deDE: row.Name_Lang_deDE || row.Name_Lang_frFR || '',
      enchantment_1: row.Enchantment_1,
      enchantment_2: row.Enchantment_2,
      enchantment_3: row.Enchantment_3,
      enchantment_4: row.Enchantment_4,
      enchantment_5: row.Enchantment_5
    })
  },

  SpellIcon: {
    jsonFile: 'SpellIcon.json',
    dbFile: 'spell_icon.db',
    tableName: 'spell_icon',
    schema: `
      CREATE TABLE spell_icon (
        id INTEGER PRIMARY KEY,
        texture_filename TEXT
      );
      CREATE INDEX idx_texture ON spell_icon(texture_filename);
    `,
    mapping: (row) => ({
      id: row.ID,
      texture_filename: row.TextureFilename || ''
    })
  },

  SpellDuration: {
    jsonFile: 'SpellDuration.json',
    dbFile: 'spell_duration.db',
    tableName: 'spell_duration',
    schema: `
      CREATE TABLE spell_duration (
        id INTEGER PRIMARY KEY,
        duration INTEGER,
        duration_per_level INTEGER,
        max_duration INTEGER
      );
    `,
    mapping: (row) => ({
      id: row.ID,
      duration: row.Duration || 0,
      duration_per_level: row.DurationPerLevel || 0,
      max_duration: row.MaxDuration || 0
    })
  }
}

/**
 * Import a single DBC file
 */
function importDBC(name, config) {
  console.log(`\n📦 Importing ${name}...`)

  const jsonPath = join(DBC_JSON_DIR, config.jsonFile)
  const dbPath = join(DB_OUTPUT_DIR, config.dbFile)

  if (!existsSync(jsonPath)) {
    console.log(`⚠️  JSON file not found: ${jsonPath}`)
    return false
  }

  console.log(`  Reading: ${config.jsonFile}`)
  const jsonData = readFileSync(jsonPath, 'utf-8')
  const rows = JSON.parse(jsonData)

  console.log(`  ✅ Loaded ${rows.length} rows`)

  // Create database
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  console.log('  Creating schema...')
  db.exec(`DROP TABLE IF EXISTS ${config.tableName};`)
  db.exec(config.schema)

  // Get column names from first mapped row
  const firstMapped = config.mapping(rows[0])
  const columns = Object.keys(firstMapped)
  const placeholders = columns.map(() => '?').join(',')

  const insertSql = `INSERT INTO ${config.tableName} (${columns.join(',')}) VALUES (${placeholders})`
  const insert = db.prepare(insertSql)

  console.log('  Importing rows in batches...')

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      const mapped = config.mapping(item)
      const values = columns.map(col => mapped[col])
      insert.run(...values)
    }
  })

  const batchSize = 10000
  let imported = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    insertMany(batch)
    imported += batch.length
    if (rows.length > 10000) {
      console.log(`    Progress: ${imported}/${rows.length} (${Math.round(imported / rows.length * 100)}%)`)
    }
  }

  // Verify
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${config.tableName}`).get()
  console.log(`  ✅ Imported ${count.count} records to ${config.dbFile}`)

  db.close()
  return true
}

/**
 * Main execution
 */
console.log('🚀 Starting DBC to SQLite import')
console.log(`📂 JSON source: ${DBC_JSON_DIR}`)
console.log(`📂 DB output: ${DB_OUTPUT_DIR}`)

let successCount = 0
let totalCount = 0

for (const [name, config] of Object.entries(dbcConfigs)) {
  totalCount++
  if (importDBC(name, config)) {
    successCount++
  }
}

console.log(`\n✨ Complete! ${successCount}/${totalCount} imports successful`)
