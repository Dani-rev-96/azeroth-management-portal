/**
 * Request parsing for the MySQL backup/restore endpoints: which ONE database
 * (auth or a realm's characters DB) a request targets, and its connection config.
 * Pure (config lookups are injected) so it is unit-testable without Nitro.
 */
import { CHARACTERS_DATABASE_NAME, type MysqlConnectionConfig } from './mysql-backup'

export type BackupDatabaseType = 'auth' | 'characters'

export interface BackupTargetRequest {
  database: BackupDatabaseType
  realmId?: string
}

export interface BackupTarget extends BackupTargetRequest {
  config: MysqlConnectionConfig
}

export interface BackupTargetConfigSource {
  getAuthDbConfig: () => MysqlConnectionConfig
  getRealmConfig: (realmId: string) => {
    dbHost: string
    dbPort: number
    dbUser: string
    dbPassword: string
  } | undefined
}

/** Error carrying the HTTP status the route should answer with. */
export class BackupRequestError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message)
    this.name = 'BackupRequestError'
  }
}

const VALID_DATABASES: BackupDatabaseType[] = ['auth', 'characters']

/**
 * Accepts `{ database, realmId? }` or the legacy `{ databases: [x], realmId? }`
 * with exactly one entry. Several databases are rejected: one file per database.
 */
export function parseBackupTargetRequest(body: unknown): BackupTargetRequest {
  const input = (body && typeof body === 'object' ? body : {}) as {
    database?: unknown
    databases?: unknown
    realmId?: unknown
  }

  let database = input.database
  if (database === undefined && input.databases !== undefined) {
    if (!Array.isArray(input.databases)) {
      throw new BackupRequestError(400, '"databases" must be an array')
    }
    if (input.databases.length > 1) {
      throw new BackupRequestError(
        400,
        'Only one database per backup request: each database is downloaded as its own file'
      )
    }
    database = input.databases[0]
  }

  if (typeof database !== 'string' || !VALID_DATABASES.includes(database as BackupDatabaseType)) {
    throw new BackupRequestError(400, `A database is required. Valid options: ${VALID_DATABASES.join(', ')}`)
  }

  const realmId = input.realmId === undefined || input.realmId === null || input.realmId === ''
    ? undefined
    : String(input.realmId)

  if (database === 'characters' && !realmId) {
    throw new BackupRequestError(400, 'Realm ID is required for the characters database')
  }

  return {
    database: database as BackupDatabaseType,
    realmId: database === 'characters' ? realmId : undefined,
  }
}

export function resolveBackupTarget(request: BackupTargetRequest, source: BackupTargetConfigSource): BackupTarget {
  if (request.database === 'auth') {
    const auth = source.getAuthDbConfig()
    return {
      ...request,
      config: {
        host: auth.host,
        port: auth.port,
        user: auth.user,
        password: auth.password,
        database: auth.database,
      },
    }
  }

  const realm = source.getRealmConfig(request.realmId!)
  if (!realm) {
    throw new BackupRequestError(404, `Realm ${request.realmId} not found`)
  }
  return {
    ...request,
    config: {
      host: realm.dbHost,
      port: realm.dbPort,
      user: realm.dbUser,
      password: realm.dbPassword,
      database: CHARACTERS_DATABASE_NAME,
    },
  }
}
