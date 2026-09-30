// @vitest-environment node
import { mkdtemp, mkdir, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, eventHandler, getRouterParam, toNodeListener } from 'h3'
import {
  createAttachmentContentDisposition,
  createDownloadEtag,
  formatLastModified,
  handlePublicFileDownload,
  ifNoneMatchMatches,
  ifRangeAllowsRange,
  isPublicFileName,
  listPublicFiles,
  parseByteRange,
  planDownloadResponse,
  DOWNLOAD_CACHE_CONTROL,
} from '#server/utils/downloads'

describe('parseByteRange', () => {
  const size = 1000

  it.each([
    ['bytes=0-499', 0, 499],
    ['bytes=500-', 500, 999],
    ['bytes=-100', 900, 999],
    ['bytes=-2000', 0, 999],
    ['bytes=0-5000', 0, 999],
    ['bytes=999-999', 999, 999],
    ['bytes=0-0', 0, 0],
    ['bytes=999-', 999, 999],
    [' BYTES = 1 - 2 ', 1, 2],
    ['bytes=0-1,', 0, 1],
  ])('%s -> %i-%i', (header, start, end) => {
    expect(parseByteRange(header, size)).toEqual({ type: 'range', range: { start, end } })
  })

  it.each([
    'bytes=-0',
    'bytes=1000-',
    'bytes=1000-1001',
    'bytes=5000-6000',
  ])('%s is unsatisfiable', (header) => {
    expect(parseByteRange(header, size)).toEqual({ type: 'unsatisfiable' })
  })

  it.each([
    undefined,
    '',
    'bytes=',
    'bytes=-',
    'bytes=a-b',
    'bytes=1.5-2',
    'bytes=500-100',
    'items=0-1',
    '0-1',
    'bytes=0-1,5-6',
    'bytes=0-1, -5',
    'bytes=99999999999999999999-',
    'bytes=--5',
  ])('ignores %j (full response)', (header) => {
    expect(parseByteRange(header, size)).toEqual({ type: 'ignore' })
  })

  it('treats every range on an empty file as unsatisfiable', () => {
    expect(parseByteRange('bytes=0-', 0)).toEqual({ type: 'unsatisfiable' })
    expect(parseByteRange('bytes=-5', 0)).toEqual({ type: 'unsatisfiable' })
  })
})

describe('createDownloadEtag / formatLastModified', () => {
  it('builds a strong etag from size and mtime', () => {
    expect(createDownloadEtag({ size: 255, mtimeMs: 4096.7 })).toBe('"ff-1000"')
    expect(createDownloadEtag({ size: 256, mtimeMs: 4096 })).not.toBe(createDownloadEtag({ size: 255, mtimeMs: 4096 }))
  })

  it('formats Last-Modified with second precision', () => {
    expect(formatLastModified(Date.UTC(2025, 0, 2, 3, 4, 5, 999))).toBe('Thu, 02 Jan 2025 03:04:05 GMT')
  })
})

describe('ifRangeAllowsRange', () => {
  const mtimeMs = Date.UTC(2025, 0, 2, 3, 4, 5, 500)
  const etag = createDownloadEtag({ size: 10, mtimeMs })

  it('allows the range when If-Range is absent', () => {
    expect(ifRangeAllowsRange(undefined, etag, mtimeMs)).toBe(true)
  })

  it('matches the current strong etag only', () => {
    expect(ifRangeAllowsRange(etag, etag, mtimeMs)).toBe(true)
    expect(ifRangeAllowsRange('"other"', etag, mtimeMs)).toBe(false)
    expect(ifRangeAllowsRange(`W/${etag}`, etag, mtimeMs)).toBe(false)
  })

  it('matches an HTTP date equal to Last-Modified', () => {
    expect(ifRangeAllowsRange(formatLastModified(mtimeMs), etag, mtimeMs)).toBe(true)
    expect(ifRangeAllowsRange(formatLastModified(mtimeMs - 1000), etag, mtimeMs)).toBe(false)
    expect(ifRangeAllowsRange(formatLastModified(mtimeMs + 60_000), etag, mtimeMs)).toBe(false)
  })

  it('rejects garbage and empty values', () => {
    expect(ifRangeAllowsRange('not a date', etag, mtimeMs)).toBe(false)
    expect(ifRangeAllowsRange('  ', etag, mtimeMs)).toBe(false)
  })
})

