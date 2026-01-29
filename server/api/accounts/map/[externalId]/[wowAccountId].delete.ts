import { AccountMappingDB } from '#server/utils/db'

/**
 * DELETE /api/accounts/map/:externalId/:wowAccountId
 * Remove mapping between external auth user and WoW account
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
    const config = useRuntimeConfig()
    const authMode = config.public.authMode

    // Get authenticated user from headers or mock user
    let authenticatedUser: string | undefined
    if (authMode === 'mock') {
      authenticatedUser = config.public.mockUser || 'admin'
    } else {
      authenticatedUser = getHeader(event, 'x-remote-user') ||
                          getHeader(event, 'x-auth-request-preferred-username') ||
                          getHeader(event, 'x-forwarded-preferred-username')
    }

    // Verify the mapping belongs to the authenticated user
    const mappings = AccountMappingDB.findByExternalId(externalId)
    const mapping = mappings.find(m => m.wow_account_id === wowAccountId)

    if (!mapping) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Account mapping not found',
      })
    }

    // Additional security check: verify externalId matches authenticated user
    if (authenticatedUser && mapping.display_name !== authenticatedUser) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Not authorized to delete this mapping',
      })
    }

    // Delete the mapping from database
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
