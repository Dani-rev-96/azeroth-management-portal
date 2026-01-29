/**
 * POST /api/auth/logout
 * Clears authentication
 *
 * For direct auth mode: destroys the session
 * For oauth-proxy/header modes: just returns success (frontend handles redirect)
 */
import { destroyDirectAuthSession, isDirectAuthMode } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-cache')

  // For direct auth mode, destroy the session
  if (isDirectAuthMode()) {
    destroyDirectAuthSession(event)
  }

  return {
    success: true,
    message: 'Logged out successfully',
  }
})
