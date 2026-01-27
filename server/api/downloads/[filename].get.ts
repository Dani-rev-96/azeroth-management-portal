import { createReadStream } from 'fs'
import { promises as fs } from 'fs'
import { join, basename } from 'path'

/**
 * GET /api/downloads/[filename]
 * Stream download a file from /data/public with resume support
 */
export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename')

  if (!filename) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Filename is required',
    })
  }

  // Security: prevent directory traversal
  const safeFilename = basename(filename)
  const config = useRuntimeConfig()
  const publicDir = config.public.publicPath
  const filePath = join(publicDir, safeFilename)

  try {
    // Check if file exists and is a file
    const stats = await fs.stat(filePath)

    if (!stats.isFile()) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found',
      })
    }

    const fileSize = stats.size
    const rangeHeader = getRequestHeader(event, 'range')

    // Always support range requests for resumable downloads
    setResponseHeader(event, 'Accept-Ranges', 'bytes')
    setResponseHeader(event, 'Content-Type', 'application/octet-stream')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${safeFilename}"`)
    setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
    setResponseHeader(event, 'Connection', 'keep-alive')

    // Add ETag for better caching and resume validation
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`
    setResponseHeader(event, 'ETag', etag)

    // Check if client already has the file
    const ifNoneMatch = getRequestHeader(event, 'if-none-match')
    if (ifNoneMatch === etag) {
      setResponseStatus(event, 304) // Not Modified
      return null
    }

    // Handle range requests for resumable downloads
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = (end - start) + 1

      // Validate range
      if (start >= fileSize || end >= fileSize || start > end) {
        setResponseStatus(event, 416) // Range Not Satisfiable
        setResponseHeader(event, 'Content-Range', `bytes */${fileSize}`)
        throw createError({
          statusCode: 416,
          statusMessage: 'Range Not Satisfiable',
        })
      }

      // Set headers for partial content
      setResponseStatus(event, 206) // Partial Content
      setResponseHeader(event, 'Content-Length', chunkSize.toString())
      setResponseHeader(event, 'Content-Range', `bytes ${start}-${end}/${fileSize}`)

      console.log(`[Download] Resuming: ${safeFilename} (${start}-${end}/${fileSize})`)

      // Stream the requested range with larger chunks for better performance
      const stream = createReadStream(filePath, {
        start,
        end,
        highWaterMark: 1024 * 1024 // 1MB chunks
      })

      let bytesStreamed = 0
      let streamClosed = false

      // Detect client disconnect
      event.node.req.on('close', () => {
        if (!streamClosed) {
          console.log(`[Download] Client disconnected during resume at ${bytesStreamed}/${chunkSize} bytes for ${safeFilename}`)
          streamClosed = true
          stream.destroy()
        }
      })

      stream.on('data', (chunk) => {
        bytesStreamed += chunk.length
      })

      stream.on('end', () => {
        streamClosed = true
        console.log(`[Download] Completed partial: ${safeFilename} (${bytesStreamed}/${chunkSize} bytes)`)
      })

      // Handle stream errors
      stream.on('error', (err) => {
        if (!streamClosed) {
          console.error(`[Download] Stream error for ${safeFilename}:`, err)
        }
      })

      return sendStream(event, stream)
    }

    // Full file download
    setResponseHeader(event, 'Content-Length', fileSize.toString())

    console.log(`[Download] Starting full download: ${safeFilename} (${fileSize} bytes)`)

    // Stream the full file with larger chunks for better performance
    const stream = createReadStream(filePath, {
      highWaterMark: 1024 * 1024 // 1MB chunks
    })

    let bytesStreamed = 0
    let streamClosed = false

    // Detect client disconnect
    event.node.req.on('close', () => {
      if (!streamClosed) {
        console.log(`[Download] Client disconnected at ${bytesStreamed} bytes for ${safeFilename}`)
        streamClosed = true
        stream.destroy()
      }
    })

    stream.on('data', (chunk) => {
      bytesStreamed += chunk.length
      if (bytesStreamed % (100 * 1024 * 1024) === 0 || bytesStreamed < 1024 * 1024) {
        console.log(`[Download] Streamed ${bytesStreamed} bytes of ${safeFilename}`)
      }
    })

    stream.on('end', () => {
      streamClosed = true
      console.log(`[Download] Completed: ${safeFilename} (${bytesStreamed} bytes)`)
    })

    stream.on('error', (err) => {
      if (!streamClosed) {
        console.error(`[Download] Stream error for ${safeFilename}:`, err)
      }
    })

    return sendStream(event, stream)
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    if (error.code === 'ENOENT') {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found',
      })
    }

    console.error('Error downloading file:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to download file',
    })
  }
})
