import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../../../app/stores/auth'

describe('Auth Store', () => {
  let store: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked($fetch).mockReset()
    store = useAuthStore()
  })

  // ─── Initial State ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with null user', () => {
      expect(store.user).toBeNull()
    })

    it('starts with undefined token', () => {
      expect(store.token).toBeUndefined()
    })

    it('starts with empty feature grants', () => {
      expect(store.featureGrants.size).toBe(0)
    })

    it('is not authenticated initially', () => {
      expect(store.isAuthenticated).toBe(false)
      expect(store.isLoggedIn).toBe(false)
    })

    it('has no admin access initially', () => {
      expect(store.hasAdminAccess).toBe(false)
    })
  })

  // ─── Getters ────────────────────────────────────────────────────────────────

  describe('getters', () => {
    const mockUser = {
      sub: 'user-123',
      preferred_username: 'testuser',
      email: 'test@example.com',
      email_verified: true,
    }

    it('isAuthenticated returns true when user is set', () => {
      store.setUser(mockUser)
      expect(store.isAuthenticated).toBe(true)
      expect(store.isLoggedIn).toBe(true)
    })

    it('currentUser returns the user object', () => {
      store.setUser(mockUser)
      expect(store.currentUser).toEqual(mockUser)
    })

    it('userId returns the sub field', () => {
      store.setUser(mockUser)
      expect(store.userId).toBe('user-123')
    })

    it('username returns preferred_username', () => {
      store.setUser(mockUser)
      expect(store.username).toBe('testuser')
    })

    it('hasAdminAccess is true when user isGM', () => {
      store.setUser({ ...mockUser, isGM: true })
      expect(store.hasAdminAccess).toBe(true)
    })

    it('hasAdminAccess is true when feature grants exist', () => {
      store.setUser(mockUser)
      store.featureGrants = new Set(['admin.accounts'])
      expect(store.hasAdminAccess).toBe(true)
    })

    it('hasAdminAccess is false when not GM and no grants', () => {
      store.setUser(mockUser)
      expect(store.hasAdminAccess).toBe(false)
    })
  })

  // ─── setUser ────────────────────────────────────────────────────────────────

  describe('setUser', () => {
    it('sets user and token', () => {
      const user = { sub: 'u1', preferred_username: 'u1', email: '', email_verified: false }
      store.setUser(user, 'tok-abc')
      expect(store.user).toEqual(user)
      expect(store.token).toBe('tok-abc')
    })

    it('sets user without token', () => {
      const user = { sub: 'u1', preferred_username: 'u1', email: '', email_verified: false }
      store.setUser(user)
      expect(store.user).toEqual(user)
      expect(store.token).toBeUndefined()
    })
  })

  // ─── clearAuth ──────────────────────────────────────────────────────────────

  describe('clearAuth', () => {
    it('clears user, token, and feature grants', () => {
      store.setUser(
        { sub: 'u1', preferred_username: 'u1', email: '', email_verified: false },
        'token'
      )
      store.featureGrants = new Set(['admin.accounts'])

      store.clearAuth()

      expect(store.user).toBeNull()
      expect(store.token).toBeUndefined()
      expect(store.featureGrants.size).toBe(0)
    })
  })

  // ─── initializeFromHeaders ──────────────────────────────────────────────────

  describe('initializeFromHeaders', () => {
    it('sets user from x-remote-user header', () => {
      store.initializeFromHeaders({
        'x-remote-user': 'headeruser',
        'x-auth-request-email': 'header@example.com',
      })
      expect(store.user).toEqual({
        sub: 'headeruser',
        preferred_username: 'headeruser',
        email: 'header@example.com',
        email_verified: true,
      })
    })

    it('sets empty email when header missing', () => {
      store.initializeFromHeaders({ 'x-remote-user': 'headeruser' })
      expect(store.user!.email).toBe('')
    })

    it('does nothing when x-remote-user missing', () => {
      store.initializeFromHeaders({ 'x-auth-request-email': 'e@e.com' })
      expect(store.user).toBeNull()
    })
  })

  // ─── fetchCurrentUser ───────────────────────────────────────────────────────

  describe('fetchCurrentUser', () => {
    it('sets user on successful fetch', async () => {
      const mockUser = { sub: 'u1', preferred_username: 'fetched', email: '', email_verified: true }
      vi.mocked($fetch).mockResolvedValueOnce(mockUser)

      const result = await store.fetchCurrentUser()

      expect(result).toBe(true)
      expect(store.user).toEqual(mockUser)
    })

    it('returns false and clears auth on fetch failure', async () => {
      store.setUser({ sub: 'u1', preferred_username: 'u1', email: '', email_verified: false })
      vi.mocked($fetch).mockRejectedValueOnce(new Error('Unauthorized'))

      const result = await store.fetchCurrentUser()

      expect(result).toBe(false)
      expect(store.user).toBeNull()
    })

    it('returns false when fetch returns falsy', async () => {
      vi.mocked($fetch).mockResolvedValueOnce(null)

      const result = await store.fetchCurrentUser()

      expect(result).toBe(false)
    })
  })

  // ─── fetchFeatureGrants ─────────────────────────────────────────────────────

  describe('fetchFeatureGrants', () => {
    it('populates feature grants from API', async () => {
      vi.mocked($fetch).mockResolvedValueOnce({
        features: [{ id: 'admin.accounts' }, { id: 'admin.backup' }],
        hasAny: true,
      })

      await store.fetchFeatureGrants()

      expect(store.featureGrants.has('admin.accounts')).toBe(true)
      expect(store.featureGrants.has('admin.backup')).toBe(true)
      expect(store.featureGrants.size).toBe(2)
    })

    it('clears grants on failure', async () => {
      store.featureGrants = new Set(['old'])
      vi.mocked($fetch).mockRejectedValueOnce(new Error('fail'))

      await store.fetchFeatureGrants()

      expect(store.featureGrants.size).toBe(0)
    })
  })

  // ─── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('calls logout endpoint and clears auth', async () => {
      store.setUser(
        { sub: 'u1', preferred_username: 'u1', email: '', email_verified: false },
        'tok'
      )
      vi.mocked($fetch).mockResolvedValueOnce(undefined)

      await store.logout()

      expect(vi.mocked($fetch)).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
      expect(store.user).toBeNull()
      expect(store.token).toBeUndefined()
    })

    it('clears auth even on logout API error', async () => {
      store.setUser({ sub: 'u1', preferred_username: 'u1', email: '', email_verified: false })
      vi.mocked($fetch).mockRejectedValueOnce(new Error('Network error'))

      await store.logout()

      expect(store.user).toBeNull()
    })
  })
})
