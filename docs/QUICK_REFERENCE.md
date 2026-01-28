# Quick Reference: Enchantments & Talents

## 🚀 Quick Start

### 1. Import DBC Data (First Time Setup)

```bash
npm run import-dbc
```

This creates SQLite databases in `server/assets/`.

### 2. Run Application

```bash
npm run dev
```

### 3. View Character Page

Navigate to: `/character/{guid}/{realmId}`

You'll see items with enchantment stats and a visual talent tree.

---

## 📦 What Got Added

### Enchantment Stats on Items

Items now show their enchantments with actual stat bonuses:

```
[Thunderfury]
✨ +15 Agility
✨ +20 Stamina
✨ +25 Weapon Damage
```

### Visual Talent Tree

Replace the basic talent list with a proper 11×4 grid tree showing:

- 3 talent specs per class
- Color-coded nodes (gray/green/gold)
- Points spent per tree
- Proper tier/column positioning

---

## 🗂️ Key Files

### Import Script

```bash
scripts/import-dbc-to-sqlite.js
```

Converts JSON → SQLite for all DBC files.

### Server Utils

```typescript
server / utils / dbc - db.ts; // Database access
server / utils / enchantments.ts; // Enchantment parsing
```

### Components

```vue
app/components/character/CharacterTalentTree.vue // Talent tree app/components/character/CharacterEquipmentSlot.vue //
Item tooltips
```

### API

```typescript
server / api / characters / [guid] / [realmId].get.ts; // Enhanced character data
```

---

## 🔍 Database Queries

### Check an Enchantment

```bash
sqlite3 server/assets/spell_item_enchantment.db
SELECT id, name, effect_1, effect_arg_1, effect_points_max_1
FROM spell_item_enchantment
WHERE id = 3225;
```

### Check a Spell

```bash
sqlite3 server/assets/spell.db
SELECT id, name, rank, description
FROM spell
WHERE id = 54785;
```

### Check Talent Position

```bash
sqlite3 server/assets/talent.db
SELECT id, tab_id, tier_id, column_index, rank_id_1, rank_id_2
FROM talent
WHERE rank_id_1 = 54785;
```

---

## 🎨 Stat Type IDs

Common stat types in enchantments:

```
3  → Agility
4  → Strength
5  → Intellect
6  → Spirit
7  → Stamina
31 → Hit Rating
32 → Critical Strike Rating
36 → Haste Rating
37 → Expertise Rating
38 → Attack Power
45 → Spell Power
```

---

## 📊 Enchantment Slots

Item instance enchantments field (36 numbers):

```
Slot 0:  Permanent enchant
Slot 1:  Temporary enchant
Slot 2-4: Socket gems (red/yellow/blue)
Slot 5:  Bonus socket
Slot 6:  Prismatic socket
Slot 7-11: Random properties/suffix
```

Each slot: `[enchantId, duration, charges]`

---

## 🎯 Talent Tree Layout

```
11 tiers (rows)    - Tier 0 = Level 10, Tier 10 = Level 80
4 columns          - Left to right positioning
1-5 ranks per node - Multiple spell IDs per talent
```

Example positioning:

```typescript
{
  tier_id: 0,        // Top row
  column_index: 1,   // Second column
  rank_id_1: 12345,  // Rank 1 spell ID
  rank_id_2: 12346,  // Rank 2 spell ID
  rank_id_3: 12347   // Rank 3 spell ID
}
```

---

## 🛠️ Debugging

### Enable Logging

```typescript
// In server/utils/dbc-db.ts
console.log("[dbc-db] Query:", sql, params);
```

### Check Nitro Assets

```bash
ls -lh server/assets/*.db
```

### Verify Import Success

```bash
npm run import-dbc
# Should show: ✨ Complete! 8/8 imports successful
```

---

## ⚡ Performance Tips

1. **Batch queries** - Fetch multiple items at once:

   ```typescript
   const enchants = await getSpellItemEnchantmentBatch([123, 456, 789]);
   ```

2. **Cache results** - Databases are automatically cached in memory

3. **Index usage** - All primary keys and common lookups are indexed

---

## 🐛 Common Issues

### "Database not found"

**Solution:** Run `npm run import-dbc`

### "Enchantments field is empty"

**Cause:** Item has no enchantments
**Check:** `SELECT enchantments FROM item_instance WHERE guid = ?`

### "Talent tree is empty"

**Cause:** Character has no talents or data not in DBC
**Check:** `SELECT * FROM character_talent WHERE guid = ?`

### "Icons not loading"

**Expected:** Using placeholder emojis for now
**Future:** Add icon mapping from spell_icon table

---

## 📝 API Response Format

### Character Response

```typescript
{
  character: { ... },
  items: [
    {
      name: "Thunderfury",
      enchantmentTexts: ["+15 Agility", "+20 Stamina"],
      enchantmentInfos: [{ id: 3225, effects: [...] }]
    }
  ],
  talents: [
    {
      spell: 54785,
      spellName: "Death Strike",
      spellRank: "Rank 5",
      talentId: 123,
      tabId: 398,
      tier: 2,
      column: 1
    }
  ]
}
```

---

## 🔗 Resources

- **Full Documentation:** `docs/DBC_INTEGRATION.md`
- **Implementation Details:** `docs/IMPLEMENTATION_SUMMARY.md`
- **WoWDev Wiki:** https://wowdev.wiki/DBC
- **AzerothCore Docs:** https://www.azerothcore.org/wiki/

---

## ✅ Checklist

Setup:

- [ ] Run `npm run import-dbc`
- [ ] Verify 8 .db files in `server/assets/`
- [ ] Start dev server
- [ ] Navigate to character page
- [ ] Verify enchantments show
- [ ] Verify talent tree displays

Production:

- [ ] Commit .db files to git
- [ ] Update .gitignore if needed
- [ ] Test build: `npm run build`
- [ ] Deploy with assets included
