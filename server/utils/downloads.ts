/**
 * Public file downloads (data/public)
 *
 * The pure helpers (range parsing, validators, response planning) are kept
 * free of Nuxt auto-imports so they can be unit-tested directly.
 * `handlePublicFileDownload` is the Node-level core used by
 * server/api/downloads/[filename].ts.
 */
import { promises as fsp } from 'node:fs'
import type { FileHandle } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createError } from 'h3'

export interface PublicFileInfo {
  name: string
  size: number
  modified: string
}

/** Inclusive byte range, as used by Content-Range and createReadStream */
export interface ByteRange {
  start: number
  end: number
}

/**
 * Result of evaluating a Range header against a representation of `size` bytes.
 * - `ignore`: no Range, malformed Range or multi-range -> serve the full 200 response
 * - `range`: a single satisfiable range -> 206
 * - `unsatisfiable`: syntactically valid but not satisfiable -> 416
 */
export type RangeParseResult =
  | { type: 'ignore' }
  | { type: 'range', range: ByteRange }
  | { type: 'unsatisfiable' }

export interface DownloadFileStat {
  size: number
  mtimeMs: number
}

export interface DownloadRequestHeaders {
  range?: string
  ifRange?: string
  ifNoneMatch?: string
}

export interface DownloadResponsePlan {
  status: 200 | 206 | 304 | 416
  headers: Record<string, string>
  /** Byte range to stream, or null when the response has no body */
  body: ByteRange | null
}

export const DOWNLOAD_CACHE_CONTROL = 'private, max-age=0, must-revalidate'
const DOWNLOAD_ALLOWED_METHODS = 'GET, HEAD'
const DOWNLOAD_STREAM_CHUNK_BYTES = 1024 * 1024
const MAX_PUBLIC_FILE_NAME_BYTES = 255
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

/**
 * Whether `name` may be listed/downloaded from the public directory.
 * Rejects path separators, control characters, dotfiles (including upload
 * `.part` temp files), `.`/`..`, the ext4 `lost+found` directory and `list`
 * (case-insensitive), which is the download list route's own path segment.
 */
export function isPublicFileName(name: string): boolean {
  if (!name) return false
  if (name.startsWith('.')) return false
  if (name.includes('/') || name.includes('\\')) return false
  if (CONTROL_CHARACTERS.test(name)) return false
  if (name === 'lost+found') return false
  if (name.toLowerCase() === 'list') return false
  if (Buffer.byteLength(name, 'utf8') > MAX_PUBLIC_FILE_NAME_BYTES) return false
  return true
}

/**
 * List downloadable files in `dir`, sorted by name.
 * Returns [] when the directory does not exist.
 */
