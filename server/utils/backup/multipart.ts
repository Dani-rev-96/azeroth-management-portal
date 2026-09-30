/**
 * Streams a multipart/form-data upload (one file + text fields) to disk with busboy.
 * The file is never held in memory; the promise resolves only after the file
 * has been fully written and flushed.
 *
 * SERVER-SIDE ONLY
 */
import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import Busboy from 'busboy'

export interface MultipartUploadedFile {
  path: string
  originalName: string
  size: number
}

export interface MultipartUploadResult {
  fields: Record<string, string>
  file: MultipartUploadedFile
}

export interface MultipartUploadOptions {
  /** Directory the uploaded file is written into (must exist) */
  destDir: string
  /** Accepted filename suffixes, e.g. ['.sql', '.sql.gz'] (case-insensitive) */
  allowedSuffixes: string[]
  maxFileBytes?: number
}

/** Error carrying the HTTP status the route should answer with. */
export class MultipartUploadError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message)
    this.name = 'MultipartUploadError'
  }
}

export function hasAllowedSuffix(filename: string, allowedSuffixes: string[]): boolean {
  const lower = filename.toLowerCase()
  return allowedSuffixes.some(suffix => lower.endsWith(suffix.toLowerCase()))
}

export function receiveMultipartUpload(
  request: Readable,
  contentType: string | undefined,
  options: MultipartUploadOptions
): Promise<MultipartUploadResult> {
  if (!contentType || !contentType.toLowerCase().includes('multipart/form-data')) {
    return Promise.reject(new MultipartUploadError(400, 'Expected multipart/form-data upload'))
  }

  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {}
    let file: MultipartUploadedFile | null = null
    let fileWrite: Promise<void> | null = null
    let writeStream: ReturnType<typeof createWriteStream> | null = null
    let failure: MultipartUploadError | Error | null = null
    let settled = false

    const fail = async (error: MultipartUploadError | Error) => {
      if (settled) return
      settled = true
      failure = error
      request.unpipe(busboy)
      // Destroy busboy (and the write stream) so a pending pipeline settles and
      // its file handle is closed; unpipe alone leaves both hanging.
      busboy.destroy()
      writeStream?.destroy()
      request.resume()
      if (file) await rm(file.path, { force: true }).catch(() => {})
      reject(error)
    }

    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: {
        files: 1,
        fields: 20,
        ...(options.maxFileBytes ? { fileSize: options.maxFileBytes } : {}),
      },
    })

    busboy.on('field', (name, value) => {
      fields[name] = value
    })

    busboy.on('file', (_name, stream, info) => {
      // busboy.destroy() on early failure destroys the current file stream with
      // an error; skipped/drained streams have no other listener, so swallow it
      // here (pipeline() still sees errors on the stream it consumes).
      stream.on('error', () => {})
      if (failure || file) {
        stream.resume()
        return
      }
      const originalName = basename(info.filename || '')
      if (!originalName) {
        stream.resume()
        void fail(new MultipartUploadError(400, 'Uploaded file has no filename'))
        return
      }
      if (!hasAllowedSuffix(originalName, options.allowedSuffixes)) {
        stream.resume()
        void fail(new MultipartUploadError(400, `Unsupported file type: ${originalName}. Allowed: ${options.allowedSuffixes.join(', ')}`))
        return
      }

      const uploaded: MultipartUploadedFile = {
        path: join(options.destDir, `upload-${randomUUID()}-${originalName}`),
        originalName,
        size: 0,
      }
      file = uploaded
      stream.on('data', (chunk: Buffer) => {
        uploaded.size += chunk.length
      })
      stream.on('limit', () => {
        void fail(new MultipartUploadError(413, 'Uploaded file is too large'))
      })
      fileWrite = pipeline(stream, writeStream = createWriteStream(uploaded.path, { flush: true }))
      fileWrite.catch(error => fail(error instanceof Error ? error : new Error(String(error))))
    })

    busboy.on('filesLimit', () => {
      void fail(new MultipartUploadError(400, 'Only one file per upload is allowed'))
    })

    busboy.on('error', (error) => {
      void fail(error instanceof Error ? error : new Error(String(error)))
    })

    busboy.on('close', async () => {
      if (settled) return
      if (!file || !fileWrite) {
        await fail(new MultipartUploadError(400, 'No file uploaded'))
        return
      }
      try {
        await fileWrite
      } catch {
        return // fail() already handled it
      }
      if (settled) return
      settled = true
      resolve({ fields, file })
    })

    request.on('error', error => fail(error instanceof Error ? error : new Error(String(error))))
    // A plain client disconnect emits 'close' (not 'error') on the request;
    // without this the pending pipeline would never settle.
    request.on('close', () => {
      if (!request.readableEnded) fail(new MultipartUploadError(400, 'Upload aborted by client'))
    })
    request.pipe(busboy)
  })
}
