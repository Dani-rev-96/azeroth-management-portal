// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanupBackupLeftovers } from '../../../../../server/utils/backup/cleanup-leftovers'

let root: string
let sqliteDir: string
let tmpRoot: string
const savedTmpdir = process.env.TMPDIR

function aged(path: string, ageMs: number, now: number): void {
  const t = new Date(now - ageMs)
  utimesSync(path, t, t)
}

beforeAll(() => {
  root = mkdtempSync(join(process.cwd(), '.tmp-cleanup-test-'))
  sqliteDir = join(root, 'sqlite')
  tmpRoot = join(root, 'tmp')
  mkdirSync(sqliteDir, { recursive: true })
  mkdirSync(join(sqliteDir, '.backup-tmp'))
  mkdirSync(tmpRoot)
  process.env.TMPDIR = tmpRoot
  process.env.DB_PATH = join(sqliteDir, 'mappings.db')
  process.env.USER_SETTINGS_DB_PATH = join(sqliteDir, 'user-settings.db')
  process.env.PORTAL_CONFIG_DB_PATH = join(sqliteDir, 'portal-config.db')
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
  if (savedTmpdir === undefined) delete process.env.TMPDIR
  else process.env.TMPDIR = savedTmpdir
  delete process.env.DB_PATH
  delete process.env.USER_SETTINGS_DB_PATH
  delete process.env.PORTAL_CONFIG_DB_PATH
  rmSync(root, { recursive: true, force: true })
})

describe('cleanupBackupLeftovers', () => {
  it('removes old amp-* tmp dirs but keeps fresh ones and unrelated entries', async () => {
    const now = Date.now()
    const oldDir = join(tmpRoot, 'amp-backup-old')
    const freshDir = join(tmpRoot, 'amp-restore-fresh')
    const other = join(tmpRoot, 'unrelated-dir')
    for (const d of [oldDir, freshDir, other]) mkdirSync(d)
    aged(oldDir, 7 * 60 * 60 * 1000, now)

    const removed = await cleanupBackupLeftovers({ now })
    expect(removed).toContain(oldDir)
    expect(removed).not.toContain(freshDir)
    expect(removed).not.toContain(other)
    expect(existsSync(oldDir)).toBe(false)
    expect(existsSync(freshDir)).toBe(true)
    expect(existsSync(other)).toBe(true)
  })

  it('removes stale .backup-tmp entries but keeps fresh ones', async () => {
    const now = Date.now()
    const stale = join(sqliteDir, '.backup-tmp', 'snapshot-mappings-old.db')
    const fresh = join(sqliteDir, '.backup-tmp', 'upload-new.db')
    writeFileSync(stale, 'x')
    writeFileSync(fresh, 'y')
    aged(stale, 2 * 60 * 60 * 1000, now)

    const removed = await cleanupBackupLeftovers({ now })
    expect(removed).toContain(stale)
    expect(removed).not.toContain(fresh)
    expect(existsSync(stale)).toBe(false)
    expect(existsSync(fresh)).toBe(true)
  })

  it('keeps only the newest pre-restore copies (plus their -wal) per database', async () => {
    const now = Date.now()
    const names = [
      'a.pre-restore-2026-01-01T00-00-00-000Z.db',
      'b.pre-restore-2026-01-02T00-00-00-000Z.db',
      'c.pre-restore-2026-01-03T00-00-00-000Z.db',
      'd.pre-restore-2026-01-04T00-00-00-000Z.db',
      'e.pre-restore-2026-01-05T00-00-00-000Z.db',
    ]
    names.forEach((name, i) => {
      writeFileSync(join(sqliteDir, name), 'x')
      writeFileSync(join(sqliteDir, `${name}-wal`), 'w')
      aged(join(sqliteDir, name), (10 - i) * 60 * 60 * 1000, now)
    })

    const removed = await cleanupBackupLeftovers({ now })
    // newest 3 kept (e, d, c); a and b removed together with their -wal
    expect(removed).toContain(join(sqliteDir, names[0]))
    expect(removed).toContain(join(sqliteDir, names[1]))
    expect(existsSync(join(sqliteDir, names[0]))).toBe(false)
    expect(existsSync(join(sqliteDir, `${names[0]}-wal`))).toBe(false)
    expect(existsSync(join(sqliteDir, names[2]))).toBe(true)
    expect(existsSync(join(sqliteDir, names[4]))).toBe(true)
  })

  it('does not throw when nothing exists', async () => {
    const emptyRoot = mkdtempSync(join(process.cwd(), '.tmp-cleanup-empty-'))
    try {
      await expect(cleanupBackupLeftovers({ env: { DB_PATH: join(emptyRoot, 'none.db') }, now: Date.now() }))
        .resolves.toBeInstanceOf(Array)
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true })
    }
  })
})