export async function listPublicFiles(dir: string): Promise<PublicFileInfo[]> {
  let names: string[]
  try {
    names = await fsp.readdir(dir)
  } catch (error: any) {
    if (error?.code === 'ENOENT') return []
    throw error
  }

  const infos = await Promise.all(
    names.filter(isPublicFileName).map(async (name): Promise<PublicFileInfo | null> => {
      try {
        const stats = await fsp.stat(join(dir, name))
        if (!stats.isFile()) return null
        return { name, size: stats.size, modified: stats.mtime.toISOString() }
      } catch {
        // Removed or renamed between readdir and stat
        return null
      }
    }),
  )

  return infos
    .filter((info): info is PublicFileInfo => info !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Parse a Range header (RFC 9110 §14.1.2) for a representation of `size` bytes.
 * Only single `bytes` ranges are honoured; multi-range requests are answered
 * with the full representation, malformed headers are ignored.
 */
export function parseByteRange(header: string | undefined, size: number): RangeParseResult {
  if (!header) return { type: 'ignore' }

  const match = /^\s*bytes\s*=\s*(.*)$/i.exec(header)
  if (!match) return { type: 'ignore' }

  const specs = match[1]!.split(',').map(spec => spec.trim()).filter(spec => spec !== '')
  if (specs.length !== 1) return { type: 'ignore' }

  const spec = /^(\d*)\s*-\s*(\d*)$/.exec(specs[0]!)
  if (!spec) return { type: 'ignore' }

  const firstText = spec[1] ?? ''
  const lastText = spec[2] ?? ''
  if (firstText === '' && lastText === '') return { type: 'ignore' }

  if (firstText === '') {
    // Suffix range: last N bytes
    const suffixLength = Number(lastText)
    if (!Number.isSafeInteger(suffixLength)) return { type: 'ignore' }
    if (suffixLength === 0 || size === 0) return { type: 'unsatisfiable' }
    return { type: 'range', range: { start: Math.max(0, size - suffixLength), end: size - 1 } }
  }

  const start = Number(firstText)
  if (!Number.isSafeInteger(start)) return { type: 'ignore' }

  let end = size - 1
  if (lastText !== '') {
    const last = Number(lastText)
    if (!Number.isSafeInteger(last)) return { type: 'ignore' }
    // last-pos < first-pos is an invalid range-spec -> ignore the header
    if (last < start) return { type: 'ignore' }
    end = Math.min(last, size - 1)
  }

  if (start >= size) return { type: 'unsatisfiable' }
  return { type: 'range', range: { start, end } }
}

/** Strong ETag derived from size and modification time */
export function createDownloadEtag(stat: DownloadFileStat): string {
  return `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`
}

/** Last-Modified value (HTTP date, second precision) */
export function formatLastModified(mtimeMs: number): string {
  return new Date(Math.floor(mtimeMs / 1000) * 1000).toUTCString()
}

/**
 * Whether a Range request may be honoured given its If-Range header
 * (RFC 9110 §13.1.5). An absent If-Range always passes. An entity tag must
 * match strongly; a date must equal the current Last-Modified exactly.
 */
export function ifRangeAllowsRange(ifRange: string | undefined, etag: string, mtimeMs: number): boolean {
  if (ifRange === undefined) return true
  const value = ifRange.trim()
  if (value === '') return false

  if (value.startsWith('"') || value.startsWith('W/')) {
    // Weak tags never match for If-Range
    return value === etag
  }

  const date = Date.parse(value)
  if (Number.isNaN(date)) return false
  return Math.floor(date / 1000) === Math.floor(mtimeMs / 1000)
}

/** If-None-Match evaluation (weak comparison, supports `*` and lists) */
export function ifNoneMatchMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false
  const value = ifNoneMatch.trim()
  if (value === '*') return true

  const stripWeak = (tag: string) => tag.startsWith('W/') ? tag.slice(2) : tag
  const current = stripWeak(etag)
  return value.split(',').some(tag => stripWeak(tag.trim()) === current)
}

/**
 * Content-Disposition for downloads (RFC 6266 + RFC 5987):
 * an ASCII-only `filename` fallback plus the exact UTF-8 name in `filename*`.
 */
export function createAttachmentContentDisposition(filename: string): string {
  // eslint-disable-next-line no-control-regex
  const fallback = filename.replace(/[^\x20-\x7e]|["\\%]/g, '_')
  const encoded = encodeURIComponent(filename)
    .replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

/**
 * Decide status, headers and body range for a GET/HEAD download request.
 * Range handling only applies to GET (RFC 9110 §14.2). Preconditions
 * (If-None-Match) are evaluated before Range (RFC 9110 §13.2.4), so a
 * matching ETag yields 304 even when a Range is present.
 */
export function planDownloadResponse(input: {
  method: 'GET' | 'HEAD'
  filename: string
  stat: DownloadFileStat
  headers: DownloadRequestHeaders
}): DownloadResponsePlan {
  const { method, filename, stat, headers: request } = input
  const size = stat.size
  const etag = createDownloadEtag(stat)

  const validatorHeaders: Record<string, string> = {
    'Accept-Ranges': 'bytes',
    'ETag': etag,
    'Last-Modified': formatLastModified(stat.mtimeMs),
    'Cache-Control': DOWNLOAD_CACHE_CONTROL,
  }

  const rangeHeader = method === 'GET' ? request.range : undefined

  if (ifNoneMatchMatches(request.ifNoneMatch, etag)) {
    return { status: 304, headers: validatorHeaders, body: null }
  }

  const entityHeaders: Record<string, string> = {
    ...validatorHeaders,
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': createAttachmentContentDisposition(filename),
  }

  const range = rangeHeader && ifRangeAllowsRange(request.ifRange, etag, stat.mtimeMs)
    ? parseByteRange(rangeHeader, size)
    : { type: 'ignore' as const }

  if (range.type === 'unsatisfiable') {
    return {
      status: 416,
      headers: {
        ...validatorHeaders,
        'Content-Range': `bytes */${size}`,
        'Content-Length': '0',
      },
      body: null,
    }
  }

  if (range.type === 'range') {
    const { start, end } = range.range
    return {
      status: 206,
      headers: {
        ...entityHeaders,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
      body: method === 'GET' ? { start, end } : null,
    }
  }

  return {
    status: 200,
    headers: { ...entityHeaders, 'Content-Length': String(size) },
    body: method === 'GET' && size > 0 ? { start: 0, end: size - 1 } : null,
  }
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join(', ') : value
}

function notFound() {
  return createError({ statusCode: 404, statusMessage: 'File not found' })
}

/**
 * Serve `filename` from `dir` on a raw Node request/response.
 * Throws h3 errors (404/405) before any response bytes are written; stream
 * failures after the headers were sent are logged and end the response.
 */
export async function handlePublicFileDownload(
  req: IncomingMessage,
  res: ServerResponse,
  options: { dir: string, filename: string | undefined },
): Promise<void> {
  const method = req.method?.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', DOWNLOAD_ALLOWED_METHODS)
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const { dir, filename } = options
  if (!filename || !isPublicFileName(filename)) throw notFound()

  // Open first and stat the handle so headers and body describe the same
  // inode even if the file is atomically replaced during the request.
  let handle: FileHandle
  try {
    handle = await fsp.open(join(dir, filename), 'r')
  } catch (error: any) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR' || error?.code === 'EISDIR') throw notFound()
    throw error
  }

  let streaming = false
  try {
    const stats = await handle.stat()
    if (!stats.isFile()) throw notFound()

    const plan = planDownloadResponse({
      method,
      filename,
      stat: { size: stats.size, mtimeMs: stats.mtimeMs },
      headers: {
        range: singleHeader(req.headers.range),
        ifRange: singleHeader(req.headers['if-range']),
        ifNoneMatch: singleHeader(req.headers['if-none-match']),
      },
    })

    res.writeHead(plan.status, plan.headers)
    if (!plan.body) {
      res.end()
      return
    }

    const { start, end } = plan.body
    const total = end - start + 1
    const label = `${filename} [${start}-${end}/${stats.size}]`
    const stream = handle.createReadStream({ start, end, highWaterMark: DOWNLOAD_STREAM_CHUNK_BYTES })
    streaming = true // the read stream now owns (and auto-closes) the handle

    console.log(`[Download] Start ${label} (${total} bytes)`)
    try {
      // pipeline destroys the read stream when the response closes early
      await pipeline(stream, res)
      console.log(`[Download] Complete ${label}`)
    } catch (error: any) {
      if (error?.code === 'ERR_STREAM_PREMATURE_CLOSE' || res.destroyed) {
        console.log(`[Download] Aborted by client ${label} after ${stream.bytesRead} bytes`)
      } else {
        console.error(`[Download] Stream error ${label}:`, error)
      }
      if (!res.destroyed) res.destroy()
    }
  } finally {
    if (!streaming) await handle.close().catch(() => {})
  }
}
