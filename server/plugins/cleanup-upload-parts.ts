import { removeStaleUploadParts } from '#server/utils/uploads'

/**
 * Remove `.part` upload temp files older than 24 h from the public directory
 * on startup (left behind by crashes or killed uploads).
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  removeStaleUploadParts(config.public.publicPath)
    .then((removed) => {
      if (removed.length > 0) {
        console.log(`[uploads] Removed ${removed.length} stale upload part file(s):`, removed.join(', '))
      }
    })
    .catch((error) => {
      console.error('[uploads] Failed to clean up stale upload part files:', error)
    })
})
