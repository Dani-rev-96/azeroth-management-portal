import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * GET /api/downloads/list
 * List all files in the public directory
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const publicDir = config.public.publicPath

  try {
    // Check if directory exists
    try {
      await fs.access(publicDir)
    } catch {
      return []
    }

    // Read directory contents
    const files = await fs.readdir(publicDir)

    // Get file stats for each file
    const fileInfos = await Promise.all(
      files.map(async (filename) => {
        const filePath = join(publicDir, filename)
        const stats = await fs.stat(filePath)

        // Only include files, not directories
        if (!stats.isFile()) {
          return null
        }

        return {
          name: filename,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        }
      })
    )

    // Filter out null entries and sort by name
    return fileInfos
      .filter((info) => info !== null)
      .sort((a, b) => a!.name.localeCompare(b!.name))
  } catch (error) {
    console.error('Error listing files:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list files',
    })
  }
})
