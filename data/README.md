# WoW Frontend Data Directory

This directory contains the SQLite database for account mappings.

## Files

- `mappings.db` - SQLite database storing Keycloak ↔ WoW account mappings
- `*.json` - Export files (generated on demand)
- `*.sql` - SQL export files for migration

## Database Schema

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
