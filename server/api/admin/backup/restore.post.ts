/**
 * POST /api/admin/backup/restore
 * Restore a MySQL dump to auth and/or character databases
 * GM only — accepts raw SQL content
 *
 * Body: { sql: string, database: 'auth' | 'characters', realmId?: string }
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getAuthDbConfig, getRealmConfig } from '#server/utils/config'

const execFileAsync = promisify(execFile)

interface RestoreDbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export default defineEventHandler(async (event) => {
  try {
    const { username } = await getAuthenticatedFeatureUser(event, 'admin.backup')

    const body = await readBody(event)
    const { sql, database, realmId } = body as {
      sql: string
      database: 'auth' | 'characters'
      realmId?: string
    }

    if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'SQL content is required',
      })
    }

    if (!database || !['auth', 'characters'].includes(database)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Database must be "auth" or "characters"',
      })
    }

    if (database === 'characters' && !realmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Realm ID is required when restoring characters database',
      })
    }

    // Validate realm exists
    if (realmId) {
      const realm = getRealmConfig(realmId)
      if (!realm) {
        throw createError({
          statusCode: 404,
          statusMessage: `Realm ${realmId} not found`,
        })
      }
    }

    // Build restore config
    let dbConfig: RestoreDbConfig

    if (database === 'auth') {
      const authConfig = getAuthDbConfig()
      dbConfig = {
        host: authConfig.host,
        port: authConfig.port,
        user: authConfig.user,
        password: authConfig.password,
        database: authConfig.database,
      }
    } else {
      const realmConfig = getRealmConfig(realmId!)!
      dbConfig = {
        host: realmConfig.dbHost,
        port: realmConfig.dbPort,
        user: realmConfig.dbUser,
        password: realmConfig.dbPassword,
        database: 'acore_characters',
      }
    }

    console.log(`[Restore] GM ${username} starting restore to ${dbConfig.database}...`)

    await executeMysqlRestore(dbConfig, sql)

    const result = {
      success: true,
      message: `Successfully restored ${database} database${realmId ? ` for realm ${realmId}` : ''}`,
      database: dbConfig.database,
      sqlSize: sql.length,
    }

    console.log(`[Restore] GM ${username} completed restore to ${dbConfig.database} (${formatBytes(sql.length)})`)

    return result
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Restore] Error restoring backup:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to restore backup',
    })
  }
})

async function executeMysqlRestore(config: RestoreDbConfig, sql: string): Promise<void> {
  const args = [
    `--host=${config.host}`,
    `--port=${config.port}`,
    `--user=${config.user}`,
    config.database,
  ]

  try {
    const { stderr } = await execFileAsync('mysql', args, {
      maxBuffer: 1024 * 1024 * 512, // 512MB max
      env: {
        ...process.env,
        MYSQL_PWD: config.password,
      },
      // Pass SQL via stdin
      input: sql,
    } as any)

    if (stderr && !stderr.includes('Warning')) {
      console.warn('[Restore] mysql stderr:', stderr)
    }
  } catch (error: any) {
    console.error('[Restore] mysql import failed:', error.message)
    throw new Error(`MySQL restore failed for ${config.database}: ${error.stderr || error.message}`)
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
