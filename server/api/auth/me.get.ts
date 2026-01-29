/**
 * GET /api/auth/me
 * Returns current authenticated user with GM status
 *
 * In production: reads from external auth headers (X-Auth-Request-User, etc)
 * In local dev: returns mocked user from config
 * In direct mode: reads from session (WoW account login)
 */
import { getDirectAuthSession, isDirectAuthMode, getAuthenticatedUser } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const authMode = config.public.authMode

  try {
    // For direct auth mode, use session directly
    if (isDirectAuthMode()) {
      const session = await getDirectAuthSession(event)
      if (!session) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Not authenticated',
        })
      }

      return {
        // Use account ID as the unique identifier
        sub: String(session.accountId),
        preferred_username: session.username,
        email: session.email || '',
        email_verified: !!session.email,
        isGM: session.gmLevel > 0,
        gmLevel: session.gmLevel,
        // Direct auth flag - useful for frontend to know account linking is disabled
        isDirect: true,
        // WoW account ID for direct access to characters/shop
        wowAccountId: session.accountId,
      }
    }

    // For external auth modes, read from headers using getAuthenticatedUser
    const { id, username, email } = await getAuthenticatedUser(event)

    // Check GM status for this user
    const { getUserGMLevel } = await import('#server/services/gm')
    let gmLevel
    if (authMode === "mock") {
      gmLevel = config.public.mockGMLevel || 3
    } else {
      gmLevel = await getUserGMLevel(username)
    }

    return {
      // Use ID as the unique identifier (from OIDC sub claim or fallback to username)
      sub: id,
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
