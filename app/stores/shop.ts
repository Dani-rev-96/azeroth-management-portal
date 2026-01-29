import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ShopCategory, ShopDeliveryMethod, RealmId } from '~/types'
import { useCharactersStore, type Character } from '~/stores/characters'
import { getClassIcon as getClassIconUtil, formatMoney as formatMoneyUtil } from '~/utils/wow'

// Shop configuration from server
export interface ShopConfig {
  priceMarkupPercent: number
  categories: ShopCategory[]
  deliveryMethod: ShopDeliveryMethod
}

/**
 * Shop Store
 *
 * Manages shop-specific state like configuration and selected character.
 * Uses the characters store for character data.
 */
export const useShopStore = defineStore('shop', () => {
  const charactersStore = useCharactersStore()

  // State
  const config = ref<ShopConfig | null>(null)
  const configLoaded = ref(false)
  const selectedCharacterKey = ref<string | null>(null) // "realmId:guid"
  const preferredDeliveryMethod = ref<'mail' | 'bag'>('mail')

  // Getters
  const selectedCharacter = computed((): Character | null => {
    if (!selectedCharacterKey.value) return null
    const [realmId, guidStr] = selectedCharacterKey.value.split(':')
    if (!realmId || !guidStr) return null
    const guid = parseInt(guidStr, 10)
    return charactersStore.getCharacter(guid, realmId as RealmId) || null
  })

  const canUseBagDelivery = computed(() => {
    return config.value?.deliveryMethod === 'bag' || config.value?.deliveryMethod === 'both'
  })

  const canChooseDeliveryMethod = computed(() => {
    return config.value?.deliveryMethod === 'both'
  })

  const effectiveDeliveryMethod = computed<'mail' | 'bag' | undefined>(() => {
    if (!config.value) return undefined

    if (config.value.deliveryMethod === 'both') {
      return preferredDeliveryMethod.value
    } else if (config.value.deliveryMethod === 'bag') {
      return 'bag'
    }
    return undefined
  })

  const isSelectedCharacterOnline = computed(() => {
    return selectedCharacter.value?.online === true
  })

  // Expose characters from the characters store for convenience
  const characters = computed(() => charactersStore.sortedCharacters)
  const charactersLoading = computed(() => charactersStore.loading)
  const charactersError = computed(() => charactersStore.error)

  // Actions
  async function loadConfig() {
    if (configLoaded.value) return

    try {
      const data = await $fetch<ShopConfig>('/api/shop/config')
      config.value = data
      configLoaded.value = true
    } catch (err) {
      console.error('Failed to load shop config:', err)
    }
  }

  async function loadCharacters() {
    await charactersStore.loadCharacters()
    // Start polling for online status when in shop
    charactersStore.startOnlinePolling(30000)
  }

  function selectCharacter(character: Character) {
    selectedCharacterKey.value = `${character.realmId}:${character.guid}`
  }

  function clearSelectedCharacter() {
    selectedCharacterKey.value = null
  }

  function setDeliveryMethod(method: 'mail' | 'bag') {
    preferredDeliveryMethod.value = method
  }

  function updateCharacterMoney(guid: number, realmId: RealmId, newBalance: number) {
    charactersStore.updateMoney(guid, realmId, newBalance)
  }

  // Utility functions - use module-level exports from characters store
  function getClassIcon(classId: number): string {
    return getClassIconUtil(classId)
  }

  function formatMoney(copper: number): string {
    return formatMoneyUtil(copper)
  }

  function getIconUrl(iconName: string): string {
    const cleanName = iconName.replace('.blp', '').toLowerCase()
    return `https://wow.zamimg.com/images/wow/icons/large/${cleanName}.jpg`
  }

  function $reset() {
    config.value = null
    configLoaded.value = false
    selectedCharacterKey.value = null
    preferredDeliveryMethod.value = 'mail'
  }

  return {
    // State
    config,
    configLoaded,
    selectedCharacter,
    preferredDeliveryMethod,

    // Getters
    canUseBagDelivery,
    canChooseDeliveryMethod,
    effectiveDeliveryMethod,
    isSelectedCharacterOnline,
    characters,
    charactersLoading,
    charactersError,

    // Convenience alias for backwards compatibility
    sortedCharacters: characters,

    // Actions
    loadConfig,
    loadCharacters,
    selectCharacter,
    clearSelectedCharacter,
    setDeliveryMethod,
    updateCharacterMoney,
    getClassIcon,
    formatMoney,
    getIconUrl,

    $reset,
  }
})
