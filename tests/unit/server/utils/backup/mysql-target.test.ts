import { describe, it, expect } from 'vitest'
import {
  BackupRequestError,
  parseBackupTargetRequest,
  resolveBackupTarget,
  type BackupTargetConfigSource,
} from '../../../../../server/utils/backup/mysql-target'

const source: BackupTargetConfigSource = {
  getAuthDbConfig: () => ({ host: 'auth-db', port: 3306, user: 'acore', password: 'authpw', database: 'acore_auth' }),
  getRealmConfig: (realmId: string) =>
    realmId === '1'
      ? { dbHost: 'realm1-db', dbPort: 3308, dbUser: 'realm', dbPassword: 'realmpw' }
      : undefined,
}

function expectRequestError(fn: () => unknown, statusCode: number, message: RegExp) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(BackupRequestError)
    expect((error as BackupRequestError).statusCode).toBe(statusCode)
    expect((error as BackupRequestError).message).toMatch(message)
    return
  }
  throw new Error('expected BackupRequestError')
}

describe('parseBackupTargetRequest', () => {
  it('accepts { database } for auth and ignores realmId', () => {
    expect(parseBackupTargetRequest({ database: 'auth', realmId: '1' })).toEqual({ database: 'auth', realmId: undefined })
  })

  it('accepts characters with realmId (numbers are stringified)', () => {
    expect(parseBackupTargetRequest({ database: 'characters', realmId: 1 })).toEqual({ database: 'characters', realmId: '1' })
  })

  it('accepts the legacy databases array with exactly one entry', () => {
    expect(parseBackupTargetRequest({ databases: ['characters'], realmId: '1' })).toEqual({ database: 'characters', realmId: '1' })
  })

  it('rejects several databases in one request with a one-file-per-DB message', () => {
    expectRequestError(
      () => parseBackupTargetRequest({ databases: ['auth', 'characters'], realmId: '1' }),
      400,
      /one database per backup request.*own file/i
    )
  })

  it('rejects missing, unknown and malformed databases', () => {
    expectRequestError(() => parseBackupTargetRequest({}), 400, /database is required/)
    expectRequestError(() => parseBackupTargetRequest(null), 400, /database is required/)
    expectRequestError(() => parseBackupTargetRequest({ database: 'world' }), 400, /Valid options: auth, characters/)
    expectRequestError(() => parseBackupTargetRequest({ databases: [] }), 400, /database is required/)
    expectRequestError(() => parseBackupTargetRequest({ databases: 'auth' }), 400, /must be an array/)
  })

  it('requires a realm for characters', () => {
    expectRequestError(() => parseBackupTargetRequest({ database: 'characters' }), 400, /Realm ID is required/)
  })
})

describe('resolveBackupTarget', () => {
  it('uses the auth DB config for auth', () => {
    expect(resolveBackupTarget({ database: 'auth' }, source).config).toEqual({
      host: 'auth-db', port: 3306, user: 'acore', password: 'authpw', database: 'acore_auth',
    })
  })

  it('uses the realm connection with the characters DB name', () => {
    expect(resolveBackupTarget({ database: 'characters', realmId: '1' }, source)).toEqual({
      database: 'characters',
      realmId: '1',
      config: { host: 'realm1-db', port: 3308, user: 'realm', password: 'realmpw', database: 'acore_characters' },
    })
  })

  it('404s on an unknown realm', () => {
    expectRequestError(() => resolveBackupTarget({ database: 'characters', realmId: '9' }, source), 404, /Realm 9 not found/)
  })
})
