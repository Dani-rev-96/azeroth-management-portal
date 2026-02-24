import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Stub useAuthStore globally before importing the characters store
// since it's an auto-imported Nuxt composable
vi.stubGlobal('useAuthStore', () => ({
  user: { sub: 'test-user' },
}))

// We need to import after the global stub is set
const { useCharactersStore } = await import('../../../../app/stores/characters')

describe('Characters Store', () => {
  let store: ReturnType<typeof useCharactersStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked($fetch).mockReset()
    store = useCharactersStore()
  })

  afterEach(() => {
    store.$reset()
  })

  // ─── Initial State ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty characters', () => {
      expect(store.characters).toEqual([])
    })

    it('starts not loading', () => {
      expect(store.loading).toBe(false)
    })

    it('starts with empty error', () => {
      expect(store.error).toBe('')
    })

    it('starts with no lastFetch', () => {
      expect(store.lastFetch).toBeNull()
    })

    it('starts with empty onlinePlayers', () => {
      expect(store.onlinePlayers).toEqual([])
    })

    it('hasCharacters is false initially', () => {
      expect(store.hasCharacters).toBe(false)
    })
  })

  // ─── Character Computed Properties ──────────────────────────────────────────

  describe('sortedCharacters', () => {
    it('sorts online characters first, then by level descending', () => {
      store.characters = [
        { guid: 1, online: false, level: 80, name: 'OffHigh' },
        { guid: 2, online: true, level: 10, name: 'OnLow' },
        { guid: 3, online: false, level: 40, name: 'OffMid' },
        { guid: 4, online: true, level: 70, name: 'OnHigh' },
      ] as any

      const sorted = store.sortedCharacters
      expect(sorted.map(c => c.name)).toEqual(['OnHigh', 'OnLow', 'OffHigh', 'OffMid'])
    })
  })

  describe('onlineCharacters / offlineCharacters', () => {
    it('filters by online status', () => {
      store.characters = [
        { guid: 1, online: true, name: 'On1' },
        { guid: 2, online: false, name: 'Off1' },
        { guid: 3, online: true, name: 'On2' },
      ] as any

      expect(store.onlineCharacters).toHaveLength(2)
      expect(store.offlineCharacters).toHaveLength(1)
    })
  })

  describe('charactersByRealm', () => {
    it('groups characters by realmId', () => {
      store.characters = [
        { guid: 1, realmId: 'realm1', name: 'A' },
        { guid: 2, realmId: 'realm2', name: 'B' },
        { guid: 3, realmId: 'realm1', name: 'C' },
      ] as any

      const grouped = store.charactersByRealm
      expect(Object.keys(grouped)).toEqual(['realm1', 'realm2'])
      expect(grouped['realm1']).toHaveLength(2)
      expect(grouped['realm2']).toHaveLength(1)
    })

    it('returns empty object when no characters', () => {
      expect(store.charactersByRealm).toEqual({})
    })
  })

  describe('hasCharacters', () => {
    it('returns true when characters exist', () => {
      store.characters = [{ guid: 1 }] as any
      expect(store.hasCharacters).toBe(true)
    })
  })

  // ─── Online Status ──────────────────────────────────────────────────────────

  describe('onlineGuids', () => {
    it('builds set of realmId:guid keys from onlinePlayers', () => {
      store.onlinePlayers = [
        { guid: 1, realmId: 'r1' },
        { guid: 2, realmId: 'r2' },
      ] as any

      expect(store.onlineGuids.has('r1:1')).toBe(true)
      expect(store.onlineGuids.has('r2:2')).toBe(true)
      expect(store.onlineGuids.has('r1:99')).toBe(false)
    })
  })

  describe('onlineCount', () => {
    it('returns count of online players', () => {
      store.onlinePlayers = [{ guid: 1 }, { guid: 2 }, { guid: 3 }] as any
      expect(store.onlineCount).toBe(3)
    })
  })

  // ─── getCharacter ───────────────────────────────────────────────────────────

  describe('getCharacter', () => {
    it('finds character by guid and realmId', () => {
      store.characters = [
        { guid: 1, realmId: 'r1', name: 'First' },
        { guid: 2, realmId: 'r1', name: 'Second' },
        { guid: 1, realmId: 'r2', name: 'Third' },
      ] as any

      expect(store.getCharacter(2, 'r1')?.name).toBe('Second')
      expect(store.getCharacter(1, 'r2')?.name).toBe('Third')
    })

    it('returns undefined when not found', () => {
      expect(store.getCharacter(999, 'r1')).toBeUndefined()
    })
  })

  // ─── isOnline ───────────────────────────────────────────────────────────────

  describe('isOnline', () => {
    it('returns true if guid+realm is in online set', () => {
      store.onlinePlayers = [{ guid: 5, realmId: 'r1' }] as any
      expect(store.isOnline(5, 'r1')).toBe(true)
    })

    it('returns false if not online', () => {
      expect(store.isOnline(5, 'r1')).toBe(false)
    })
  })

  // ─── updateMoney ────────────────────────────────────────────────────────────

  describe('updateMoney', () => {
    it('updates character money', () => {
      store.characters = [
        { guid: 1, realmId: 'r1', money: 100 },
      ] as any

      store.updateMoney(1, 'r1', 5000)
      expect(store.characters[0]!.money).toBe(5000)
    })

    it('does nothing if character not found', () => {
      store.characters = [{ guid: 1, realmId: 'r1', money: 100 }] as any
      store.updateMoney(99, 'r1', 5000)
      expect(store.characters[0]!.money).toBe(100)
    })
  })

  // ─── fetchOnlinePlayers ─────────────────────────────────────────────────────

  describe('fetchOnlinePlayers', () => {
    it('fetches and stores online players', async () => {
      const mockPlayers = [
        { guid: 1, realmId: 'r1', characterName: 'P1' },
        { guid: 2, realmId: 'r1', characterName: 'P2' },
      ]
      vi.mocked($fetch).mockResolvedValueOnce({ players: mockPlayers })

      await store.fetchOnlinePlayers()

      expect(store.onlinePlayers).toEqual(mockPlayers)
      expect(store.onlinePlayersLoading).toBe(false)
    })

    it('handles empty response', async () => {
      vi.mocked($fetch).mockResolvedValueOnce({ players: [] })

      await store.fetchOnlinePlayers()

      expect(store.onlinePlayers).toEqual([])
    })

    it('sets error on failure', async () => {
      vi.mocked($fetch).mockRejectedValueOnce(new Error('fail'))

      await store.fetchOnlinePlayers()

      expect(store.onlinePlayersError).toBe('Failed to fetch online players')
    })

    it('updates characters online status after fetch', async () => {
      store.characters = [
        { guid: 1, realmId: 'r1', online: false, name: 'A' },
        { guid: 2, realmId: 'r1', online: false, name: 'B' },
      ] as any

      vi.mocked($fetch).mockResolvedValueOnce({
        players: [{ guid: 1, realmId: 'r1' }],
      })

      await store.fetchOnlinePlayers()

      expect(store.characters[0]!.online).toBe(true)
      expect(store.characters[1]!.online).toBe(false)
    })
  })

  // ─── Polling ────────────────────────────────────────────────────────────────

  describe('startOnlinePolling / stopOnlinePolling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('starts polling and enables flag', () => {
      store.startOnlinePolling(5000)
      expect(store.onlinePollingEnabled).toBe(true)
    })

    it('stops polling and disables flag', () => {
      store.startOnlinePolling(5000)
      store.stopOnlinePolling()
      expect(store.onlinePollingEnabled).toBe(false)
    })

    it('does not start double polling', () => {
      store.startOnlinePolling(5000)
      store.startOnlinePolling(5000) // second call should be a no-op
      expect(store.onlinePollingEnabled).toBe(true)
    })
  })

  // ─── $reset ─────────────────────────────────────────────────────────────────

  describe('$reset', () => {
    it('resets all state', () => {
      store.characters = [{ guid: 1 }] as any
      store.onlinePlayers = [{ guid: 1 }] as any
      store.loading = true
      store.error = 'err'

      store.$reset()

      expect(store.characters).toEqual([])
      expect(store.onlinePlayers).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBe('')
      expect(store.lastFetch).toBeNull()
    })
  })
})
