/**
 * POST /api/auth/logout
 * Clears authentication
 */
export default defineEventHandler(async (event) => {
  // In production with oauth-proxy, logout might need to redirect to keycloak
  // For now, just return success - the frontend will clear local state

  setHeader(event, 'Cache-Control', 'no-cache')

  return {
    success: true,
    message: 'Logged out successfully',
  }
})
