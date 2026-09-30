import { cleanupBackupLeftovers } from '#server/utils/backup/cleanup-leftovers'

/**
 * Remove backup leftovers from earlier crashes on startup: stale
 * `.backup-tmp` entries, old `amp-*` temp dirs and pre-restore copies beyond
 * the newest few. Fire-and-forget; startup must not wait on the filesystem.
 */
export default defineNitroPlugin(() => {
  cleanupBackupLeftovers()
    .then((removed) => {
      if (removed.length > 0) {
        console.log(`[backup] Startup cleanup removed ${removed.length} leftover file(s)`)
      }
    })
    .catch((error) => {
      console.error('[backup] Startup cleanup failed:', error)
    })
})
