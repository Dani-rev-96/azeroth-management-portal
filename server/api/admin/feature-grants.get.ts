/**
 * GET /api/admin/feature-grants
 * List all feature grants (active, upcoming, and expired)
 * GM only
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { FeatureGrantDB, ADMIN_FEATURES } from '#server/utils/user-settings'

export default defineEventHandler(async (event) => {
  await getAuthenticatedGM(event)

  const grants = FeatureGrantDB.findAll()

  // Enrich with feature metadata and active status
  const now = new Date().toISOString()
  const enriched = grants.map(g => ({
    ...g,
    featureLabel: (ADMIN_FEATURES as Record<string, { label: string }>)[g.feature_id]?.label || g.feature_id,
    isActive: g.start_time <= now && g.end_time > now,
    isExpired: g.end_time <= now,
    isUpcoming: g.start_time > now,
    ownAccountOnly: g.own_account_only === 1,
  }))

  return { grants: enriched }
})
