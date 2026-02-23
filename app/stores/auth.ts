import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<AuthUser | null>(null)
  const token = ref<string | undefined>(undefined)
  const featureGrants = ref<Set<string>>(new Set())

  // Getters
  const isAuthenticated = computed(() => !!user.value)
  const isLoggedIn = computed(() => isAuthenticated.value)
  const currentUser = computed(() => user.value)
  const userId = computed(() => user.value?.sub)
  const username = computed(() => user.value?.preferred_username)
  const hasAdminAccess = computed(() => !!(user.value?.isGM) || featureGrants.value.size > 0)

  // Actions
  function setUser(nextUser: AuthUser, nextToken?: string) {
    user.value = nextUser
    if (nextToken) token.value = nextToken
  }

  function clearAuth() {
    user.value = null
    token.value = undefined
    featureGrants.value = new Set()
  }

  function initializeFromHeaders(headers: Record<string, string>) {
    try {
      const usernameHeader = headers['x-remote-user']
      const emailHeader = headers['x-auth-request-email']

      if (usernameHeader) {
        user.value = {
          sub: usernameHeader,
          preferred_username: usernameHeader,
          email: emailHeader || '',
          email_verified: true,
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth from headers:', error)
    }
  }

  async function fetchCurrentUser(): Promise<boolean> {
    try {
      const fetched = await $fetch<AuthUser>('/api/auth/me')
      if (fetched) {
        setUser(fetched)
        return true
      }
      return false
    } catch {
      clearAuth()
      return false
    }
  }

  async function initializeAuth(): Promise<boolean> {
    const success = await fetchCurrentUser()
    if (success && !user.value?.isGM) {
      await fetchFeatureGrants()
    }
    return success
  }

  /**
   * Fetch active feature grants for the current user.
   * Called after auth init for non-GM users.
   */
  async function fetchFeatureGrants(): Promise<void> {
    try {
      const data = await $fetch<{ features: Array<{ id: string }>; hasAny: boolean }>('/api/admin/my-features')
      featureGrants.value = new Set((data.features || []).map(f => f.id))
    } catch {
      featureGrants.value = new Set()
    }
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuth()
    }
  }

  return {
    // state
    user,
    token,
    featureGrants,
    // getters
    isAuthenticated,
    isLoggedIn,
    currentUser,
    userId,
    username,
    hasAdminAccess,
    // actions
    setUser,
    clearAuth,
    initializeFromHeaders,
    fetchCurrentUser,
    fetchFeatureGrants,
    initializeAuth,
    logout,
  }
})
