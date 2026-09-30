// @vitest-environment node
/**
 * Endpoint-level tests for /api/admin/backup/* route handlers.
 * The handlers run inside a real h3 app on a real http.Server; Nitro auto-imports
 * are provided from h3, auth/config are mocked, mysqldump/mysql are fake scripts.
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import {
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  getHeader,
  getQuery,
  readBody,
  sendStream,
  setResponseHeaders,
  toNodeListener,
  type EventHandler,
} from 'h3'

vi.mock('#server/utils/auth', () => ({
  getAuthenticatedFeatureUser: vi.fn(async () => ({ id: 'gm-1', username: 'gm', email: '', gmLevel: 3 })),
  getAuthenticatedGM: vi.fn(async () => ({ id: 'gm-1', username: 'gm', email: '', gmLevel: 3 })),
}))

vi.mock('#server/utils/config', () => ({
  getAuthDbConfig: () => ({ host: 'auth-db', port: 3306, user: 'acore', password: 'authpw', database: 'acore_auth' }),
  getRealmConfig: (realmId: string) =>
    realmId === '1' ? { dbHost: 'realm1-db', dbPort: 3306, dbUser: 'acore', dbPassword: 'realmpw' } : undefined,
}))

let root: string
let tmp: string
let dataDir: string
let server: Server
let baseUrl: string
const savedEnv = { ...process.env }

function writeFakeBin(name: string, body: string): string {
  const path = join(root, name)
  writeFileSync(path, `#!${process.execPath}\n${body}\n`)
  chmodSync(path, 0o755)
  return path
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'backup-routes-'))
  tmp = join(root, 'tmp')
  dataDir = join(root, 'sqlite')
  mkdirSync(tmp)
  mkdirSync(dataDir)
  process.env.TMPDIR = tmp
  process.env.DB_PATH = join(dataDir, 'mappings.db')
  process.env.USER_SETTINGS_DB_PATH = join(dataDir, 'user-settings.db')
  process.env.PORTAL_CONFIG_DB_PATH = join(dataDir, 'portal-config.db')
  process.env.MYSQLDUMP_BIN = writeFakeBin('mysqldump', `
    process.stdout.write('-- dump of ' + process.argv[process.argv.length - 1] + '\\n')
    process.stdout.write('CREATE TABLE characters (guid INT);\\n')
  `)
  process.env.MYSQL_BIN = writeFakeBin('mysql', `
    const fs = require('node:fs')
    const out = fs.createWriteStream(${JSON.stringify(join(root, 'mysql-stdin.sql'))})
    process.stdin.pipe(out)
    out.on('finish', () => process.exit(0))
  `)
  vi.spyOn(console, 'log').mockImplementation(() => {})

  const globals = { defineEventHandler, createError, readBody, getHeader, getQuery, sendStream, setResponseHeaders }
  for (const [name, fn] of Object.entries(globals)) vi.stubGlobal(name, fn)

  const load = async (path: string) => (await import(path)).default as EventHandler
  const router = createRouter()
    .get('/list', await load('../../../../../../server/api/admin/backup/portal-list.get'))
    .post('/create', await load('../../../../../../server/api/admin/backup/create.post'))
    .post('/restore', await load('../../../../../../server/api/admin/backup/restore.post'))
    .post('/portal-create', await load('../../../../../../server/api/admin/backup/portal-create.post'))
    .post('/portal-restore', await load('../../../../../../server/api/admin/backup/portal-restore.post'))
  const app = createApp()
  app.use(router)

  server = createServer(toNodeListener(app))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(() => {
  delete process.env.BACKUP_RESTORE_ENABLED
})

afterAll(async () => {
  await new Promise(resolve => server.close(resolve))
  const { closeDatabase } = await import('../../../../../../server/utils/db')
  closeDatabase()
  process.env = { ...savedEnv }
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

function postJson(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function errorMessage(response: Response): Promise<string> {
  const data = await response.json() as { statusMessage?: string; message?: string }
  return data.statusMessage || data.message || ''
}

describe('POST /api/admin/backup/create', () => {
  it('streams one gzipped dump with the server filename and leaves nothing in TMPDIR', async () => {
    const response = await postJson('/create', { database: 'characters', realmId: '1' })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/gzip')
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="acore_characters-realm1-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.sql\.gz"$/
    )
    const body = Buffer.from(await response.arrayBuffer())
    expect(response.headers.get('content-length')).toBe(String(body.length))
    expect(gunzipSync(body).toString()).toContain('-- dump of acore_characters')
    expect(readdirSync(tmp)).toEqual([])
  })

  it('rejects several databases in one request', async () => {
    const response = await postJson('/create', { databases: ['auth', 'characters'], realmId: '1' })
    expect(response.status).toBe(400)
    expect(await errorMessage(response)).toMatch(/one database per backup request/i)
  })

  it('kills the dump and cleans up when the client disconnects mid-dump', async () => {
    const fastBin = process.env.MYSQLDUMP_BIN
    process.env.MYSQLDUMP_BIN = writeFakeBin('mysqldump-slow', 'setTimeout(() => process.stdout.write("-- slow\\n"), 5000)')
    try {
      const controller = new AbortController()
      const responsePromise = fetch(`${baseUrl}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database: 'auth' }),
        signal: controller.signal,
      })
      setTimeout(() => controller.abort(), 300)
      await expect(responsePromise).rejects.toThrow(/abort/i)
      await new Promise(resolve => setTimeout(resolve, 700))
      // The child was killed by the abort signal and the temp dir was removed
      expect(readdirSync(tmp)).toEqual([])
    } finally {
      process.env.MYSQLDUMP_BIN = fastBin
    }
  }, 15000)
})

describe('POST /api/admin/backup/restore', () => {
  function restoreForm(fields: Record<string, string>, file: Buffer, filename: string) {
    const form = new FormData()
    for (const [name, value] of Object.entries(fields)) form.append(name, value)
    form.append('file', new Blob([new Uint8Array(file)]), filename)
    return form
  }

  it('is disabled (403) unless BACKUP_RESTORE_ENABLED is set', async () => {
    const response = await fetch(`${baseUrl}/restore`, {
      method: 'POST',
      body: restoreForm({ database: 'auth', confirm: 'acore_auth' }, Buffer.from('SELECT 1;'), 'x.sql'),
    })
    expect(response.status).toBe(403)
    expect(await errorMessage(response)).toBe('Restore is disabled on this server (BACKUP_RESTORE_ENABLED)')
  })

  it('requires the typed target (with realm) as confirmation', async () => {
    process.env.BACKUP_RESTORE_ENABLED = 'true'
    rmSync(join(root, 'mysql-stdin.sql'), { force: true })
    const response = await fetch(`${baseUrl}/restore`, {
      method: 'POST',
      body: restoreForm({ database: 'characters', realmId: '1', confirm: 'acore_characters' }, Buffer.from('SELECT 1;'), 'x.sql'),
    })
    expect(response.status).toBe(400)
    expect(await errorMessage(response)).toMatch(/type "acore_characters@realm1"/)
    expect(existsSync(join(root, 'mysql-stdin.sql'))).toBe(false)
  })

  it('rejects uploads over the size cap with 413', async () => {
    process.env.BACKUP_RESTORE_ENABLED = 'true'
    process.env.BACKUP_RESTORE_MAX_BYTES_MYSQL = '4096'
    try {
      const response = await fetch(`${baseUrl}/restore`, {
        method: 'POST',
        body: restoreForm({ database: 'auth', confirm: 'acore_auth' }, Buffer.alloc(8192, 65), 'big.sql'),
      })
      expect(response.status).toBe(413)
      expect(await errorMessage(response)).toMatch(/too large/)
      expect(readdirSync(tmp)).toEqual([])
    } finally {
      delete process.env.BACKUP_RESTORE_MAX_BYTES_MYSQL
    }
  })

  it('streams an uploaded .sql.gz into mysql when enabled and confirmed', async () => {
    process.env.BACKUP_RESTORE_ENABLED = 'true'
    const sql = 'INSERT INTO characters VALUES (1);\n'.repeat(50000)
    const response = await fetch(`${baseUrl}/restore`, {
      method: 'POST',
      body: restoreForm({ database: 'characters', realmId: '1', confirm: 'acore_characters@realm1' }, gzipSync(sql), 'dump.sql.gz'),
    })
    expect(response.status).toBe(200)
    expect((await response.json()).success).toBe(true)
    expect(readFileSync(join(root, 'mysql-stdin.sql'), 'utf8')).toBe(sql)
    expect(readdirSync(tmp)).toEqual([])
  }, 20000)
})

describe('portal backup / restore routes', () => {
  it('lists portal DBs with the restore flag', async () => {
    const response = await fetch(`${baseUrl}/list`)
    const data = await response.json() as { databases: Array<{ key: string }>; restoreEnabled: boolean }
    expect(data.databases.map(db => db.key)).toEqual(['mappings', 'user-settings', 'portal-config'])
    expect(data.restoreEnabled).toBe(false)
  })

  it('downloads a snapshot and restores it back through the live util', async () => {
    const { AccountMappingDB } = await import('../../../../../../server/utils/db')
    AccountMappingDB.create({ externalId: 'sub-1', displayName: 'one', wowAccountId: 1, wowAccountUsername: 'ONE' })

    const download = await postJson('/portal-create', { database: 'mappings' })
    expect(download.status).toBe(200)
    expect(download.headers.get('content-disposition')).toMatch(/filename="portal-mappings-.*\.db"/)
    const snapshot = Buffer.from(await download.arrayBuffer())
    expect(snapshot.subarray(0, 15).toString()).toBe('SQLite format 3')
    expect(readdirSync(join(dataDir, '.backup-tmp'))).toEqual([])

    AccountMappingDB.create({ externalId: 'sub-2', displayName: 'two', wowAccountId: 2, wowAccountUsername: 'TWO' })
    expect(AccountMappingDB.findAll()).toHaveLength(2)

    const form = () => {
      const f = new FormData()
      f.append('confirm', 'mappings')
      f.append('file', new Blob([new Uint8Array(snapshot)]), 'portal-mappings.db')
      return f
    }

    const disabled = await fetch(`${baseUrl}/portal-restore?database=mappings`, { method: 'POST', body: form() })
    expect(disabled.status).toBe(403)

    process.env.BACKUP_RESTORE_ENABLED = '1'
    const restored = await fetch(`${baseUrl}/portal-restore?database=mappings`, { method: 'POST', body: form() })
    expect(restored.status).toBe(200)
    const result = await restored.json() as { preRestorePath: string }
    expect(existsSync(result.preRestorePath)).toBe(true)

    // Live util reopens on the restored file: sub-2 (added after the snapshot) is gone
    expect(AccountMappingDB.findAll().map(m => m.external_id)).toEqual(['sub-1'])
    const previous = new Database(result.preRestorePath, { readonly: true })
    expect((previous.prepare('SELECT COUNT(*) AS n FROM account_mappings').get() as { n: number }).n).toBe(2)
    previous.close()
  })

  it('rejects a SQLite file of the wrong portal DB', async () => {
    process.env.BACKUP_RESTORE_ENABLED = 'true'
    const wrong = join(root, 'wrong.db')
    const db = new Database(wrong)
    db.exec('CREATE TABLE portal_settings (id INTEGER)')
    db.close()
    const form = new FormData()
    form.append('confirm', 'mappings')
    form.append('file', new Blob([new Uint8Array(readFileSync(wrong))]), 'wrong.db')

    const response = await fetch(`${baseUrl}/portal-restore?database=mappings`, { method: 'POST', body: form })
    expect(response.status).toBe(400)
    expect(await errorMessage(response)).toMatch(/no account_mappings table/)
    expect(readdirSync(join(dataDir, '.backup-tmp'))).toEqual([])
  })
})
