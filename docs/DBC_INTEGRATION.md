# DBC Integration Update

This document describes the recent updates to integrate DBC (DataBase Client) files for enhanced item and talent display.

## Overview

The application now reads DBC data from SQLite databases to provide:

1. **Item enchantment stats** - Shows exact stats from applied enchantments
2. **Talent tree visualization** - Renders character talent trees with proper positioning

## Changes Made

### 1. DBC JSON to SQLite Import

**New Script:** `scripts/import-dbc-to-sqlite.js`

This script converts DBC JSON exports into optimized SQLite databases:

- `item.db` - Item data (class, subclass, display info mapping)
- `item_display_info.db` - Item display information (icons, models)
- `spell_item_enchantment.db` - Enchantment effects and stats
- `spell.db` - Spell names, descriptions, tooltips
- `talent.db` - Talent tree positioning and ranks
- `talent_tab.db` - Talent tab/tree metadata
- `item_random_suffix.db` - Random suffix enchantments
- `item_random_properties.db` - Random property enchantments

**Usage:**

```bash
npm run import-dbc
```

All generated databases are stored in `server/assets/` for Nuxt's storage API.

### 2. Server Utilities

**New Files:**

- `server/utils/dbc-db.ts` - Generic DBC database access
- `server/utils/enchantments.ts` - Enchantment parsing and formatting

**Updated:**

- `server/utils/items-db.ts` - Now delegates to `dbc-db.ts` for backward compatibility

The `dbc-db.ts` module provides:

- Database connection pooling
- Type-safe query functions for each DBC
- Batch queries for performance

The `enchantments.ts` module provides:

- Parsing of `item_instance.enchantments` field (36-number format)
- Enchantment effect interpretation (stats, resistances, spells)
- Random property/suffix handling
- Human-readable formatting

### 3. API Updates

**Updated:** `server/api/characters/[guid]/[realmId].get.ts`

The character detail API now:

- Parses enchantments from `item_instance.enchantments`
- Fetches enchantment data from DBC
- Handles random properties/suffixes
- Enriches talent data with spell names and tree positions
- Returns formatted enchantment texts

**New Response Fields:**

```typescript
// Items
item.enchantmentTexts: string[]  // e.g., ["+15 Agility", "+20 Stamina"]
item.enchantmentInfos: EnchantmentInfo[]

// Talents
talent.spellName: string
talent.spellRank: string
talent.talentId: number
talent.tabId: number
talent.tier: number
talent.column: number
```

### 4. UI Components

**New Component:** `app/components/character/CharacterTalentTree.vue`

A visual talent tree display featuring:

- 3 talent tabs per class
- 11 tiers × 4 columns grid layout
- Color-coded talent nodes (inactive, active, maxed)
- Points spent per tree
- Required level calculation

**Updated:** `app/components/character/CharacterEquipmentSlot.vue`

Item tooltips now show:

- Enchantment effects with sparkle icon (✨)
- Readable stat bonuses from enchants
- Random suffix/property bonuses

**Updated:** `app/pages/character/[guid]/[realmId].vue`

Replaced the basic talent list with the new talent tree component.

### 5. Type Definitions

**Updated:** `app/types/index.ts`

```typescript
CharacterItem {
  enchantmentTexts?: string[]
  enchantmentInfos?: any[]
  randomPropertyId?: number
}

CharacterTalent {
  spellName?: string
  spellRank?: string
  talentId?: number
  tabId?: number
  tier?: number
  column?: number
}
```

## Data Source

All DBC data comes from exported JSON files in `data/dbcJsons/`:

- Extracted from WoW 3.3.5a client using DBC extraction tools
- Converted to JSON format
- Imported into SQLite for efficient runtime queries

The original DBC JSON files are **not** bundled in production. Only the SQLite databases are deployed.

## Enchantment System

### How Enchantments Work

1. **Storage:** `item_instance.enchantments` stores 36 numbers = 12 slots × (enchantId, duration, charges)
2. **Slots:**
   - 0: Permanent enchant
   - 1: Temporary enchant
   - 2-4: Socket gems
   - 5-6: Bonus/prismatic
   - 7-11: Random properties/suffix

3. **Effect Types:**
   - Stat (e.g., Agility, Strength)
   - Resistance (e.g., Fire Resistance)
   - Damage
   - Combat/Equip/Use Spells

4. **Random Enchants:**
   - **Properties (positive ID):** Fixed enchantments
   - **Suffix (negative ID):** Scaled by item level and allocation percentage

### Example

```sql
-- item_instance.enchantments
"3225 0 0  0 0 0  0 0 0  0 0 0  0 0 0  0 0 0  0 0 0  0 0 0  0 0 0  0 0 0  0 0 0  0 0 0"

-- Slot 0: enchantId=3225 → "Superior Striking" (+25 weapon damage)
```

Displays as: ✨ +25 Weapon Damage

## Talent System

### Talent Tree Layout

Each class has 3 talent trees with:

- 11 tiers (rows) - Unlocked every 2 levels starting at level 10
- 4 columns per tier
- 1-5 ranks per talent

### Talent Data Flow

1. **Database:** `character_talent` stores (guid, spell, specMask)
2. **DBC Lookup:**
   - Match spell ID against `Talent.dbc` rank IDs
   - Get talent position (tier, column)
   - Get tab ID
3. **Rendering:** Place talent in grid at (tier, column)

### Current Limitations

- Tab detection uses simple modulo mapping (can be improved with proper tab ID mapping)
- Max ranks are inferred from current rank (ideally read all rank IDs from DBC)
- No prerequisite arrows drawn
- Icons use placeholder emojis (could fetch from spell icons)

## Performance

- **SQLite databases:** Fast indexed lookups (~0.1ms per query)
- **Batch queries:** Fetch multiple items at once to minimize roundtrips
- **Memory usage:** Databases loaded on-demand and cached
- **File size:** Total ~15MB for all DBC databases (vs ~200MB uncompressed JSON)

## Future Enhancements

1. **Spell Icons:** Map talent spells to actual WoW icon files
2. **Tooltips:** Show full talent descriptions from spell tooltip text
3. **Prerequisites:** Draw arrows between prerequisite talents
4. **Socket Info:** Display gem socket types and bonuses
5. **Meta Gems:** Handle meta gem requirements
6. **Profession Enchants:** Special handling for profession-only enchants

## Debugging

To inspect a specific enchantment:

```bash
sqlite3 server/assets/spell_item_enchantment.db
SELECT * FROM spell_item_enchantment WHERE id = 3225;
```

To check talent positions:

```bash
sqlite3 server/assets/talent.db
SELECT * FROM talent WHERE rank_id_1 = 12345;
```

## References

- [WoWDev Wiki - DBC](https://wowdev.wiki/DBC)
- [TrinityCore - SpellItemEnchantment](https://trinitycore.info/en/database/335/world/spell_item_enchantment)
- [AzerothCore - Item System](https://www.azerothcore.org/wiki/item_template)
