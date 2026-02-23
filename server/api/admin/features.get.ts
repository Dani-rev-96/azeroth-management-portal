/**
 * GET /api/admin/features
 * List all available admin feature IDs with metadata
 * GM only
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { ADMIN_FEATURES } from '#server/utils/user-settings'

export default defineEventHandler(async (event) => {
  await getAuthenticatedGM(event)

  const features = Object.entries(ADMIN_FEATURES).map(([id, meta]) => ({
    id,
    ...meta,
  }))

  return { features }
})
