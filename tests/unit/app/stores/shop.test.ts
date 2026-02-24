import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Stub useAuthStore for characters store dependency
vi.stubGlobal('useAuthStore', () => ({
  user: { sub: 'test-user' },
}))

const { useShopStore } = await import('../../../../app/stores/shop')
const { useCharactersStore } = await import('../../../../app/stores/characters')

describe('Shop Store', () => {
  let store: ReturnType<typeof useShopStore>
  let charStore: ReturnType<typeof useCharactersStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked($fetch).mockReset()
    charStore = useCharactersStore()
    store = useShopStore()
  })

  // ─── Initial State ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with null config', () => {
      expect(store.config).toBeNull()
    })

    it('starts with configLoaded false', () => {
      expect(store.configLoaded).toBe(false)
    })

    it('starts with no selected character', () => {
      expect(store.selectedCharacter).toBeNull()
    })

    it('starts with mail delivery preference', () => {
      expect(store.preferredDeliveryMethod).toBe('mail')
    })
  })

  // ─── selectedCharacter ──────────────────────────────────────────────────────

  describe('selectedCharacter', () => {
    it('returns null when no key set', () => {
      expect(store.selectedCharacter).toBeNull()
    })

    it('returns character from characters store by key', () => {
      charStore.characters = [
        { guid: 42, realmId: 'r1', name: 'TestChar', level: 80, online: true },
      ] as any

      store.selectCharacter({ guid: 42, realmId: 'r1' } as any)

      expect(store.selectedCharacter).toBeTruthy()
      expect(store.selectedCharacter!.name).toBe('TestChar')
    })

    it('returns null when character not found', () => {
      store.selectCharacter({ guid: 99, realmId: 'r1' } as any)
      expect(store.selectedCharacter).toBeNull()
    })
  })

  // ─── clearSelectedCharacter ─────────────────────────────────────────────────

  describe('clearSelectedCharacter', () => {
    it('clears selection', () => {
      store.selectCharacter({ guid: 1, realmId: 'r1' } as any)
      store.clearSelectedCharacter()
      expect(store.selectedCharacter).toBeNull()
    })
  })

  // ─── Delivery Method Computed ───────────────────────────────────────────────

  describe('delivery method computed properties', () => {
    it('canUseBagDelivery is false when config is null', () => {
      expect(store.canUseBagDelivery).toBe(false)
    })

    it('canUseBagDelivery is true when delivery is "bag"', () => {
      store.config = { deliveryMethod: 'bag', priceMarkupPercent: 0, categories: [] } as any
      expect(store.canUseBagDelivery).toBe(true)
    })

    it('canUseBagDelivery is true when delivery is "both"', () => {
      store.config = { deliveryMethod: 'both', priceMarkupPercent: 0, categories: [] } as any
      expect(store.canUseBagDelivery).toBe(true)
    })

    it('canUseBagDelivery is false when delivery is "mail"', () => {
      store.config = { deliveryMethod: 'mail', priceMarkupPercent: 0, categories: [] } as any
      expect(store.canUseBagDelivery).toBe(false)
    })

    it('canChooseDeliveryMethod is true only for "both"', () => {
      store.config = { deliveryMethod: 'both', priceMarkupPercent: 0, categories: [] } as any
      expect(store.canChooseDeliveryMethod).toBe(true)

      store.config = { deliveryMethod: 'bag', priceMarkupPercent: 0, categories: [] } as any
      expect(store.canChooseDeliveryMethod).toBe(false)
    })

    it('effectiveDeliveryMethod returns undefined when no config', () => {
      expect(store.effectiveDeliveryMethod).toBeUndefined()
    })

    it('effectiveDeliveryMethod returns preferred when "both"', () => {
      store.config = { deliveryMethod: 'both', priceMarkupPercent: 0, categories: [] } as any
      store.setDeliveryMethod('bag')
      expect(store.effectiveDeliveryMethod).toBe('bag')
    })

    it('effectiveDeliveryMethod returns "bag" when delivery is "bag"', () => {
      store.config = { deliveryMethod: 'bag', priceMarkupPercent: 0, categories: [] } as any
      expect(store.effectiveDeliveryMethod).toBe('bag')
    })

    it('effectiveDeliveryMethod returns undefined when delivery is "mail" only', () => {
      store.config = { deliveryMethod: 'mail', priceMarkupPercent: 0, categories: [] } as any
      expect(store.effectiveDeliveryMethod).toBeUndefined()
    })
  })

  // ─── isSelectedCharacterOnline ──────────────────────────────────────────────

  describe('isSelectedCharacterOnline', () => {
    it('returns true when selected character is online', () => {
      charStore.characters = [
        { guid: 1, realmId: 'r1', name: 'OnChar', online: true },
      ] as any
      store.selectCharacter({ guid: 1, realmId: 'r1' } as any)

      expect(store.isSelectedCharacterOnline).toBe(true)
    })

    it('returns false when selected character is offline', () => {
      charStore.characters = [
        { guid: 1, realmId: 'r1', name: 'OffChar', online: false },
      ] as any
      store.selectCharacter({ guid: 1, realmId: 'r1' } as any)

      expect(store.isSelectedCharacterOnline).toBe(false)
    })

    it('returns false when no character selected', () => {
      expect(store.isSelectedCharacterOnline).toBe(false)
    })
  })

  // ─── Utility Functions ──────────────────────────────────────────────────────

  describe('utility functions', () => {
    it('getIconUrl formats icon name correctly', () => {
      const url = store.getIconUrl('INV_Shield_04.blp')
      expect(url).toBe('https://wow.zamimg.com/images/wow/icons/large/inv_shield_04.jpg')
    })

    it('getIconUrl handles names without .blp extension', () => {
      const url = store.getIconUrl('spell_holy_heal')
      expect(url).toBe('https://wow.zamimg.com/images/wow/icons/large/spell_holy_heal.jpg')
    })

    it('getClassIcon returns an icon path', () => {
      const icon = store.getClassIcon(1) // Warrior
      expect(icon).toBeTruthy()
      expect(typeof icon).toBe('string')
    })

    it('formatMoney returns a formatted string', () => {
      const money = store.formatMoney(12345678)
      expect(money).toBeTruthy()
      expect(typeof money).toBe('string')
    })
  })

  // ─── loadConfig ─────────────────────────────────────────────────────────────

  describe('loadConfig', () => {
    it('fetches and sets config', async () => {
      const mockConfig = {
        priceMarkupPercent: 10,
        categories: [{ id: 1, name: 'Weapons' }],
        deliveryMethod: 'both',
      }
      vi.mocked($fetch).mockResolvedValueOnce(mockConfig)

      await store.loadConfig()

      expect(store.config).toEqual(mockConfig)
      expect(store.configLoaded).toBe(true)
    })

    it('does not refetch if already loaded', async () => {
      store.configLoaded = true
      await store.loadConfig()
      expect(vi.mocked($fetch)).not.toHaveBeenCalled()
    })
  })

  // ─── setDeliveryMethod ──────────────────────────────────────────────────────

  describe('setDeliveryMethod', () => {
    it('sets preferred delivery method', () => {
      store.setDeliveryMethod('bag')
      expect(store.preferredDeliveryMethod).toBe('bag')
    })
  })

  // ─── updateCharacterMoney ───────────────────────────────────────────────────

  describe('updateCharacterMoney', () => {
    it('delegates to characters store', () => {
      charStore.characters = [{ guid: 1, realmId: 'r1', money: 100 }] as any

      store.updateCharacterMoney(1, 'r1', 9999)

      expect(charStore.characters[0]!.money).toBe(9999)
    })
  })

  // ─── $reset ─────────────────────────────────────────────────────────────────

  describe('$reset', () => {
    it('resets shop state', () => {
      store.config = { deliveryMethod: 'both' } as any
      store.configLoaded = true
      store.selectCharacter({ guid: 1, realmId: 'r1' } as any)
      store.setDeliveryMethod('bag')

      store.$reset()

      expect(store.config).toBeNull()
      expect(store.configLoaded).toBe(false)
      expect(store.selectedCharacter).toBeNull()
      expect(store.preferredDeliveryMethod).toBe('mail')
    })
  })
})
