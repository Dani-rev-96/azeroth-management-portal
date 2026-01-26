/**
 * GET /api/auth/me
 * Returns current authenticated user
 *
 * In production: reads from oauth-proxy headers (X-Auth-Request-User, etc)
 * In local dev: returns mocked user from config
 * In staging: reads from Keycloak token
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const authMode = config.public.authMode

  console.log(`Auth mode: ${authMode}`)

  try {
    // Production/Staging: read from oauth-proxy headers
    if (authMode === 'oauth-proxy' || authMode === 'keycloak') {
      const username = getHeader(event, 'x-auth-request-user')
      const email = getHeader(event, 'x-auth-request-email')

      if (!username) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Not authenticated',
        })
      }

      return {
        sub: username,
        preferred_username: username,
        email: email || '',
        email_verified: true,
      }
    }

    // Local development: return mocked user
    if (authMode === 'mock') {
      const mockUser = config.public.mockUser || 'admin'
      const mockEmail = config.public.mockEmail || 'admin@localhost'

      return {
        sub: mockUser,
        preferred_username: mockUser,
        email: mockEmail,
        email_verified: true,
      }
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Unknown auth mode',
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication failed',
    })
  }
})
