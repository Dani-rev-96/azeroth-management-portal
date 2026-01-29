/**
 * Composable for fetching and caching auth configuration
 *
 * This provides the frontend with information about:
 * - Current auth mode (direct, oauth-proxy, header, mock)
 * - Whether account linking is enabled (only for external auth)
 * - Whether account creation is available (and where)
 */

export interface AuthConfig {
  authMode: string
  isDirectAuth: boolean
  accountLinkingEnabled: boolean
  accountCreationEnabled: boolean
  emailRequiredForCreation: boolean
  description: string
}

const defaultConfig: AuthConfig = {
  authMode: 'mock',
  isDirectAuth: false,
  accountLinkingEnabled: true,
  accountCreationEnabled: true,
  emailRequiredForCreation: false,
  description: 'Loading...',
}

export function useAuthConfig() {
  const config = useState<AuthConfig>('authConfig', () => defaultConfig)
  const loading = useState<boolean>('authConfigLoading', () => true)
  const error = useState<string | null>('authConfigError', () => null)

  const fetchConfig = async () => {
    // Don't refetch if already loaded
    if (!loading.value && config.value.description !== 'Loading...') {
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await $fetch<AuthConfig>('/api/auth/config')
      config.value = response
    } catch (err) {
      console.error('Failed to fetch auth config:', err)
      error.value = 'Failed to load auth configuration'
      // Keep default config on error
    } finally {
      loading.value = false
    }
  }

  return {
    config: readonly(config),
    loading: readonly(loading),
    error: readonly(error),
    fetchConfig,
  }
}
