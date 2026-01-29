import type { H3Event } from 'h3'

/**
 * Authenticated user information returned from auth utilities
 */
export interface AuthenticatedUserInfo {
  /** Unique user identifier (from OIDC sub claim, or username as fallback) */
  id: string
  /** Display username */
  username: string
  /** User email (may be empty) */
  email: string
}

/**
 * Get authenticated user information from request headers, session, or mock data
 * Supports multiple authentication modes:
 * - 'mock': Local development with mocked user
 * - 'oauth-proxy': OAuth2-Proxy with X-Auth-Request-* headers
 * - 'header': Generic header-based auth (nginx basic auth, etc.)
 * - 'direct': Direct WoW account login with session/JWT
 *
 * @param event - The H3 event object
 * @returns Object containing id, username and email
 * @throws 401 error if not authenticated
 * @throws 500 error if unknown auth mode
 */
export async function getAuthenticatedUser(event: H3Event): Promise<AuthenticatedUserInfo> {
  const config = useRuntimeConfig()
  const authMode = config.public.authMode

  let id: string
  let username: string
  let email: string

  // Production: read from external auth headers (OAuth-Proxy, nginx, etc.)
  if (authMode === 'oauth-proxy' || authMode === 'header') {
    // User ID - unique identifier (OIDC sub claim)
    // x-auth-request-user contains the ID from OAuth2-Proxy
    id =
      getHeader(event, 'x-auth-request-user') ||
      getHeader(event, 'x-forwarded-user') ||
      ''

    // Username - for display purposes
    username =
      getHeader(event, 'x-auth-request-preferred-username') ||
      getHeader(event, 'x-forwarded-preferred-username') ||
      // Support for nginx basic auth (sets username as x-remote-user)
      getHeader(event, 'x-remote-user') ||
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
        'x-remote-user': getHeader(event, 'x-remote-user'),
      })
    }

    // If no username found, check if we have an ID we can use
    if (!username && !id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Not authenticated',
      })
    }

    // Fallback: if no ID, use username as ID
    if (!id) {
      id = username
    }
    // Fallback: if no username, use ID as username
    if (!username) {
      username = id
    }
  }
  // Direct WoW account login: read from session cookie
  else if (authMode === 'direct') {
    const session = await getDirectAuthSession(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Not authenticated - please log in',
      })
    }
    // In direct mode, the WoW account ID is the unique identifier
    id = String(session.accountId)
    username = session.username
    email = session.email || ''
  }
  // Local development: return mocked user
  else if (authMode === 'mock') {
    id = String(config.public.mockUserId || config.public.mockUser || 'admin')
    username = config.public.mockUser || 'admin'
    email = config.public.mockEmail || 'admin@localhost'
  }
  else {
    throw createError({
      statusCode: 500,
      statusMessage: 'Unknown auth mode',
    })
  }

  return { id, username, email }
}

/**
 * Get authenticated user and verify they have GM privileges
 *
 * @param event - The H3 event object
 * @returns Object containing id, username, email, and gmLevel
 * @throws 401 error if not authenticated
 * @throws 403 error if not a GM
 */
export async function getAuthenticatedGM(event: H3Event): Promise<AuthenticatedUserInfo & { gmLevel: number }> {
  const config = useRuntimeConfig()
  const authMode = config.public.authMode
  const { id, username, email } = await getAuthenticatedUser(event)

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

  return { id, username, email, gmLevel }
}

/**
 * Session data for direct WoW account authentication
 */
export interface DirectAuthSession {
  username: string
  accountId: number
  email?: string
  gmLevel: number
  issuedAt: number
  expiresAt: number
}

// Simple in-memory session store (replace with Redis in production)
const sessions = new Map<string, DirectAuthSession>()

/**
 * Get direct auth session from cookie
 */
export async function getDirectAuthSession(event: H3Event): Promise<DirectAuthSession | null> {
  const sessionId = getCookie(event, 'wow_session')
  if (!sessionId) {
    return null
  }

  const session = sessions.get(sessionId)
  if (!session) {
    return null
  }

  // Check if session expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId)
    deleteCookie(event, 'wow_session')
    return null
  }

  return session
}

/**
 * Create a new direct auth session
 */
export function createDirectAuthSession(
  event: H3Event,
  accountId: number,
  username: string,
  email?: string,
  gmLevel: number = 0
): string {
  // Generate a secure session ID
  const sessionId = crypto.randomUUID()

  const session: DirectAuthSession = {
    username,
    accountId,
    email,
    gmLevel,
    issuedAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  }

  sessions.set(sessionId, session)

  // Set secure cookie
  setCookie(event, 'wow_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours in seconds
  })

  return sessionId
}

/**
 * Destroy a direct auth session
 */
export function destroyDirectAuthSession(event: H3Event): void {
  const sessionId = getCookie(event, 'wow_session')
  if (sessionId) {
    sessions.delete(sessionId)
    deleteCookie(event, 'wow_session')
  }
}

/**
 * Check if direct auth mode is enabled
 */
export function isDirectAuthMode(): boolean {
  const config = useRuntimeConfig()
  return config.public.authMode === 'direct'
}

/**
 * Check if account linking is available (only for external auth modes)
 */
export function isAccountLinkingEnabled(): boolean {
  const config = useRuntimeConfig()
  const authMode = config.public.authMode
  // Account linking only makes sense with external authentication
  return authMode === 'oauth-proxy' || authMode === 'header' || authMode === 'mock'
}
