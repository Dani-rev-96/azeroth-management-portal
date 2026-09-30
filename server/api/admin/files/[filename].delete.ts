import { promises as fs } from 'fs'
import { join } from 'path'
import { isPublicFileName } from '#server/utils/downloads'

/**
 * DELETE /api/admin/files/[filename]
 * Delete a file from the public directory (GM only)
 */
export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    await getAuthenticatedFeatureUser(event, 'admin.files')
    const filename = getRouterParam(event, 'filename', { decode: true })

    if (!filename) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Filename is required',
      })
    }

    // Security: only plain public file names (no paths, dotfiles or .part temp files)
    if (!isPublicFileName(filename)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found',
      })
    }

    const config = useRuntimeConfig()
    const publicDir = config.public.publicPath
    const filePath = join(publicDir, filename)

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
      filename,
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
