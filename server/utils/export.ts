import { writeFileSync } from 'fs'
import { join } from 'path'
import { AccountMappingDB } from './db'

/**
 * Export all account mappings to JSON file
 * Useful for backup or migration to other systems (Directus, Postgres, etc.)
 */
export function exportMappings(outputPath?: string) {
  const mappings = AccountMappingDB.findAll()
  const path = outputPath || join(process.cwd(), 'data', 'mappings-export.json')
  
  writeFileSync(path, JSON.stringify(mappings, null, 2), 'utf-8')
  
  console.log(`✅ Exported ${mappings.length} account mappings to ${path}`)
  return { count: mappings.length, path }
}

/**
 * Export mappings in a format ready for Directus import
 */
export function exportForDirectus() {
  const mappings = AccountMappingDB.findAll()
  
  // Transform to Directus-friendly format
  const directusData = mappings.map(m => ({
    keycloak_user_id: m.keycloak_id,
    keycloak_username: m.keycloak_username,
    wow_account_id: m.wow_account_id,
    wow_account_name: m.wow_account_username,
    status: 'active',
    date_created: m.created_at,
    date_updated: m.last_used,
    metadata: m.metadata ? JSON.parse(m.metadata) : null,
  }))

  const path = join(process.cwd(), 'data', 'directus-import.json')
  writeFileSync(path, JSON.stringify(directusData, null, 2), 'utf-8')
  
  console.log(`✅ Exported ${directusData.length} mappings for Directus to ${path}`)
  return { count: directusData.length, path }
}

/**
 * Generate SQL export for migration to PostgreSQL/MySQL
 */
export function exportToSQL(dialect: 'postgres' | 'mysql' = 'postgres') {
  const mappings = AccountMappingDB.findAll()
  
  const sqlStatements = mappings.map(m => {
    const metadata = m.metadata ? `'${m.metadata.replace(/'/g, "''")}'` : 'NULL'
    const lastUsed = m.last_used ? `'${m.last_used}'` : 'NULL'
    
    if (dialect === 'postgres') {
      return `INSERT INTO account_mappings (keycloak_id, keycloak_username, wow_account_id, wow_account_username, created_at, last_used, metadata) VALUES ('${m.keycloak_id}', '${m.keycloak_username}', ${m.wow_account_id}, '${m.wow_account_username}', '${m.created_at}', ${lastUsed}, ${metadata});`
    } else {
      return `INSERT INTO account_mappings (keycloak_id, keycloak_username, wow_account_id, wow_account_username, created_at, last_used, metadata) VALUES ('${m.keycloak_id}', '${m.keycloak_username}', ${m.wow_account_id}, '${m.wow_account_username}', '${m.created_at}', ${lastUsed}, ${metadata});`
    }
  })

  const path = join(process.cwd(), 'data', `export-${dialect}.sql`)
  const content = `-- Account Mappings Export for ${dialect.toUpperCase()}
-- Generated: ${new Date().toISOString()}
-- Total records: ${mappings.length}

${sqlStatements.join('\n')}
`
  
  writeFileSync(path, content, 'utf-8')
  
  console.log(`✅ Exported ${mappings.length} mappings to ${dialect.toUpperCase()} at ${path}`)
  return { count: mappings.length, path }
}
