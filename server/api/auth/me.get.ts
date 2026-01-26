/**
 * GET /api/auth/me
 * Returns current authenticated user with GM status
 *
 * In production: reads from oauth-proxy headers (X-Auth-Request-User, etc)
 * In local dev: returns mocked user from config
 * In staging: reads from Keycloak token
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const authMode = config.public.authMode

  try {
    const { username, email } = await getAuthenticatedUser(event)

    // Check GM status for this user
    const { getUserGMLevel } = await import('#server/services/gm')
    let gmLevel
    if (authMode === "mock") {
      gmLevel = 3
    } else {
      gmLevel = await getUserGMLevel(username)
    }

    return {
      sub: username,
      preferred_username: username,
      email: email,
      email_verified: true,
      isGM: gmLevel > 0,
      gmLevel: gmLevel,
    }
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
