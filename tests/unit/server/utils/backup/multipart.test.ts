// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import {
  MultipartUploadError,
  hasAllowedSuffix,
  receiveMultipartUpload,
} from '../../../../../server/utils/backup/multipart'

const BOUNDARY = '----amp-test-boundary'
const CONTENT_TYPE = `multipart/form-data; boundary=${BOUNDARY}`

type Part = { name: string; value: string } | { name: string; filename: string; data: Buffer }

function multipartBody(parts: Part[]): Buffer {
  const chunks: Buffer[] = []
  for (const part of parts) {
    chunks.push(Buffer.from(`--${BOUNDARY}\r\n`))
    if ('filename' in part) {
      chunks.push(Buffer.from(
        `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n'
      ))
      chunks.push(part.data)
      chunks.push(Buffer.from('\r\n'))
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`))
    }
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`))
  return Buffer.concat(chunks)
}

/** Emits the body in 64 KiB chunks, like a socket would. */
function requestStream(body: Buffer): Readable {
  const chunks: Buffer[] = []
  for (let i = 0; i < body.length; i += 64 * 1024) chunks.push(body.subarray(i, i + 64 * 1024))
  return Readable.from(chunks)
}

let destDir: string

afterEach(() => {
  if (destDir) rmSync(destDir, { recursive: true, force: true })
})

function newDestDir(): string {
  destDir = mkdtempSync(join(tmpdir(), 'multipart-test-'))
  return destDir
}

async function expectUploadError(promise: Promise<unknown>, statusCode: number, message: RegExp) {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(MultipartUploadError)
  expect((error as MultipartUploadError).statusCode).toBe(statusCode)
  expect((error as MultipartUploadError).message).toMatch(message)
}

describe('hasAllowedSuffix', () => {
  it('matches suffixes case-insensitively', () => {
    expect(hasAllowedSuffix('dump.SQL.GZ', ['.sql', '.sql.gz'])).toBe(true)
    expect(hasAllowedSuffix('dump.sql', ['.sql', '.sql.gz'])).toBe(true)
    expect(hasAllowedSuffix('dump.tar.gz', ['.sql', '.sql.gz'])).toBe(false)
  })
})

describe('receiveMultipartUpload', () => {
  it('streams a multi-MB file to disk and returns the text fields', async () => {
    const dir = newDestDir()
    const data = Buffer.alloc(3 * 1024 * 1024 + 17)
    for (let i = 0; i < data.length; i++) data[i] = i % 251
    const body = multipartBody([
      { name: 'database', value: 'characters' },
      { name: 'realmId', value: '1' },
      { name: 'file', filename: '../../etc/acore_characters.sql.gz', data },
      { name: 'confirm', value: 'acore_characters' },
    ])

    const result = await receiveMultipartUpload(requestStream(body), CONTENT_TYPE, {
      destDir: dir,
      allowedSuffixes: ['.sql', '.sql.gz'],
    })

    expect(result.fields).toEqual({ database: 'characters', realmId: '1', confirm: 'acore_characters' })
    expect(result.file.originalName).toBe('acore_characters.sql.gz')
    expect(result.file.size).toBe(data.length)
    expect(result.file.path.startsWith(dir)).toBe(true)
    expect(readFileSync(result.file.path).equals(data)).toBe(true)
  })

  it('rejects non-multipart requests', async () => {
    await expectUploadError(
      receiveMultipartUpload(Readable.from([]), 'application/json', { destDir: newDestDir(), allowedSuffixes: ['.sql'] }),
      400,
      /multipart\/form-data/
    )
  })

  it('rejects disallowed file types without writing anything', async () => {
    const dir = newDestDir()
    const body = multipartBody([{ name: 'file', filename: 'evil.sh', data: Buffer.from('rm -rf /') }])
    await expectUploadError(
      receiveMultipartUpload(requestStream(body), CONTENT_TYPE, { destDir: dir, allowedSuffixes: ['.sql', '.sql.gz'] }),
      400,
      /Unsupported file type: evil\.sh/
    )
    expect(readdirSync(dir)).toEqual([])
  })

  it('rejects a form without a file', async () => {
    const body = multipartBody([{ name: 'database', value: 'auth' }])
    await expectUploadError(
      receiveMultipartUpload(requestStream(body), CONTENT_TYPE, { destDir: newDestDir(), allowedSuffixes: ['.sql'] }),
      400,
      /No file uploaded/
    )
  })

  it('settles and removes the partial file when the request is destroyed mid-file', async () => {
    const dir = newDestDir()
    const body = multipartBody([{ name: 'file', filename: 'a.sql', data: Buffer.alloc(2 * 1024 * 1024, 65) }])
    // Push the first chunk, then stall: the file part has started but never ends
    const stream = new Readable({ read() {} })
    stream.push(body.subarray(0, 64 * 1024))
    const promise = receiveMultipartUpload(stream, CONTENT_TYPE, { destDir: dir, allowedSuffixes: ['.sql'] })
    setTimeout(() => stream.destroy(), 30)
    const error = await promise.then(() => null, (e: unknown) => e)
    expect(error).toBeInstanceOf(MultipartUploadError)
    expect((error as MultipartUploadError).statusCode).toBe(400)
    expect((error as MultipartUploadError).message).toMatch(/aborted/i)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(readdirSync(dir)).toEqual([])
  })

  it('rejects oversized files with 413 and removes the partial file', async () => {
    const dir = newDestDir()
    const body = multipartBody([{ name: 'file', filename: 'big.sql', data: Buffer.alloc(512 * 1024, 65) }])
    await expectUploadError(
      receiveMultipartUpload(requestStream(body), CONTENT_TYPE, { destDir: dir, allowedSuffixes: ['.sql'], maxFileBytes: 1024 }),
      413,
      /too large/
    )
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(readdirSync(dir)).toEqual([])
  })
})
