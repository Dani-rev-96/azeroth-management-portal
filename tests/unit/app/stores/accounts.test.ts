import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAccountsStore } from '../../../../app/stores/accounts'

describe('Accounts Store', () => {
  let store: ReturnType<typeof useAccountsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked($fetch).mockReset()
    store = useAccountsStore()
  })

  // ─── Initial State ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty accounts', () => {
      expect(store.accounts).toEqual([])
    })

    it('starts with no current account', () => {
      expect(store.currentAccountId).toBeUndefined()
      expect(store.currentAccount).toBeUndefined()
    })

    it('starts not loading', () => {
      expect(store.loading).toBe(false)
    })

    it('starts with no error', () => {
      expect(store.error).toBeUndefined()
    })
  })

  // ─── Getters ────────────────────────────────────────────────────────────────

  describe('getters', () => {
    const mockAccounts = [
      { mapping: { wowAccountId: 1, externalId: 'ext1' }, wowAccount: { id: 1, username: 'acc1' } },
      { mapping: { wowAccountId: 2, externalId: 'ext1' }, wowAccount: { id: 2, username: 'acc2' } },
    ]

    it('allAccounts returns all accounts', () => {
      store.accounts = mockAccounts as any
      expect(store.allAccounts).toHaveLength(2)
    })

    it('hasAccounts returns true when accounts exist', () => {
      store.accounts = mockAccounts as any
      expect(store.hasAccounts).toBe(true)
    })

    it('hasAccounts returns false when empty', () => {
      expect(store.hasAccounts).toBe(false)
    })

    it('accountCount returns correct count', () => {
      store.accounts = mockAccounts as any
      expect(store.accountCount).toBe(2)
    })

    it('currentAccount returns matching account by wowAccountId', () => {
      store.accounts = mockAccounts as any
      store.selectAccount(2)
      expect(store.currentAccount).toEqual(mockAccounts[1])
    })

    it('currentAccount returns undefined when no account selected', () => {
      store.accounts = mockAccounts as any
      expect(store.currentAccount).toBeUndefined()
    })

    it('currentAccount returns undefined when selected id not found', () => {
      store.accounts = mockAccounts as any
      store.selectAccount(999)
      expect(store.currentAccount).toBeUndefined()
    })
  })

  // ─── selectAccount ──────────────────────────────────────────────────────────

  describe('selectAccount', () => {
    it('sets currentAccountId', () => {
      store.selectAccount(42)
      expect(store.currentAccountId).toBe(42)
    })
  })

  // ─── clearError ─────────────────────────────────────────────────────────────

  describe('clearError', () => {
    it('clears the error', () => {
      store.error = 'some error'
      store.clearError()
      expect(store.error).toBeUndefined()
    })
  })

  // ─── $reset ─────────────────────────────────────────────────────────────────

  describe('$reset', () => {
    it('resets all state', () => {
      store.accounts = [{ mapping: { wowAccountId: 1, externalId: 'x' } }] as any
      store.currentAccountId = 1
      store.loading = true
      store.error = 'err'

      store.$reset()

      expect(store.accounts).toEqual([])
      expect(store.currentAccountId).toBeUndefined()
      expect(store.loading).toBe(false)
      expect(store.error).toBeUndefined()
    })
  })

  // ─── loadAccounts ───────────────────────────────────────────────────────────

  describe('loadAccounts', () => {
    it('fetches and sets accounts', async () => {
      const mockData = [
        { mapping: { wowAccountId: 1 }, wowAccount: { id: 1, username: 'a1' } },
      ]
      vi.mocked($fetch).mockResolvedValueOnce(mockData)

      await store.loadAccounts('ext-id')

      expect(vi.mocked($fetch)).toHaveBeenCalledWith('/api/accounts/user/ext-id', { method: 'GET' })
      expect(store.accounts).toEqual(mockData)
      expect(store.loading).toBe(false)
    })

    it('sets error on failure', async () => {
      vi.mocked($fetch).mockRejectedValueOnce(new Error('Network error'))

      await store.loadAccounts('ext-id')

      expect(store.error).toBe('Network error')
      expect(store.loading).toBe(false)
    })

    it('sets generic error for non-Error rejection', async () => {
      vi.mocked($fetch).mockRejectedValueOnce('string error')

      await store.loadAccounts('ext-id')

      expect(store.error).toBe('Failed to load accounts')
    })
  })

  // ─── createAccountMapping ───────────────────────────────────────────────────

  describe('createAccountMapping', () => {
    it('creates mapping and adds to accounts', async () => {
      const newMapping = { mapping: { wowAccountId: 5, externalId: 'ext' }, wowAccount: { id: 5 } }
      vi.mocked($fetch).mockResolvedValueOnce(newMapping)

      const result = await store.createAccountMapping('ext', 'MyAccount', 'password123')

      expect(vi.mocked($fetch)).toHaveBeenCalledWith('/api/accounts/map', {
        method: 'POST',
        body: { externalId: 'ext', wowAccountName: 'MyAccount', wowAccountPassword: 'password123' },
      })
      expect(result).toEqual(newMapping)
      expect(store.accounts).toHaveLength(1)
    })

    it('sets error and throws on failure', async () => {
      vi.mocked($fetch).mockRejectedValueOnce(new Error('Account exists'))

      await expect(store.createAccountMapping('ext', 'Acc', 'pw')).rejects.toThrow('Account exists')
      expect(store.error).toBe('Account exists')
    })
  })

  // ─── removeAccountMapping ───────────────────────────────────────────────────

  describe('removeAccountMapping', () => {
    it('removes mapping from accounts', async () => {
      store.accounts = [
        { mapping: { wowAccountId: 1, externalId: 'ext' } },
        { mapping: { wowAccountId: 2, externalId: 'ext' } },
      ] as any
      vi.mocked($fetch).mockResolvedValueOnce(undefined)

      await store.removeAccountMapping({ externalId: 'ext', wowAccountId: 1 } as any)

      expect(store.accounts).toHaveLength(1)
      expect(store.accounts[0]!.mapping.wowAccountId).toBe(2)
    })

    it('calls correct delete endpoint', async () => {
      store.accounts = [{ mapping: { wowAccountId: 1, externalId: 'ext' } }] as any
      vi.mocked($fetch).mockResolvedValueOnce(undefined)

      await store.removeAccountMapping({ externalId: 'ext', wowAccountId: 1 } as any)

      expect(vi.mocked($fetch)).toHaveBeenCalledWith('/api/accounts/map/ext/1', { method: 'DELETE' })
    })

    it('sets error and throws on failure', async () => {
      store.accounts = [{ mapping: { wowAccountId: 1, externalId: 'ext' } }] as any
      vi.mocked($fetch).mockRejectedValueOnce(new Error('Not found'))

      await expect(
        store.removeAccountMapping({ externalId: 'ext', wowAccountId: 1 } as any)
      ).rejects.toThrow('Not found')
      expect(store.error).toBe('Not found')
    })
  })
})
