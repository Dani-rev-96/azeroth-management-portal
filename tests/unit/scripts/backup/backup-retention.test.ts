// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import { resolve } from 'path'

const RETENTION_SCRIPT = resolve(__dirname, '../../../../k3s/base/backups/scripts/backup-retention.sh')

function runRetention(stamps: string[], env: Record<string, string> = {}) {
  const result = spawnSync('sh', [RETENTION_SCRIPT], {
    input: stamps.join('\n') + '\n',
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
  })
  return {
    status: result.status,
    deleted: result.stdout.split('\n').filter(Boolean),
    stderr: result.stderr,
  }
}

/** Date → YYYYMMDDTHHMMSSZ */
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function parseStamp(ts: string): Date {
  return new Date(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}Z`)
}

function isoWeek(date: Date): string {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = (thursday.getUTCDay() + 6) % 7
  thursday.setUTCDate(thursday.getUTCDate() - weekday + 3)
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  const week = Math.floor((thursday.getTime() - yearStart) / 86400000 / 7) + 1
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Independent reference implementation of the documented policy (7 daily / 4 weekly / 6 monthly,
 *  plus: the newest backup is always kept). */
function expectedDeletions(stamps: string[], now: string, keepDays = 7, keepWeekly = 4, keepMonthly = 6): string[] {
  const nowMs = parseStamp(now).getTime()
  const sorted = [...new Set(stamps)].sort().reverse()
  const keep = new Set<string>()
  const weeks = new Set<string>()
  const months = new Set<string>()
  if (sorted.length) keep.add(sorted[0])
  for (const ts of sorted) {
    const date = parseStamp(ts)
    if (nowMs - date.getTime() < keepDays * 86400000) keep.add(ts)
    const week = isoWeek(date)
    if (!weeks.has(week)) {
      weeks.add(week)
      if (weeks.size <= keepWeekly) keep.add(ts)
    }
    const month = ts.slice(0, 6)
    if (!months.has(month)) {
      months.add(month)
      if (months.size <= keepMonthly) keep.add(ts)
    }
  }
  return sorted.filter(ts => !keep.has(ts)).reverse()
}

describe('backup-retention.sh', () => {
  const NOW = '20260930T033000Z'

  it('prints nothing for empty input', () => {
    const result = runRetention([], { NOW })
    expect(result.status).toBe(0)
    expect(result.deleted).toEqual([])
  })

  it('keeps every backup of the last 7 days, including several per day', () => {
    const stamps = ['20260930T033000Z', '20260929T120000Z', '20260929T033000Z', '20260924T033000Z', '20260923T033001Z']
    const result = runRetention(stamps, { NOW })
    expect(result.status).toBe(0)
    expect(result.deleted).toEqual([])
  })

  it('deletes older same-week and same-month backups beyond the daily window', () => {
    // NOW = Wed 2026-09-30 (ISO week 2026-W40). Daily window: younger than exactly 7 days.
    const stamps = [
      '20260930T033000Z', // W40, kept (daily)
      '20260924T033000Z', // W39, kept (daily)
      '20260923T033000Z', // W39, exactly 7 days → not daily; not newest of W39 → delete
      '20260922T033000Z', // W39 → delete
      '20260920T033000Z', // W38 newest → kept (weekly #3)
      '20260919T033000Z', // W38 → delete
      '20260913T033000Z', // W37 newest → kept (weekly #4)
      '20260906T033000Z', // W36 → no weekly slot left; month 09 already has a newer one → delete
      '20260831T033000Z', // W36 (already seen); month 08 newest → kept (monthly)
      '20260801T033000Z', // month 08 → delete
    ]
    const result = runRetention(stamps, { NOW })
    expect(result.status).toBe(0)
    expect(result.deleted).toEqual([
      '20260801T033000Z',
      '20260906T033000Z',
      '20260919T033000Z',
      '20260922T033000Z',
      '20260923T033000Z',
    ])
  })

  it('matches the reference policy for a year of nightly backups', () => {
    const stamps: string[] = []
    const start = Date.UTC(2025, 8, 1, 3, 30, 0)
    for (let day = 0; day < 395; day++) stamps.push(stamp(new Date(start + day * 86400000)))
    const now = stamps[stamps.length - 1]!
    const result = runRetention(stamps, { NOW: now })
    expect(result.status).toBe(0)
    expect(result.deleted).toEqual(expectedDeletions(stamps, now))
    // 7 daily + the weekly/monthly survivors outside the daily window (overlaps count once)
    const kept = stamps.length - result.deleted.length
    expect(kept).toBeGreaterThanOrEqual(7 + 1 + 5)
    expect(kept).toBeLessThanOrEqual(7 + 4 + 6)
  })

  it('handles ISO week-year boundaries (2020-W53 spans New Year)', () => {
    // Thu 2020-12-31 and Sun 2021-01-03 are both in 2020-W53; Mon 2021-01-04 is 2021-W01.
    const stamps = ['20201231T033000Z', '20210103T033000Z', '20210104T033000Z']
    const result = runRetention(stamps, { NOW: '20210301T000000Z', KEEP_DAYS: '0', KEEP_MONTHLY: '0' })
    expect(result.status).toBe(0)
    expect(result.deleted).toEqual(['20201231T033000Z'])
  })

  it('never wipes everything when backups stopped long ago', () => {
    const stamps: string[] = []
    const start = Date.UTC(2025, 0, 1, 3, 30, 0)
    for (let day = 0; day < 200; day++) stamps.push(stamp(new Date(start + day * 86400000)))
    const result = runRetention(stamps, { NOW })
    expect(result.status).toBe(0)
    const kept = stamps.filter(ts => !result.deleted.includes(ts))
    expect(kept).toContain(stamps[stamps.length - 1])
    expect(kept.length).toBeGreaterThanOrEqual(6)
    expect(result.deleted).toEqual(expectedDeletions(stamps, NOW))
  })

  it('keeps backups with a timestamp in the future', () => {
    const result = runRetention(['20270101T000000Z', '20200101T000000Z', '20200102T000000Z'], {
      NOW,
      KEEP_WEEKLY: '0',
      KEEP_MONTHLY: '0',
    })
    expect(result.deleted).toEqual(['20200101T000000Z', '20200102T000000Z'])
  })

  it('always keeps the newest backup even when every KEEP_* is 0', () => {
    const stamps = ['20200101T000000Z', '20200102T000000Z', '20200103T000000Z']
    const result = runRetention(stamps, { NOW, KEEP_DAYS: '0', KEEP_WEEKLY: '0', KEEP_MONTHLY: '0' })
    expect(result.status).toBe(0)
    expect(result.deleted).toEqual(['20200101T000000Z', '20200102T000000Z'])
  })

  it('honours KEEP_* overrides', () => {
    const stamps = ['20260901T000000Z', '20260801T000000Z', '20260701T000000Z']
    const result = runRetention(stamps, { NOW, KEEP_DAYS: '0', KEEP_WEEKLY: '0', KEEP_MONTHLY: '2' })
    expect(result.deleted).toEqual(['20260701T000000Z'])
  })

  it('ignores invalid lines and duplicates, and never deletes them', () => {
    const result = runRetention(
      ['garbage', '20200101T000000Z', '20200101T000000Z', '2020-01-01T00:00:00Z', '', '20200102T000000Z'],
      { NOW, KEEP_WEEKLY: '0', KEEP_MONTHLY: '0' },
    )
    expect(result.status).toBe(0)
    // 20200102 is the newest valid stamp and is always kept; the duplicate and the
    // invalid lines are never deleted either.
    expect(result.deleted).toEqual(['20200101T000000Z'])
    expect(result.stderr).toContain('ignoring invalid timestamp: garbage')
    expect(result.stderr).toContain('ignoring invalid timestamp: 2020-01-01T00:00:00Z')
  })

  it('rejects an invalid NOW or KEEP value', () => {
    expect(runRetention(['20200101T000000Z'], { NOW: 'yesterday' }).status).toBe(2)
    expect(runRetention(['20200101T000000Z'], { NOW, KEEP_DAYS: '-1' }).status).toBe(2)
  })

  it('uses the current time when NOW is not set', () => {
    const recent = stamp(new Date(Date.now() - 86400000))
    const result = runRetention([recent, '20000101T000000Z', '20000102T000000Z'], { KEEP_WEEKLY: '1', KEEP_MONTHLY: '1' })
    expect(result.deleted).toEqual(['20000101T000000Z', '20000102T000000Z'])
  })
})
