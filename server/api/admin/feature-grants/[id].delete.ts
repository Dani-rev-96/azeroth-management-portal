/**
 * DELETE /api/admin/feature-grants/[id]
 * Delete a feature grant by ID
 * GM only
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { FeatureGrantDB } from '#server/utils/user-settings'

export default defineEventHandler(async (event) => {
  const { username } = await getAuthenticatedGM(event)

  const id = parseInt(getRouterParam(event, 'id') || '0')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Grant ID is required' })
  }

  const grant = FeatureGrantDB.findById(id)
  if (!grant) {
    throw createError({ statusCode: 404, statusMessage: 'Grant not found' })
  }

  FeatureGrantDB.deleteById(id)

  console.log(`[FeatureGrants] GM ${username} deleted grant #${id} (${grant.feature_id} for ${grant.username})`)

  return {
    success: true,
    message: `Deleted grant for ${grant.username} (${grant.feature_id})`,
  }
})
