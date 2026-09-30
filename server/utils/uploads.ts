/**
 * Public file uploads (data/public) and related server housekeeping.
 *
 * Kept free of Nuxt auto-imports so the core can be tested against a real
 * http.Server. Used by server/api/admin/files/upload.post.ts and the
 * plugins in server/plugins/.
 */
import { randomUUID } from 'node:crypto'
import { createWriteStream, promises as fsp } from 'node:fs'
import { once } from 'node:events'
import type { IncomingMessage, Server } from 'node:http'
import { basename, join } from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import Busboy from 'busboy'
import { createError, H3Error } from 'h3'
import { isPublicFileName } from './downloads'

/** 50 GiB */
export const MAX_PUBLIC_UPLOAD_BYTES = 53687091200

/** Temp files written by receivePublicFileUpload: `.<name>.<uuid>.part` */
const UPLOAD_PART_FILE_PATTERN = /^\..+\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.part$/i
export const STALE_UPLOAD_PART_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface PublicFileUploadOptions {
  dir: string
  /** Replace an existing file with the same name (otherwise 409) */
  overwrite: boolean
  maxBytes: number
}

export interface PublicFileUploadResult {
  filename: string
  size: number
  replaced: boolean
}

/** Truthy flag values accepted for `overwrite` (query or form field) */
export function isUploadOverwriteFlag(value: unknown): boolean {
  const text = Array.isArray(value) ? value[value.length - 1] : value
  return typeof text === 'string' && ['1', 'true', 'yes', 'on'].includes(text.trim().toLowerCase())
}

/**
 * Turn a client-supplied filename into a safe name inside the public dir.
 * Throws a 400 h3 error for names that cannot be stored or served.
 */
export function sanitizeUploadFilename(rawName: string | undefined): string {
  const name = basename(rawName ?? '')
  if (!name || name === '.' || name === '..') {
    throw createError({ statusCode: 400, statusMessage: 'No filename provided' })
  }
  if (!isPublicFileName(name)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid filename',
      data: { detail: 'Filenames must not start with ".", contain "/", "\\" or control characters, or exceed 255 bytes' },
    })
  }
  return name
}

const MAX_UPLOAD_PART_STEM_BYTES = 200

function uploadPartPath(dir: string, filename: string): string {
  // Keep `.<stem>.<uuid>.part` within the 255-byte filename limit
  const chars = Array.from(filename)
  while (Buffer.byteLength(chars.join(''), 'utf8') > MAX_UPLOAD_PART_STEM_BYTES) chars.pop()
  return join(dir, `.${chars.join('')}.${randomUUID()}.part`)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fsp.lstat(path)
    return true
  } catch (error: any) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function fileExistsError(filename: string) {
  return createError({
    statusCode: 409,
    statusMessage: 'File already exists',
    data: { detail: `"${filename}" already exists. Retry with overwrite=1 to replace it.`, filename },
  })
}

function toUploadError(error: unknown) {
  if (error instanceof H3Error) return error
  if (error && typeof error === 'object' && 'statusCode' in error) return error
  const err = error as NodeJS.ErrnoException | undefined
  if (err?.code === 'ENOSPC' || err?.code === 'EDQUOT') {
    return createError({ statusCode: 507, statusMessage: 'Insufficient storage', data: { detail: err.message } })
  }
  return createError({ statusCode: 500, statusMessage: 'Failed to write file', data: { detail: err?.message ?? String(error) } })
}

