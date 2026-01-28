# WoW Frontend Data Directory

This directory contains data files required by the application.

## Files

### DBC JSON Files (`dbcJsons/`)

DBC (DataBase Client) files exported from WoW 3.3.5a client data and converted to JSON:

- `Item.json` - Item metadata (class, subclass, display info)
- `ItemDisplayInfo.json` - Item display data (icons, models)
- `SpellItemEnchantment.json` - Enchantment effects and stats
- `Spell.json` - Spell names, descriptions, tooltips (~200MB)
- `Talent.json` - Talent tree positioning
- `TalentTab.json` - Talent tab/tree metadata
- `ItemRandomSuffix.json` - Random suffix enchantments
- `ItemRandomProperties.json` - Random property enchantments

These JSON files are **NOT** included in production builds. They are converted to SQLite databases in `server/assets/`.

### SQLite Databases (generated, stored in `server/assets/`)

Optimized databases generated from DBC JSONs for runtime use:

- `item.db` - Item data
- `item_display_info.db` - Item display information
- `spell_item_enchantment.db` - Enchantment data
- `spell.db` - Spell information
- `talent.db` - Talent tree data
- `talent_tab.db` - Talent tabs
- `item_random_suffix.db` - Random suffixes
- `item_random_properties.db` - Random properties

**Regenerate databases:**

```bash
npm run import-dbc
```

### Other Files

- `mappings.db` - Keycloak ↔ WoW account mappings (development only)
- `*.sql` - SQL export files for migration
- `blp/` - WoW texture files (BLP format)
- `png/` - Converted PNG icons

## Database Schema Examples

### item_display_info

```sql
CREATE TABLE item_display_info (
  id INTEGER PRIMARY KEY,
  inventory_icon_1 TEXT,
  inventory_icon_2 TEXT,
  model_name_1 TEXT,
  model_name_2 TEXT
);
```

### spell_item_enchantment

```sql
CREATE TABLE spell_item_enchantment (
  id INTEGER PRIMARY KEY,
  effect_1 INTEGER,
  effect_arg_1 INTEGER,
  effect_points_min_1 INTEGER,
  name TEXT
);
```

## Mappings Database Schema

```sql
CREATE TABLE account_mappings (
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
```

## Backup

To backup your mappings:

```bash
# Copy the database file
cp data/mappings.db data/mappings-backup-$(date +%Y%m%d).db

# Or export to JSON
curl -X POST http://localhost:3000/api/admin/export \
  -H "Content-Type: application/json" \
  -d '{"format": "json"}'
```

## Migration

When ready to migrate to Directus or another system:

```bash
# Export for Directus
curl -X POST http://localhost:3000/api/admin/export \
  -H "Content-Type: application/json" \
  -d '{"format": "directus"}'

# Export for PostgreSQL
curl -X POST http://localhost:3000/api/admin/export \
  -H "Content-Type: application/json" \
  -d '{"format": "postgres"}'
```

## Kubernetes Persistence

In production, mount a PersistentVolume:

```yaml
volumeMounts:
  - name: mappings-data
    mountPath: /app/data
volumes:
  - name: mappings-data
    persistentVolumeClaim:
      claimName: wow-frontend-mappings
```
