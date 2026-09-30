// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { createServer, request as httpRequest, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp, createRouter, eventHandler, getQuery, toNodeListener } from 'h3'
import {
  disableRequestTimeout,
  isUploadOverwriteFlag,
  receivePublicFileUpload,
  removeStaleUploadParts,
  sanitizeUploadFilename,
  STALE_UPLOAD_PART_MAX_AGE_MS,
} from '#server/utils/uploads'

const PART_NAME = '.client.7z.3f1c1a52-4b4e-4d2f-9f0a-0a0b0c0d0e0f.part'

function listen(server: Server): Promise<number> {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)))
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('waitFor timed out')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

describe('sanitizeUploadFilename', () => {
  it.each([
    ['client.7z', 'client.7z'],
    ['Wörld Ω.zip', 'Wörld Ω.zip'],
    ['some/dir/file.txt', 'file.txt'],
  ])('%j -> %j', (raw, expected) => {
    expect(sanitizeUploadFilename(raw)).toBe(expected)
  })

  it.each([undefined, '', '.', '..', 'dir/..', '/'])('rejects missing name %j', (raw) => {
    expect(() => sanitizeUploadFilename(raw)).toThrow(expect.objectContaining({ statusCode: 400, statusMessage: 'No filename provided' }))
  })

  it.each(['.hidden', PART_NAME, 'C:\\Users\\me\\file.txt', 'a\u0001b', 'lost+found', 'x'.repeat(256)])('rejects invalid name %j', (raw) => {
    expect(() => sanitizeUploadFilename(raw)).toThrow(expect.objectContaining({ statusCode: 400, statusMessage: 'Invalid filename' }))
  })
})

describe('isUploadOverwriteFlag', () => {
  it.each(['1', 'true', 'TRUE', 'yes', 'on', ['0', '1']])('%j is truthy', (value) => {
    expect(isUploadOverwriteFlag(value)).toBe(true)
  })

  it.each([undefined, '', '0', 'false', 'no', 1, true, null])('%j is falsy', (value) => {
    expect(isUploadOverwriteFlag(value)).toBe(false)
  })
})

describe('removeStaleUploadParts', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'upload-parts-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('removes only upload part files older than the max age', async () => {
    const now = Date.now()
    const old = new Date(now - STALE_UPLOAD_PART_MAX_AGE_MS - 60_000)
    const freshPart = '.fresh.bin.00000000-0000-4000-8000-000000000000.part'
    const oldForeignDotfile = '.keep.part'
    const oldRegular = 'regular.part'

    for (const name of [PART_NAME, freshPart, oldForeignDotfile, oldRegular]) {
      await writeFile(join(dir, name), 'x')
    }
    for (const name of [PART_NAME, oldForeignDotfile, oldRegular]) {
      await utimes(join(dir, name), old, old)
    }

    const removed = await removeStaleUploadParts(dir, { now })
    expect(removed).toEqual([PART_NAME])
    expect((await readdir(dir)).sort()).toEqual([freshPart, oldForeignDotfile, oldRegular].sort())
  })

  it('returns [] for a missing directory', async () => {
    expect(await removeStaleUploadParts(join(dir, 'missing'))).toEqual([])
  })
})

describe('disableRequestTimeout', () => {
  it('sets requestTimeout to 0 once', () => {
    const server = { requestTimeout: 300_000 }
    expect(disableRequestTimeout(server)).toBe(true)
    expect(server.requestTimeout).toBe(0)
    expect(disableRequestTimeout(server)).toBe(false)
    expect(disableRequestTimeout(undefined)).toBe(false)
  })

  async function slowPost(configure: (server: Server) => void): Promise<number | string> {
    const server = createServer({ requestTimeout: 400, connectionsCheckingInterval: 50 }, (req, res) => {
      req.resume()
      req.on('end', () => res.end('ok'))
    })
    const port = await listen(server)
    // Applied after listen(), the same way the Nitro plugin does at runtime
    configure(server)
    try {
      return await new Promise((resolve) => {
        const req = httpRequest({ host: '127.0.0.1', port, method: 'POST', headers: { 'content-length': '3' } }, (res) => {
          res.resume()
          res.on('end', () => resolve(res.statusCode ?? 0))
        })
        req.on('error', error => resolve((error as NodeJS.ErrnoException).code ?? 'error'))
        let sent = 0
        const timer = setInterval(() => {
          req.write('x')
          if (++sent === 3) {
            clearInterval(timer)
            req.end()
          }
        }, 300)
      })
    } finally {
      await closeServer(server)
    }
  }

  it('keeps long request bodies alive on a real http.Server', async () => {
    expect(await slowPost(() => {})).toBe(408)
    expect(await slowPost(server => disableRequestTimeout(server))).toBe(200)
  })
})

