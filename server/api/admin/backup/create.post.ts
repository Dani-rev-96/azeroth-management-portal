/**
 * POST /api/admin/backup/create
 * Create a MySQL dump of auth and/or character databases
 * GM only — returns the dump as a downloadable SQL file
 *
 * Body: { databases: ('auth' | 'characters')[], realmId?: string }
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getAuthDbConfig, getRealmConfig, getRealms } from '#server/utils/config'

const execFileAsync = promisify(execFile)

interface BackupDbConfig {
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
    const { databases, realmId } = body as {
      databases: ('auth' | 'characters')[]
      realmId?: string
    }

    if (!databases || !Array.isArray(databases) || databases.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one database must be selected (auth, characters)',
      })
    }

    const validDbs = ['auth', 'characters'] as const
    for (const db of databases) {
      if (!validDbs.includes(db as typeof validDbs[number])) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid database: ${db}. Valid options: ${validDbs.join(', ')}`,
        })
      }
    }

    // Characters database requires a realm ID
    if (databases.includes('characters') && !realmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Realm ID is required when backing up characters database',
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

    // Build and execute mysqldump
    const dumpParts: string[] = []
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    let filename = `backup-${timestamp}`

    for (const db of databases) {
      if (db === 'auth') {
        const authConfig = getAuthDbConfig()
        const dbConfig: BackupDbConfig = {
          host: authConfig.host,
          port: authConfig.port,
          user: authConfig.user,
          password: authConfig.password,
          database: authConfig.database,
        }

        dumpParts.push(`-- Database: ${dbConfig.database}`)
        dumpParts.push(`-- Backup created by GM: ${username}`)
        dumpParts.push(`-- Timestamp: ${new Date().toISOString()}`)
        dumpParts.push('')

        const dumpResult = await executeMysqldump(dbConfig)
        dumpParts.push(dumpResult)
        dumpParts.push('')
        filename += '-auth'
      }

      if (db === 'characters' && realmId) {
        const realmConfig = getRealmConfig(realmId)!
        const dbConfig: BackupDbConfig = {
          host: realmConfig.dbHost,
          port: realmConfig.dbPort,
          user: realmConfig.dbUser,
          password: realmConfig.dbPassword,
          database: 'acore_characters',
        }

        dumpParts.push(`-- Database: ${dbConfig.database} (Realm: ${realmConfig.name})`)
        dumpParts.push(`-- Backup created by GM: ${username}`)
        dumpParts.push(`-- Timestamp: ${new Date().toISOString()}`)
        dumpParts.push('')

        const dumpResult = await executeMysqldump(dbConfig)
        dumpParts.push(dumpResult)
        dumpParts.push('')
        filename += `-characters-${realmId}`
      }
    }

    filename += '.sql'

    const fullDump = dumpParts.join('\n')
    const byteLength = new TextEncoder().encode(fullDump).length

    console.log(`[Backup] GM ${username} created backup: ${filename} (${formatBytes(byteLength)})`)

    // Return as downloadable SQL file
    setResponseHeaders(event, {
      'Content-Type': 'application/sql',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': byteLength.toString(),
    })

    return fullDump
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Backup] Error creating backup:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to create backup',
    })
  }
})

async function executeMysqldump(config: BackupDbConfig): Promise<string> {
  const args = [
    `--host=${config.host}`,
    `--port=${config.port}`,
    `--user=${config.user}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--add-drop-table',
    config.database,
  ]

  try {
    const { stdout, stderr } = await execFileAsync('mysqldump', args, {
      maxBuffer: 1024 * 1024 * 512, // 512MB max
      env: {
        ...process.env,
        // Use MYSQL_PWD env var for password (avoids command line warning)
        MYSQL_PWD: config.password,
      },
    })

    if (stderr && !stderr.includes('Warning') && !stderr.includes('Gtid')) {
      console.warn('[Backup] mysqldump stderr:', stderr)
    }

    return stdout
  } catch (error: any) {
    console.error('[Backup] mysqldump failed:', error.message)
    throw new Error(`mysqldump failed for ${config.database}: ${error.stderr || error.message}`)
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