async function fsyncDirectory(dir: string): Promise<void> {
  try {
    const handle = await fsp.open(dir, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch {
    // Not supported on every filesystem; the rename itself already happened.
  }
}

interface WrittenUploadPart {
  filename: string
  partPath: string
  size: number
}

/**
 * Write one multipart file stream to `.<name>.<uuid>.part` in the target
 * directory and fsync it. The part file is removed on any failure (including
 * abort via `signal`); on success the caller commits or removes it.
 */
async function writeUploadPart(
  fileStream: Readable & { truncated?: boolean },
  filename: string,
  options: { dir: string, maxBytes: number, overwrite: () => boolean, signal: AbortSignal },
): Promise<WrittenUploadPart> {
  if (!options.overwrite() && await pathExists(join(options.dir, filename))) {
    fileStream.resume()
    throw fileExistsError(filename)
  }

  const partPath = uploadPartPath(options.dir, filename)
  // flush: fsync before close (Node >= 21), so the data is durable before rename
  const writeStream = createWriteStream(partPath, { flags: 'wx', flush: true })
  let written = false
  try {
    await pipeline(fileStream, writeStream, { signal: options.signal })
    if (!writeStream.closed) await once(writeStream, 'close')

    if (fileStream.truncated) {
      throw createError({
        statusCode: 413,
        statusMessage: 'File too large',
        data: { detail: `Maximum file size is ${options.maxBytes} bytes` },
      })
    }

    const size = writeStream.bytesWritten
    if (size === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Uploaded file is empty' })
    }

    written = true
    return { filename, partPath, size }
  } catch (error) {
    if (!fileStream.destroyed) fileStream.resume()
    throw toUploadError(error)
  } finally {
    if (!written) {
      writeStream.destroy()
      // Wait for the (possibly still pending) open/close before removing the file
      if (!writeStream.closed) await once(writeStream, 'close').catch(() => {})
      await fsp.rm(partPath, { force: true }).catch(() => {})
    }
  }
}

/**
 * Atomically move a written part file to its final name. Without overwrite,
 * `link` is used so the "don't overwrite" check is atomic (EEXIST -> 409)
 * even when two uploads of the same name commit concurrently.
 */
async function commitUploadPart(dir: string, part: WrittenUploadPart, overwrite: boolean): Promise<PublicFileUploadResult> {
  const target = join(dir, part.filename)

  if (!overwrite) {
    try {
      await fsp.link(part.partPath, target)
      await fsp.unlink(part.partPath)
    } catch (error: any) {
      if (error?.code === 'EEXIST') throw fileExistsError(part.filename)
      // Filesystems without hardlink support: fall back to check + rename
      if (error?.code !== 'ENOSYS' && error?.code !== 'EPERM' && error?.code !== 'ENOTSUP' && error?.code !== 'EMLINK') throw error
      if (await pathExists(target)) throw fileExistsError(part.filename)
      await fsp.rename(part.partPath, target)
    }
    await fsyncDirectory(dir)
    return { filename: part.filename, size: part.size, replaced: false }
  }

  const replaced = await pathExists(target)
  await fsp.rename(part.partPath, target)
  await fsyncDirectory(dir)
  return { filename: part.filename, size: part.size, replaced }
}

/**
 * Receive a single-file multipart upload from `req` into `options.dir`.
 *
 * Resolves only after the file is fully written, fsynced and renamed into
 * place (the rename happens after the whole multipart body parsed cleanly). Rejects with h3 errors: 400 (bad request/filename, no/extra/empty
 * file, client abort), 409 (exists and not overwriting), 413 (too large),
 * 507/500 (disk errors). A form field `overwrite` sent *before* the file part
 * is honoured in addition to `options.overwrite`.
 */
export async function receivePublicFileUpload(
  req: IncomingMessage,
  options: PublicFileUploadOptions,
): Promise<PublicFileUploadResult> {
  const contentType = req.headers['content-type']
  if (!contentType || !/^multipart\/form-data/i.test(contentType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid content type',
      data: { detail: 'Expected multipart/form-data' },
    })
  }

  await fsp.mkdir(options.dir, { recursive: true })

  let busboy: ReturnType<typeof Busboy>
  try {
    busboy = Busboy({
      headers: req.headers,
      defParamCharset: 'utf8',
      limits: { fileSize: options.maxBytes, files: 1, fields: 10 },
    })
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: 'Malformed multipart request', data: { detail: error?.message } })
  }

  const controller = new AbortController()
  let failure: unknown = null
  let overwriteField = false
  const upload: { fileTask: Promise<WrittenUploadPart> | null } = { fileTask: null }

  const fail = (error: unknown) => {
    if (failure === null) failure = error
    controller.abort()
  }

  const parsed = new Promise<void>((resolve) => {
    controller.signal.addEventListener('abort', () => resolve(), { once: true })
    busboy.on('close', () => resolve())
    busboy.on('error', (error: Error) => {
      fail(createError({ statusCode: 400, statusMessage: 'Malformed multipart request', data: { detail: error.message } }))
    })
  })

  busboy.on('field', (name: string, value: string) => {
    if (name === 'overwrite') overwriteField = isUploadOverwriteFlag(value)
  })

  busboy.on('filesLimit', () => {
    fail(createError({ statusCode: 400, statusMessage: 'Only one file per upload is allowed' }))
  })

  busboy.on('file', (_fieldName: string, fileStream: Readable, info: { filename?: string }) => {
    // busboy.destroy() on early failure destroys the current file stream with an
    // error; skipped/drained streams have no other listener, so swallow it here
    // (pipeline() still sees errors on the stream it consumes).
    fileStream.on('error', () => {})

    if (upload.fileTask || failure !== null) {
      fileStream.resume()
      return
    }

    let filename: string
    try {
      filename = sanitizeUploadFilename(info.filename)
    } catch (error) {
      fileStream.resume()
      fail(error)
      return
    }

    const task = writeUploadPart(fileStream, filename, {
      dir: options.dir,
      maxBytes: options.maxBytes,
      overwrite: () => options.overwrite || overwriteField,
      signal: controller.signal,
    })
    task.catch(fail)
    upload.fileTask = task
  })

  const onRequestClose = () => {
    if (!req.complete) {
      fail(createError({ statusCode: 400, statusMessage: 'Upload aborted by client' }))
    }
  }
  const onRequestError = (error: Error) => {
    fail(createError({ statusCode: 400, statusMessage: 'Upload aborted by client', data: { detail: error.message } }))
  }
  req.on('close', onRequestClose)
  req.on('error', onRequestError)
  // If the client already went away before piping started, 'close' will never
  // fire again and the parse would hang forever.
  if (req.destroyed || req.readableAborted) {
    fail(createError({ statusCode: 400, statusMessage: 'Upload aborted by client' }))
  }
  req.pipe(busboy)

  let part: WrittenUploadPart | null = null
  try {
    await parsed
    // Wait for the part file write (and its cleanup on failure) to finish
    const pendingTask = upload.fileTask
    part = pendingTask ? await pendingTask.catch(() => null) : null
    if (failure !== null) throw failure
    if (!part) throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })

    // Commit only after the whole multipart body parsed without errors
    let result: PublicFileUploadResult
    try {
      result = await commitUploadPart(options.dir, part, options.overwrite || overwriteField)
    } catch (error) {
      throw toUploadError(error)
    }
    part = null
    return result
  } finally {
    if (part) await fsp.rm(part.partPath, { force: true }).catch(() => {})
    req.off('close', onRequestClose)
    req.off('error', onRequestError)
    if (failure !== null && !req.complete) {
      // Stop parsing; any remaining body is discarded by the http server
      req.unpipe(busboy)
      busboy.destroy()
      req.resume()
    }
  }
}

