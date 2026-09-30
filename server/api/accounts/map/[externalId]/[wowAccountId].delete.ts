import { AccountMappingDB } from '#server/utils/db'
import { getAuthenticatedUser } from '#server/utils/auth'
import { canDeleteMapping } from '#server/utils/account-mapping-auth'

/**
 * DELETE /api/accounts/map/:externalId/:wowAccountId
 * Remove mapping between external auth user and WoW account.
 * Allowed for the mapping's owner (externalId === authenticated user id) or a GM.
 */
export default defineEventHandler(async (event) => {
  const externalId = getRouterParam(event, 'externalId')
  const wowAccountIdStr = getRouterParam(event, 'wowAccountId')

  if (!externalId || !wowAccountIdStr) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
    })
  }

  const wowAccountId = parseInt(wowAccountIdStr, 10)
  if (isNaN(wowAccountId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid WoW account ID',
    })
  }

  try {
    const user = await getAuthenticatedUser(event)

    let isGM = false
    if (externalId !== user.id) {
      // Only non-owners need the GM lookup (same source as server/utils/auth.ts)
      const config = useRuntimeConfig()
      if (config.public.authMode === 'mock') {
        isGM = (config.public.mockGMLevel || 0) > 0
      } else {
        const { getUserGMLevel } = await import('#server/services/gm')
        isGM = (await getUserGMLevel(user.id)) > 0
      }
    }

    if (!canDeleteMapping({ userId: user.id, isGM, externalId })) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Not authorized to delete this mapping',
      })
    }

    const mapping = AccountMappingDB.findByIds(externalId, wowAccountId)
    if (!mapping) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Account mapping not found',
      })
    }

    const deleted = AccountMappingDB.delete(externalId, wowAccountId)

    if (!deleted) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete mapping',
      })
    }

    return {
      success: true,
      message: 'Account mapping removed',
    }
  } catch (error) {
    console.error('Error removing account mapping:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to remove account mapping',
    })
  }
})