describe('receivePublicFileUpload early abort guard', () => {
  it('rejects immediately when the request is already destroyed before piping', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'upload-abort-'))
    try {
      const req = Object.assign(new Readable({ read() {} }), {
        headers: { 'content-type': 'multipart/form-data; boundary=b' },
        complete: false,
      }) as unknown as IncomingMessage
      req.destroy()
      await expect(receivePublicFileUpload(req, { dir, overwrite: false, maxBytes: 1024 }))
        .rejects.toMatchObject({ statusCode: 400, statusMessage: 'Upload aborted by client' })
      expect(await readdir(dir)).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('receivePublicFileUpload over HTTP', () => {
  let dir: string
  let server: Server
  let port: number
  let baseUrl: string
  const maxBytes = 8 * 1024 * 1024

  beforeAll(async () => {
    const router = createRouter().post('/upload', eventHandler(async (event) => {
      const result = await receivePublicFileUpload(event.node.req, {
        dir,
        overwrite: isUploadOverwriteFlag(getQuery(event).overwrite),
        maxBytes,
      })
      return { success: true, ...result }
    }))
    const app = createApp()
    app.use(router)
    server = createServer(toNodeListener(app))
    port = await listen(server)
    baseUrl = `http://127.0.0.1:${port}/upload`
  })

  afterAll(async () => {
    await closeServer(server)
  })

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'upload-http-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  /** Only ever talks to the loopback test server started above */
  const postUpload = (body: FormData | string, query = '', headers?: Record<string, string>) => {
    const parsed = new URL(baseUrl + query)
    if (parsed.hostname !== '127.0.0.1') throw new Error(`Refusing non-loopback URL ${parsed}`)
    return fetch(parsed, { method: 'POST', body, headers })
  }

  const fileForm = (name: string, content: string | Uint8Array, extra: Record<string, string> = {}) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(extra)) form.append(key, value)
    form.append('file', new Blob([content]), name)
    return form
  }

  const partFiles = async () => (await readdir(dir)).filter(name => name.endsWith('.part'))

  it('responds with success after the file is fully on disk (F1 regression)', async () => {
    const content = new Uint8Array(5 * 1024 * 1024 + 17)
    for (let i = 0; i < content.length; i++) content[i] = (i * 7) % 256

    const response = await postUpload(fileForm('client.7z', content))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, filename: 'client.7z', size: content.length, replaced: false })

    const stored = await readFile(join(dir, 'client.7z'))
    expect(stored.equals(Buffer.from(content))).toBe(true)
    expect(await partFiles()).toEqual([])
  })

  it('keeps UTF-8 filenames intact', async () => {
    const response = await postUpload(fileForm('Wörld Ω.txt', 'hi'))
    expect(response.status).toBe(200)
    expect(await readFile(join(dir, 'Wörld Ω.txt'), 'utf8')).toBe('hi')
  })

  it('accepts names up to 255 bytes (temp part name is shortened)', async () => {
    const name = `${'ä'.repeat(125)}.bin`
    expect(Buffer.byteLength(name)).toBe(254)
    const response = await postUpload(fileForm(name, 'long'))
    expect(response.status).toBe(200)
    expect(await readdir(dir)).toEqual([name])
  })

  it('returns 409 for an existing file unless overwrite is set', async () => {
    await writeFile(join(dir, 'client.7z'), 'original')

    const conflict = await postUpload(fileForm('client.7z', 'new content'))
    expect(conflict.status).toBe(409)
    const body = await conflict.json()
    expect(body.statusMessage).toBe('File already exists')
    expect(body.data.detail).toContain('overwrite=1')
    expect(await readFile(join(dir, 'client.7z'), 'utf8')).toBe('original')
    expect(await partFiles()).toEqual([])

    const replaced = await postUpload(fileForm('client.7z', 'new content'), '?overwrite=1')
    expect(replaced.status).toBe(200)
    expect(await replaced.json()).toMatchObject({ filename: 'client.7z', size: 11, replaced: true })
    expect(await readFile(join(dir, 'client.7z'), 'utf8')).toBe('new content')
    expect(await partFiles()).toEqual([])
  })

  it('rejects 409 early while a large body is still streaming, without uncaught errors', async () => {
    await writeFile(join(dir, 'client.7z'), 'original')
    const response = await postUpload(fileForm('client.7z', new Uint8Array(6 * 1024 * 1024)))
    expect(response.status).toBe(409)
    await response.arrayBuffer()
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(await readFile(join(dir, 'client.7z'), 'utf8')).toBe('original')
    expect(await partFiles()).toEqual([])
  })

  it('accepts overwrite as a form field sent before the file', async () => {
    await writeFile(join(dir, 'client.7z'), 'original')
    const response = await postUpload(fileForm('client.7z', 'via field', { overwrite: '1' }))
    expect(response.status).toBe(200)
    expect(await readFile(join(dir, 'client.7z'), 'utf8')).toBe('via field')
  })

  it('rejects files over the size limit with 413 and leaves nothing behind', async () => {
    const response = await postUpload(fileForm('big.bin', new Uint8Array(maxBytes + 1)))
    expect(response.status).toBe(413)
    expect(await readdir(dir)).toEqual([])
  })

  it('rejects a request without a file part', async () => {
    const form = new FormData()
    form.append('note', 'no file here')
    const response = await postUpload(form)
    expect(response.status).toBe(400)
    expect((await response.json()).statusMessage).toBe('No file uploaded')
  })

  it('rejects empty files', async () => {
    const response = await postUpload(fileForm('empty.txt', ''))
    expect(response.status).toBe(400)
    expect((await response.json()).statusMessage).toBe('Uploaded file is empty')
    expect(await readdir(dir)).toEqual([])
  })

  it('rejects more than one file and stores none of them', async () => {
    const form = fileForm('one.txt', 'one')
    form.append('file', new Blob(['two']), 'two.txt')
    const response = await postUpload(form)
    expect(response.status).toBe(400)
    expect((await response.json()).statusMessage).toBe('Only one file per upload is allowed')
    expect(await readdir(dir)).toEqual([])
  })

  it('rejects dotfile names', async () => {
    const response = await postUpload(fileForm('.hidden', 'x'))
    expect(response.status).toBe(400)
    expect((await response.json()).statusMessage).toBe('Invalid filename')
    expect(await readdir(dir)).toEqual([])
  })

  it('rejects non-multipart requests', async () => {
    const response = await postUpload('raw', '', { 'content-type': 'text/plain' })
    expect(response.status).toBe(400)
    expect((await response.json()).statusMessage).toBe('Invalid content type')
  })

  it('serves exactly one winner when two uploads of the same name race without overwrite', async () => {
    const [a, b] = await Promise.all([
      postUpload(fileForm('race.bin', 'AAAA')),
      postUpload(fileForm('race.bin', 'BBBBBBBB')),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const winner = a.status === 200 ? a : b
    const loser = a.status === 200 ? b : a
    expect(await winner.json()).toMatchObject({ success: true, filename: 'race.bin', replaced: false })
    expect((await loser.json()).statusMessage).toBe('File already exists')
    expect(await readdir(dir)).toEqual(['race.bin'])
    expect(['AAAA', 'BBBBBBBB']).toContain(await readFile(join(dir, 'race.bin'), 'utf8'))
  })

  it('removes the part file when the client aborts mid-upload', async () => {
    const boundary = 'test-boundary-123'
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="aborted.bin"\r\n`
      + 'Content-Type: application/octet-stream\r\n\r\n'

    const req = httpRequest({
      host: '127.0.0.1',
      port,
      path: '/upload',
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(head.length + 10 * 1024 * 1024),
      },
    })
    req.on('error', () => {})
    req.write(head)
    req.write(Buffer.alloc(256 * 1024, 1))

    await waitFor(async () => (await partFiles()).length === 1)
    await waitFor(async () => (await stat(join(dir, (await partFiles())[0]!))).size > 0)
    req.destroy()

    await waitFor(async () => (await readdir(dir)).length === 0)
    expect(await readdir(dir)).toEqual([])
  })
})
