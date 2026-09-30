import { getDatabase } from '#server/utils/db'
import { getUserSettingsDatabase } from '#server/utils/user-settings'
import { getPortalConfigDatabase } from '#server/utils/portal-config-db'

/**
 * Open all three portal SQLite databases at startup.
 *
 * The nightly SQLite backup reads them through a read-only mount and needs the
 * live -wal/-shm files; a database nobody has touched since boot has none (a
 * clean shutdown checkpoints and removes them), and the backup would fail for
 * it. Opening them eagerly keeps that path working. Errors are logged, never
 * fatal: the getters would hit the same problem on first use anyway.
 */
export default defineNitroPlugin(() => {
  for (const open of [getDatabase, getUserSettingsDatabase, getPortalConfigDatabase]) {
    try {
      open()
    } catch (error) {
      console.error('[startup] Failed to open a portal SQLite database:', error)
    }
  }
})
