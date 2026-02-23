/**
 * GET /api/admin/my-features
 * Get the current user's active feature grants
 * Any authenticated user can call this — returns their active features
 */
import { getAuthenticatedUser } from '#server/utils/auth'
import { FeatureGrantDB, ADMIN_FEATURES } from '#server/utils/user-settings'

export default defineEventHandler(async (event) => {
  const { id: userId } = await getAuthenticatedUser(event)

  const activeFeatures = FeatureGrantDB.getActiveFeatures(userId)

  const features = [...activeFeatures].map(featureId => {
    const grant = FeatureGrantDB.getActiveGrant(userId, featureId)
    return {
      id: featureId,
      label: (ADMIN_FEATURES as Record<string, { label: string; icon: string }>)[featureId]?.label || featureId,
      icon: (ADMIN_FEATURES as Record<string, { label: string; icon: string }>)[featureId]?.icon || '🔓',
      ownAccountOnly: grant?.own_account_only === 1,
    }
  })

  return { features, hasAny: features.length > 0 }
})
