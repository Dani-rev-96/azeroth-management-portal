# WoW Frontend Data Directory

This directory contains data files required by the application.

## Files

### Required (included in builds)

- `items.db` - SQLite database with WoW item display information (icons, models)
  - **Must be committed to git** - used in production builds
  - Generated from `ItemDisplayInfo.json` via import script

### Development/Optional

- `mappings.db` - SQLite database storing Keycloak ↔ WoW account mappings
- `ItemDisplayInfo.json` - Source data for items.db (can be regenerated)
- `*.json` - Export files (generated on demand)
- `*.sql` - SQL export files for migration

## Items Database

The `items.db` file contains item display information extracted from WoW client data:

```sql
CREATE TABLE item_display_info (
  id INTEGER PRIMARY KEY,
  inventory_icon_1 TEXT,
  inventory_icon_2 TEXT,
  model_name_1 TEXT,
  model_name_2 TEXT,
  model_texture_1 TEXT,
  model_texture_2 TEXT
);
```

To regenerate from JSON:

```bash
node scripts/import-item-display-info.js
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
