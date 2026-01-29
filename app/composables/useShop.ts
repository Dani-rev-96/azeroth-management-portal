import { ref, computed, watch } from 'vue'
import type { ShopItem, ShopCategory, RealmId } from '~/types'

// Character type used in the shop
export interface ShopCharacter {
  guid: number
  name: string
  class: number
  race: number
  level: number
  money: number
  realmId: RealmId
  realmName: string
}

// Notification type
export interface ShopNotification {
  type: 'success' | 'error'
  message: string
}

// Class icons mapping
const CLASS_ICONS: Record<number, string> = {
  1: '⚔️', 2: '🛡️', 3: '🏹', 4: '🗡️',
  5: '✨', 6: '💀', 7: '⚡', 8: '❄️',
  9: '🔥', 11: '🐻',
}

// Shop composable - manages all shop state and logic
export function useShop() {
  const route = useRoute()
  const router = useRouter()

  // Get initial page from URL
  const getInitialPage = () => {
    const urlPage = parseInt(route.query.page as string)
    return urlPage && urlPage > 0 ? urlPage : 1
  }

  // State
  const selectedCharacter = ref<ShopCharacter | null>(null)
  const selectedCategory = ref<ShopCategory>('trade_goods')
  const searchQuery = ref('')
  const items = ref<ShopItem[]>([])
  const quantities = ref<Record<number, number>>({})
  const currentPage = ref(getInitialPage())
  const limit = ref(50)
  const total = ref(0)
  const totalPages = ref(0)
  const purchasing = ref<number | null>(null)
  const notification = ref<ShopNotification | null>(null)

  // Computed pagination object for compatibility
  const pagination = computed(() => ({
    page: currentPage.value,
    limit: limit.value,
    total: total.value,
    totalPages: totalPages.value,
  }))

  // Loading states
  const loadingCharacters = ref(true)
  const loadingItems = ref(false)
  const characterError = ref('')
  const itemsError = ref('')

  // Config
  const shopConfig = ref<{ priceMarkupPercent: number; categories: ShopCategory[] } | null>(null)

  // Characters from all linked accounts
  const allCharacters = ref<ShopCharacter[]>([])

  // Watch for URL changes and sync page
  watch(
    () => route.query.page,
    (newPage) => {
      const page = parseInt(newPage as string)
      if (page && page > 0 && page !== currentPage.value) {
        currentPage.value = page
        if (selectedCharacter.value) {
          loadItems()
        }
      } else if (!newPage && currentPage.value !== 1) {
        currentPage.value = 1
        if (selectedCharacter.value) {
          loadItems()
        }
      }
    }
  )

  // Update URL when page changes
  function updateUrlPage(page: number) {
    router.replace({
      query: {
        ...route.query,
        page: page === 1 ? undefined : String(page),
      },
    })
  }

  // Helpers
  function getClassIcon(classId: number): string {
    return CLASS_ICONS[classId] || '❓'
  }

  function formatMoney(copper: number): string {
    const gold = Math.floor(copper / 10000)
    const silver = Math.floor((copper % 10000) / 100)
    const copperRemainder = copper % 100

    const parts: string[] = []
    if (gold > 0) parts.push(`${gold}g`)
    if (silver > 0 || gold > 0) parts.push(`${silver}s`)
    parts.push(`${copperRemainder}c`)

    return parts.join(' ')
  }

  function getQuantity(item: ShopItem): number {
    return quantities.value[item.entry] || 1
  }

  function setQuantity(item: ShopItem, value: number): void {
    const clamped = Math.max(1, Math.min(value, item.maxStackSize * 10))
    quantities.value[item.entry] = clamped
  }

  function incrementQuantity(item: ShopItem): void {
    const current = getQuantity(item)
    quantities.value[item.entry] = Math.min(current + 1, item.maxStackSize * 10)
  }

  function decrementQuantity(item: ShopItem): void {
    const current = getQuantity(item)
    quantities.value[item.entry] = Math.max(1, current - 1)
  }

  function canAfford(item: ShopItem): boolean {
    if (!selectedCharacter.value) return false
    const total = item.shopPrice * getQuantity(item)
    return selectedCharacter.value.money >= total
  }

  function getIconUrl(iconName: string): string {
    const cleanName = iconName.replace('.blp', '').toLowerCase()
    return `https://wow.zamimg.com/images/wow/icons/large/${cleanName}.jpg`
  }

  function showNotification(type: 'success' | 'error', message: string) {
    notification.value = { type, message }
    setTimeout(() => {
      notification.value = null
    }, 5000)
  }

  // Data loading
  async function loadShopConfig() {
    try {
      const { data } = await useFetch('/api/shop/config')
      if (data.value) {
        shopConfig.value = data.value as any
      }
    } catch (err) {
      console.error('Failed to load shop config:', err)
    }
  }

  async function loadCharacters() {
    const authStore = useAuthStore()
    loadingCharacters.value = true
    characterError.value = ''
    allCharacters.value = []

    try {
      if (!authStore.user) {
        characterError.value = 'Please log in to use the shop'
        return
      }

      const { data, error } = await useFetch(`/api/accounts/user/${authStore.user.sub}`)

      if (error.value) {
        characterError.value = 'Failed to load your accounts'
        return
      }

      const accounts = data.value as any[]
      if (!accounts || accounts.length === 0) {
        characterError.value = 'No linked WoW accounts found. Link an account first.'
        return
      }

      // Collect all characters from all realms
      for (const account of accounts) {
        if (account.realms) {
          for (const realmData of account.realms) {
            const realm = realmData.realm
            for (const char of realmData.characters || []) {
              allCharacters.value.push({
                guid: char.guid,
                name: char.name,
                class: char.class,
                race: char.race,
                level: char.level,
                money: char.money || 0,
                realmId: realm.id,
                realmName: realm.name,
              })
            }
          }
        }
      }

      // Sort by level descending
      allCharacters.value.sort((a, b) => b.level - a.level)
    } catch (err) {
      console.error('Failed to load characters:', err)
      characterError.value = 'Failed to load characters'
    } finally {
      loadingCharacters.value = false
    }
  }

  async function loadItems() {
    if (!selectedCharacter.value) return

    loadingItems.value = true
    itemsError.value = ''

    try {
      const params = new URLSearchParams({
        category: selectedCategory.value,
        realmId: selectedCharacter.value.realmId,
        page: String(currentPage.value),
        limit: String(limit.value),
      })

      if (searchQuery.value) {
        params.set('search', searchQuery.value)
      }

      // Use $fetch instead of useFetch to avoid caching issues with pagination
      const response = await $fetch<{
        items: ShopItem[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>(`/api/shop/items?${params}`)

      items.value = response.items || []
      // Only update total and totalPages from response, keep currentPage as our source of truth
      total.value = response.pagination?.total || 0
      totalPages.value = response.pagination?.totalPages || 0
    } catch (err) {
      console.error('Failed to load items:', err)
      itemsError.value = 'Failed to load items'
    } finally {
      loadingItems.value = false
    }
  }

  async function purchaseItem(item: ShopItem) {
    if (!selectedCharacter.value || purchasing.value) return

    purchasing.value = item.entry

    try {
      const quantity = getQuantity(item)
      const { data, error } = await useFetch('/api/shop/purchase', {
        method: 'POST',
        body: {
          itemId: item.entry,
          quantity,
          characterGuid: selectedCharacter.value.guid,
          realmId: selectedCharacter.value.realmId,
        },
      })

      if (error.value) {
        const errData = error.value.data as any
        showNotification('error', errData?.statusMessage || 'Purchase failed')
        return
      }

      const response = data.value as any
      if (response.success) {
        showNotification('success', response.message)
        // Update character's money
        if (selectedCharacter.value && response.newBalance !== undefined) {
          selectedCharacter.value.money = response.newBalance
          // Also update in allCharacters list
          const charIdx = allCharacters.value.findIndex(
            c => c.guid === selectedCharacter.value!.guid && c.realmId === selectedCharacter.value!.realmId
          )
          if (charIdx >= 0 && allCharacters.value[charIdx]) {
            allCharacters.value[charIdx].money = response.newBalance
          }
        }
        // Reset quantity for this item
        quantities.value[item.entry] = 1
      } else {
        showNotification('error', response.message || 'Purchase failed')
      }
    } catch (err) {
      console.error('Purchase error:', err)
      showNotification('error', 'Failed to process purchase')
    } finally {
      purchasing.value = null
    }
  }

  function selectCharacter(char: ShopCharacter) {
    selectedCharacter.value = char
    loadItems()
  }

  function clearSelectedCharacter() {
    selectedCharacter.value = null
  }

  function selectCategory(category: ShopCategory) {
    selectedCategory.value = category
    currentPage.value = 1
    updateUrlPage(1)
    loadItems()
  }

  function goToPage(page: number) {
    currentPage.value = page
    updateUrlPage(page)
    loadItems()
  }

  // Debounced search
  let searchTimeout: ReturnType<typeof setTimeout> | null = null
  function debouncedSearch() {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      currentPage.value = 1
      updateUrlPage(1)
      loadItems()
    }, 300)
  }

  return {
    // State
    selectedCharacter,
    selectedCategory,
    searchQuery,
    items,
    quantities,
    pagination,
    purchasing,
    notification,
    loadingCharacters,
    loadingItems,
    characterError,
    itemsError,
    shopConfig,
    allCharacters,
    // Helpers
    getClassIcon,
    formatMoney,
    getQuantity,
    setQuantity,
    incrementQuantity,
    decrementQuantity,
    canAfford,
    getIconUrl,
    showNotification,
    // Actions
    loadShopConfig,
    loadCharacters,
    loadItems,
    purchaseItem,
    selectCharacter,
    clearSelectedCharacter,
    selectCategory,
    goToPage,
    debouncedSearch,
  }
}
