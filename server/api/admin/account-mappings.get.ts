/**
 * GET /api/admin/account-mappings
 * Get all account mappings (GM only)
 */
export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig()
  const authMode = config.public.authMode
  try {
    // Check if user is GM
    let username: string
    let email: string

    // Production/Staging: read from oauth-proxy headers
    if (authMode === 'oauth-proxy' || authMode === 'keycloak') {
      username = getHeader(event, 'x-auth-request-user') || ''
      email = getHeader(event, 'x-auth-request-email') || ''

      if (!username) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Not authenticated',
        })
      }
    }
    // Local development: return mocked user
    else if (authMode === 'mock') {
      username = config.public.mockUser || 'admin'
      email = config.public.mockEmail || 'admin@localhost'
    }
    else {
      throw createError({
        statusCode: 500,
        statusMessage: 'Unknown auth mode',
      })
    }

    const { getUserGMLevel } = await import('#server/services/gm')
    const gmLevel = await getUserGMLevel(username)

    if (gmLevel === 0) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied - GM privileges required',
      })
    }

    // Get all mappings
    const { AccountMappingDB } = await import('#server/utils/db')
    const mappings = AccountMappingDB.findAll()

    return mappings
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error fetching admin mappings:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch mappings',
    })
  }
})