describe('ifNoneMatchMatches', () => {
  const etag = '"a-b"'

  it('matches exact, listed, weak and wildcard tags', () => {
    expect(ifNoneMatchMatches('"a-b"', etag)).toBe(true)
    expect(ifNoneMatchMatches('"x", "a-b"', etag)).toBe(true)
    expect(ifNoneMatchMatches('W/"a-b"', etag)).toBe(true)
    expect(ifNoneMatchMatches('*', etag)).toBe(true)
  })

  it('does not match other or missing tags', () => {
    expect(ifNoneMatchMatches(undefined, etag)).toBe(false)
    expect(ifNoneMatchMatches('"x"', etag)).toBe(false)
  })
})

describe('createAttachmentContentDisposition', () => {
  it('keeps plain ASCII names', () => {
    expect(createAttachmentContentDisposition('client.7z'))
      .toBe('attachment; filename="client.7z"; filename*=UTF-8\'\'client.7z')
  })

  it('adds an ASCII fallback and RFC 5987 encoding for non-ASCII names', () => {
    expect(createAttachmentContentDisposition('Wörld Ω.zip'))
      .toBe('attachment; filename="W_rld _.zip"; filename*=UTF-8\'\'W%C3%B6rld%20%CE%A9.zip')
  })

  it('escapes quotes, backslashes, percent and RFC 5987 reserved characters', () => {
    expect(createAttachmentContentDisposition('a"b\\c%d\'(e)*.txt'))
      .toBe('attachment; filename="a_b_c_d\'(e)*.txt"; filename*=UTF-8\'\'a%22b%5Cc%25d%27%28e%29%2A.txt')
  })
})

describe('isPublicFileName', () => {
  it.each(['client.7z', 'Wörld.zip', 'a b.txt', 'x..y'])('accepts %j', (name) => {
    expect(isPublicFileName(name)).toBe(true)
  })

  it.each(['', '.', '..', '.hidden', '.x.7z.123.part', 'a/b', 'a\\b', 'a\u0000b', 'a\nb', 'lost+found', 'list', 'LIST', 'x'.repeat(256)])(
    'rejects %j',
    (name) => {
      expect(isPublicFileName(name)).toBe(false)
    },
  )
})

describe('planDownloadResponse', () => {
  const stat = { size: 1000, mtimeMs: Date.UTC(2025, 0, 1) }
  const etag = createDownloadEtag(stat)
  const plan = (method: 'GET' | 'HEAD', headers: Record<string, string> = {}) =>
    planDownloadResponse({ method, filename: 'client.7z', stat, headers })

  it('serves the full file with validators and download headers', () => {
    const result = plan('GET')
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ start: 0, end: 999 })
    expect(result.headers).toMatchObject({
      'Accept-Ranges': 'bytes',
      'ETag': etag,
      'Last-Modified': formatLastModified(stat.mtimeMs),
      'Cache-Control': DOWNLOAD_CACHE_CONTROL,
      'Content-Type': 'application/octet-stream',
      'Content-Length': '1000',
    })
    expect(result.headers['Content-Disposition']).toContain('filename="client.7z"')
  })

  it('returns the same headers without body for HEAD and ignores Range', () => {
    const result = plan('HEAD', { range: 'bytes=0-9' })
    expect(result.status).toBe(200)
    expect(result.body).toBeNull()
    expect(result.headers['Content-Length']).toBe('1000')
    expect(result.headers['Content-Range']).toBeUndefined()
  })

  it('serves a single range with 206', () => {
    const result = plan('GET', { range: 'bytes=-100' })
    expect(result.status).toBe(206)
    expect(result.body).toEqual({ start: 900, end: 999 })
    expect(result.headers['Content-Range']).toBe('bytes 900-999/1000')
    expect(result.headers['Content-Length']).toBe('100')
  })

  it('answers unsatisfiable ranges with 416 and bytes */size', () => {
    const result = plan('GET', { range: 'bytes=1000-' })
    expect(result.status).toBe(416)
    expect(result.body).toBeNull()
    expect(result.headers['Content-Range']).toBe('bytes */1000')
    expect(result.headers['Content-Length']).toBe('0')
  })

  it('serves the full file for multi-range and malformed Range', () => {
    expect(plan('GET', { range: 'bytes=0-1,4-5' }).status).toBe(200)
    expect(plan('GET', { range: 'bytes=x' }).status).toBe(200)
  })

  it('ignores Range when If-Range does not match', () => {
    const result = plan('GET', { range: 'bytes=0-9', ifRange: '"stale"' })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ start: 0, end: 999 })
    expect(plan('GET', { range: 'bytes=0-9', ifRange: etag }).status).toBe(206)
  })

  it('does not return 416 when If-Range does not match', () => {
    expect(plan('GET', { range: 'bytes=5000-', ifRange: '"stale"' }).status).toBe(200)
  })

  it('evaluates If-None-Match before Range (RFC 9110 §13.2.4)', () => {
    const notModified = plan('GET', { ifNoneMatch: etag })
    expect(notModified.status).toBe(304)
    expect(notModified.body).toBeNull()
    expect(notModified.headers.ETag).toBe(etag)
    expect(notModified.headers['Content-Length']).toBeUndefined()
    // A matching If-None-Match wins even when a Range is present
    expect(plan('GET', { ifNoneMatch: etag, range: 'bytes=0-9' }).status).toBe(304)
    expect(plan('GET', { ifNoneMatch: '"other"', range: 'bytes=0-9' }).status).toBe(206)
    expect(plan('GET', { ifNoneMatch: '"other"' }).status).toBe(200)
  })

  it('has no body for an empty file', () => {
    const result = planDownloadResponse({ method: 'GET', filename: 'e', stat: { size: 0, mtimeMs: 0 }, headers: {} })
    expect(result.status).toBe(200)
    expect(result.body).toBeNull()
    expect(result.headers['Content-Length']).toBe('0')
  })
})

