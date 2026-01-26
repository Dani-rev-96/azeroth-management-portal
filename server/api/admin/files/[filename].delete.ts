import { promises as fs } from 'fs'
import { join, basename } from 'path'

/**
 * DELETE /api/admin/files/[filename]
 * Delete a file from the public directory (GM only)
 */
export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    await getAuthenticatedGM(event)
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

    // Check if file exists
    try {
      const stats = await fs.stat(filePath)
      if (!stats.isFile()) {
        throw createError({
          statusCode: 404,
          statusMessage: 'File not found',
        })
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw createError({
          statusCode: 404,
          statusMessage: 'File not found',
        })
      }
      throw error
    }

    // Delete the file
    await fs.unlink(filePath)

    return {
      success: true,
      filename: safeFilename,
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    console.error('Error deleting file:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete file',
    })
  }
})
