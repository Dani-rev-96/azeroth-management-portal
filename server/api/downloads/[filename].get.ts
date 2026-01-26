import { createReadStream } from 'fs'
import { promises as fs } from 'fs'
import { join, basename } from 'path'

/**
 * GET /api/downloads/[filename]
 * Stream download a file from /data/public
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

    // Set appropriate headers for download
    setResponseHeaders(event, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Content-Length': stats.size.toString(),
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
    })

    // Stream the file
    return sendStream(event, createReadStream(filePath))
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