describe('listPublicFiles', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'downloads-list-'))
    await writeFile(join(dir, 'b.zip'), 'bb')
    await writeFile(join(dir, 'a.7z'), 'a')
    await writeFile(join(dir, '.hidden'), 'x')
    await writeFile(join(dir, '.b.zip.3f1c1a52-4b4e-4d2f-9f0a-0a0b0c0d0e0f.part'), 'partial')
    await mkdir(join(dir, 'lost+found'))
    await mkdir(join(dir, 'subdir'))
    await symlink(join(dir, 'missing-target'), join(dir, 'dangling'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('lists only regular, visible files sorted by name', async () => {
    const files = await listPublicFiles(dir)
    expect(files.map(file => file.name)).toEqual(['a.7z', 'b.zip'])
    expect(files[1]).toMatchObject({ name: 'b.zip', size: 2 })
    expect(new Date(files[1]!.modified).toISOString()).toBe(files[1]!.modified)
  })

  it('returns [] for a missing directory', async () => {
    expect(await listPublicFiles(join(dir, 'nope'))).toEqual([])
  })
})

describe('handlePublicFileDownload over HTTP', () => {
  let dir: string
  let server: Server
  let baseUrl: string
  const content = Buffer.alloc(3 * 1024 * 1024 + 123)
  for (let i = 0; i < content.length; i++) content[i] = (i * 31) % 251
  const size = content.length

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    dir = await mkdtemp(join(tmpdir(), 'downloads-http-'))
    await writeFile(join(dir, 'client.7z'), content)
    await writeFile(join(dir, 'Wörld.txt'), 'hello')
    await writeFile(join(dir, '.secret'), 'nope')
    await utimes(join(dir, 'client.7z'), new Date('2025-01-01T00:00:00Z'), new Date('2025-01-01T00:00:00Z'))

    const router = createRouter().use('/dl/:filename', eventHandler(async (event) => {
      await handlePublicFileDownload(event.node.req, event.node.res, {
        dir,
        filename: getRouterParam(event, 'filename', { decode: true }),
      })
    }))
    const app = createApp()
    app.use(router)
    server = createServer(toNodeListener(app))
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/dl/`
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  })

  const url = (name: string) => baseUrl + encodeURIComponent(name)
  /** Only ever talks to the loopback test server started above */
  const fetchTestServer = (target: string, init?: RequestInit) => {
    const parsed = new URL(target)
    if (parsed.hostname !== '127.0.0.1') throw new Error(`Refusing non-loopback URL ${target}`)
    return fetch(parsed, init)
  }
  const bytes = async (response: Response) => Buffer.from(await response.arrayBuffer())

  it('serves the full file', async () => {
    const response = await fetchTestServer(url('client.7z'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe(String(size))
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/)
    expect(response.headers.get('last-modified')).toBe('Wed, 01 Jan 2025 00:00:00 GMT')
    expect(response.headers.get('cache-control')).toBe(DOWNLOAD_CACHE_CONTROL)
    expect((await bytes(response)).equals(content)).toBe(true)
  })

  it('answers HEAD with the same headers and no body', async () => {
    const get = await fetchTestServer(url('client.7z'))
    await get.arrayBuffer()
    const head = await fetchTestServer(url('client.7z'), { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers.get('content-length')).toBe(String(size))
    expect(head.headers.get('etag')).toBe(get.headers.get('etag'))
    expect(head.headers.get('content-disposition')).toBe(get.headers.get('content-disposition'))
    expect((await bytes(head)).length).toBe(0)
  })

  it('serves a byte range', async () => {
    const response = await fetchTestServer(url('client.7z'), { headers: { Range: 'bytes=100-199' } })
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe(`bytes 100-199/${size}`)
    expect(response.headers.get('content-length')).toBe('100')
    expect((await bytes(response)).equals(content.subarray(100, 200))).toBe(true)
  })

  it('serves an open-ended range to the end', async () => {
    const response = await fetchTestServer(url('client.7z'), { headers: { Range: `bytes=${size - 1000}-` } })
    expect(response.status).toBe(206)
    expect((await bytes(response)).equals(content.subarray(size - 1000))).toBe(true)
  })

  it('serves a suffix range', async () => {
    const response = await fetchTestServer(url('client.7z'), { headers: { Range: 'bytes=-100' } })
    expect(response.status).toBe(206)
    expect(response.headers.get('content-length')).toBe('100')
    expect(response.headers.get('content-range')).toBe(`bytes ${size - 100}-${size - 1}/${size}`)
    expect((await bytes(response)).equals(content.subarray(size - 100))).toBe(true)
  })

  it('answers an unsatisfiable range with 416', async () => {
    const response = await fetchTestServer(url('client.7z'), { headers: { Range: `bytes=${size}-` } })
    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe(`bytes */${size}`)
    expect((await bytes(response)).length).toBe(0)
  })

  it('ignores Range when If-Range does not match the current etag', async () => {
    const response = await fetchTestServer(url('client.7z'), { headers: { 'Range': 'bytes=0-9', 'If-Range': '"stale"' } })
    expect(response.status).toBe(200)
    expect((await bytes(response)).equals(content)).toBe(true)
  })

  it('honours Range when If-Range matches', async () => {
    const head = await fetchTestServer(url('client.7z'), { method: 'HEAD' })
    const etag = head.headers.get('etag')!
    const response = await fetchTestServer(url('client.7z'), { headers: { 'Range': 'bytes=0-9', 'If-Range': etag } })
    expect(response.status).toBe(206)
    expect((await bytes(response)).equals(content.subarray(0, 10))).toBe(true)
  })

  it('returns 304 for a matching If-None-Match', async () => {
    const head = await fetchTestServer(url('client.7z'), { method: 'HEAD' })
    const response = await fetchTestServer(url('client.7z'), { headers: { 'If-None-Match': head.headers.get('etag')! } })
    expect(response.status).toBe(304)
    expect((await bytes(response)).length).toBe(0)
  })

  it('serves non-ASCII names with an RFC 5987 Content-Disposition', async () => {
    const response = await fetchTestServer(url('Wörld.txt'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="W_rld.txt"; filename*=UTF-8\'\'W%C3%B6rld.txt')
    expect(await response.text()).toBe('hello')
  })

  it('rejects other methods with 405 and an Allow header', async () => {
    const response = await fetchTestServer(url('client.7z'), { method: 'POST' })
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
  })

  it('returns 404 for missing files, dotfiles and traversal attempts', async () => {
    expect((await fetchTestServer(url('missing.7z'))).status).toBe(404)
    expect((await fetchTestServer(url('.secret'))).status).toBe(404)
    expect((await fetchTestServer(url('../etc/passwd'))).status).toBe(404)
  })

  it('survives a client aborting mid-download', async () => {
    const controller = new AbortController()
    const response = await fetchTestServer(url('client.7z'), { signal: controller.signal })
    const reader = response.body!.getReader()
    await reader.read()
    controller.abort()
    await reader.read().catch(() => undefined)
    // Server keeps serving afterwards
    const next = await fetchTestServer(url('client.7z'), { headers: { Range: 'bytes=0-0' } })
    expect(next.status).toBe(206)
    await next.arrayBuffer()
  })
})
