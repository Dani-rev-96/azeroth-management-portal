/**
 * GET /api/auth/config
 * Returns authentication configuration for the frontend
 *
 * This allows the frontend to adapt its UI based on the auth mode:
 * - Show/hide login form (direct mode only)
 * - Show/hide account linking (external auth modes only)
 * - Show/hide account creation form (direct mode requires email)
 */
import { isDirectAuthMode, isAccountLinkingEnabled } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const authMode = config.public.authMode

  return {
    // Current auth mode
    authMode,

    // Whether the app uses direct WoW account login
    isDirectAuth: isDirectAuthMode(),

    // Whether account linking is available
    accountLinkingEnabled: isAccountLinkingEnabled(),

    // Whether users can create new accounts (only in direct mode)
    accountCreationEnabled: isDirectAuthMode(),

    // Whether email is required for account creation (yes in direct mode)
    emailRequiredForCreation: isDirectAuthMode(),

    // Description of the current auth mode
    description: getAuthModeDescription(authMode),
  }
})

function getAuthModeDescription(authMode: string): string {
  switch (authMode) {
    case 'mock':
      return 'Development mode with mocked authentication'
    case 'oauth-proxy':
      return 'External authentication via OAuth2-Proxy'
    case 'header':
      return 'External authentication via HTTP headers (nginx basic auth, etc.)'
    case 'direct':
      return 'Direct login with WoW account credentials'
    default:
      return 'Unknown authentication mode'
  }
}