/**
 * Remove `.part` upload temp files older than `maxAgeMs` from `dir`.
 * Returns the removed file names. A missing directory is not an error.
 */
export async function removeStaleUploadParts(
  dir: string,
  options: { maxAgeMs?: number, now?: number } = {},
): Promise<string[]> {
  const maxAgeMs = options.maxAgeMs ?? STALE_UPLOAD_PART_MAX_AGE_MS
  const cutoff = (options.now ?? Date.now()) - maxAgeMs

  let names: string[]
  try {
    names = await fsp.readdir(dir)
  } catch (error: any) {
    if (error?.code === 'ENOENT') return []
    throw error
  }

  const removed: string[] = []
  for (const name of names) {
    if (!UPLOAD_PART_FILE_PATTERN.test(name)) continue
    const path = join(dir, name)
    try {
      const stats = await fsp.lstat(path)
      if (!stats.isFile() || stats.mtimeMs > cutoff) continue
      await fsp.unlink(path)
      removed.push(name)
    } catch {
      // Vanished or not removable; try again next start
    }
  }
  return removed
}

/**
 * Disable Node's per-request timeout (default 300 s since Node 18) so long
 * uploads/downloads are not cut off. headersTimeout is left untouched.
 * Returns true when the value was changed.
 */
export function disableRequestTimeout(server: Pick<Server, 'requestTimeout'> | null | undefined): boolean {
  if (!server || typeof server.requestTimeout !== 'number' || server.requestTimeout === 0) return false
  server.requestTimeout = 0
  return true
}
