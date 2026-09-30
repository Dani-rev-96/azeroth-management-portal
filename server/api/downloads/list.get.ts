import { listPublicFiles } from '#server/utils/downloads'

/**
 * GET /api/downloads/list
 * List downloadable files in the public directory
 * (hides dotfiles, upload `.part` temp files, directories and lost+found)
 */
export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  try {
    return await listPublicFiles(config.public.publicPath)
  } catch (error) {
    console.error('Error listing files:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list files',
    })
  }
})
