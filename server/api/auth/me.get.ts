/**
 * GET /api/auth/me
 * Returns current authenticated user from oauth-proxy headers
 */
export default defineEventHandler(async (event) => {
  try {
    // In production with oauth-proxy, headers are set automatically
    const username = getHeader(event, 'x-remote-user') || "daniel"
    const email = getHeader(event, 'x-auth-request-email') || "daniel@dani-home.de"

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
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication failed',
    })
  }
})
