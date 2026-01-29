import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<AuthUser | null>(null)
  const token = ref<string | undefined>(undefined)

  // Getters
  const isAuthenticated = computed(() => !!user.value)
  const isLoggedIn = computed(() => isAuthenticated.value)
  const currentUser = computed(() => user.value)
  const userId = computed(() => user.value?.sub)
  const username = computed(() => user.value?.preferred_username)

  // Actions
  function setUser(nextUser: AuthUser, nextToken?: string) {
    user.value = nextUser
    if (nextToken) token.value = nextToken
  }

  function clearAuth() {
    user.value = null
    token.value = undefined
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
    // Extend here if you later need header parsing or prechecks
    return fetchCurrentUser()
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
    // getters
    isAuthenticated,
    isLoggedIn,
    currentUser,
    userId,
    username,
    // actions
    setUser,
    clearAuth,
    initializeFromHeaders,
    fetchCurrentUser,
    initializeAuth,
    logout,
  }
})
