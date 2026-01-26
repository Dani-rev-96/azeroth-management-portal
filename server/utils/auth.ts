import type { H3Event } from 'h3'

/**
 * Get authenticated user information from request headers or mock data
 * Handles both OAuth proxy headers and local mock authentication
 *
 * @param event - The H3 event object
 * @returns Object containing username and email
 * @throws 401 error if not authenticated
 * @throws 500 error if unknown auth mode
 */
export async function getAuthenticatedUser(event: H3Event): Promise<{ username: string; email: string }> {
  const config = useRuntimeConfig()
  const authMode = config.public.authMode

  let username: string
  let email: string

  // Production/Staging: read from oauth-proxy headers
  if (authMode === 'oauth-proxy' || authMode === 'keycloak') {
    username =
      getHeader(event, 'x-auth-request-preferred-username') ||
      getHeader(event, 'x-forwarded-preferred-username') ||
      getHeader(event, 'x-auth-request-user') ||
      getHeader(event, 'x-forwarded-user') ||
      ''

    email =
      getHeader(event, 'x-auth-request-email') ||
      getHeader(event, 'x-forwarded-email') ||
      ''

    // Debug: log all auth headers in development
    if (config.public.debugMode) {
      console.log('Auth headers:', {
        'x-auth-request-user': getHeader(event, 'x-auth-request-user'),
        'x-auth-request-email': getHeader(event, 'x-auth-request-email'),
        'x-auth-request-preferred-username': getHeader(event, 'x-auth-request-preferred-username'),
        'x-forwarded-user': getHeader(event, 'x-forwarded-user'),
        'x-forwarded-email': getHeader(event, 'x-forwarded-email'),
      })
    }

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

  return { username, email }
}

/**
 * Get authenticated user and verify they have GM privileges
 *
 * @param event - The H3 event object
 * @returns Object containing username, email, and gmLevel
 * @throws 401 error if not authenticated
 * @throws 403 error if not a GM
 */
export async function getAuthenticatedGM(event: H3Event): Promise<{ username: string; email: string; gmLevel: number }> {
  const config = useRuntimeConfig()
  const authMode = config.public.authMode
  const { username, email } = await getAuthenticatedUser(event)

  // Check GM level
  const { getUserGMLevel } = await import('#server/services/gm')
  let gmLevel
	if (authMode === 'mock') {
    gmLevel = config.public.mockGMLevel || 0
  } else {
    gmLevel = await getUserGMLevel(username)
  }

  if (gmLevel === 0) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied - GM privileges required',
    })
  }

  return { username, email, gmLevel }
}
