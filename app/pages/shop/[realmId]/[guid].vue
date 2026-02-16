<template>
  <div class="shop-page">
    <UiPageHeader
      title="Shop"
      subtitle="Browse weapons, armor, consumables, mounts & more"
    />

    <!-- Loading state while resolving character -->
    <div v-if="loading" class="shop-page__loading">
      <p>Loading character...</p>
    </div>

    <!-- Error state if character not found -->
    <div v-else-if="error" class="shop-page__error">
      <p>{{ error }}</p>
      <NuxtLink to="/shop" class="shop-page__back-link">
        ← Back to character selection
      </NuxtLink>
    </div>

    <!-- Shop Content -->
    <template v-else-if="selectedCharacter">
      <ShopSelectedCharacterBar
        :character="selectedCharacter"
        :get-class-icon="getClassIcon"
        :format-money="formatMoney"
        @change="goToCharacterSelection"
      />

      <ShopCategoryTabs
        :categories="categories"
        :selected="selectedCategory"
        @select="selectCategory"
      />

      <!-- View toggle: Shop / History -->
      <div class="shop-page__view-toggle">
        <button
          class="view-btn"
          :class="{ active: !showHistory }"
          @click="showHistory = false"
        >
          🛒 Shop
        </button>
        <button
          class="view-btn"
          :class="{ active: showHistory }"
          @click="showHistory = true"
        >
          📋 Purchase History
        </button>
      </div>

      <!-- Purchase History View -->
      <ShopPurchaseHistory
        v-if="showHistory"
        :character-guid="selectedCharacter.guid"
        :realm-id="selectedCharacter.realmId"
        :visible="showHistory"
      />

      <!-- Shop View -->
      <template v-else>
        <ShopDeliveryToggle
          v-if="shopConfig?.deliveryMethod"
          :config-delivery-method="shopConfig.deliveryMethod"
          :selected-method="preferredDeliveryMethod"
          :character="selectedCharacter"
          @update:selected-method="setDeliveryMethod"
        />

        <ShopSearchControls
          v-model="searchQuery"
          :markup-percent="shopConfig?.priceMarkupPercent"
          @search="debouncedSearch"
        />

        <ShopItemsGrid
          :items="items"
          :loading="loadingItems"
          :error="itemsError"
          :purchasing-id="purchasing"
          :realm-id="selectedCharacter.realmId"
          :get-quantity="getQuantity"
          :can-afford="canAfford"
          :format-money="formatMoney"
          :get-icon-url="getIconUrl"
          @increment="incrementQuantity"
          @decrement="decrementQuantity"
          @set-quantity="setQuantity"
          @purchase="purchaseItem"
        />

        <ShopPagination
          :page="pagination.page"
          :total-pages="pagination.totalPages"
          @page-change="goToPage"
        />
      </template>
    </template>

    <ShopNotification :notification="notification" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { ShopCategoryInfo, ShopItem, ShopCategory, RealmId } from '~/types'
import { useShopStore } from '~/stores/shop'
import type { Character } from '~/stores/characters'

// Route params
const route = useRoute()
const router = useRouter()

// Store
const shopStore = useShopStore()

// Categories configuration
const VALID_CATEGORIES: ShopCategory[] = [
  'weapons', 'armor', 'consumables', 'trade_goods', 'gems',
  'recipes', 'glyphs', 'containers', 'mounts', 'miscellaneous',
]

const categories: ShopCategoryInfo[] = [
  { id: 'weapons', name: 'Weapons', description: 'Swords, axes, maces, bows & more', icon: '⚔️' },
  { id: 'armor', name: 'Armor', description: 'Cloth, leather, mail & plate', icon: '🛡️' },
  { id: 'consumables', name: 'Consumables', description: 'Food, flasks, potions & scrolls', icon: '🧪' },
  { id: 'trade_goods', name: 'Trade Goods', description: 'Crafting materials', icon: '🔨' },
  { id: 'gems', name: 'Gems', description: 'Gems for socketed items', icon: '💎' },
  { id: 'recipes', name: 'Recipes', description: 'Profession recipes & plans', icon: '📜' },
  { id: 'glyphs', name: 'Glyphs', description: 'Major & minor glyphs', icon: '✒️' },
  { id: 'containers', name: 'Containers', description: 'Bags & specialty containers', icon: '🎒' },
  { id: 'mounts', name: 'Mounts', description: 'Rideable mounts', icon: '🐴' },
  { id: 'miscellaneous', name: 'Miscellaneous', description: 'General goods', icon: '📦' },
]

// ==========================================================================
// State
// ==========================================================================

const loading = ref(true)
const error = ref('')

// URL-synced state (query params)
const selectedCategory = ref<ShopCategory>(getInitialCategory())
const searchQuery = ref(getInitialSearch())
const currentPage = ref(getInitialPage())

// Local state
const items = ref<ShopItem[]>([])
const quantities = ref<Record<number, number>>({})
const limit = ref(50)
const total = ref(0)
const totalPages = ref(0)
const purchasing = ref<number | null>(null)
const notification = ref<{ type: 'success' | 'error'; message: string } | null>(null)
const loadingItems = ref(false)
const itemsError = ref('')
const showHistory = ref(false)

// ==========================================================================
// URL Helpers
// ==========================================================================

function getUrlParam(name: string): string | undefined {
  const value = route.query[name]
  return typeof value === 'string' ? value : undefined
}

function getInitialPage(): number {
  const urlPage = parseInt(getUrlParam('page') || '')
  return urlPage && urlPage > 0 ? urlPage : 1
}

function getInitialCategory(): ShopCategory {
  const urlCategory = getUrlParam('category')
  if (urlCategory && VALID_CATEGORIES.includes(urlCategory as ShopCategory)) {
    return urlCategory as ShopCategory
  }
  return 'weapons'
}

function getInitialSearch(): string {
  return getUrlParam('search') || ''
}

function updateQueryParams(params: Record<string, string | undefined>) {
  const newQuery = { ...route.query }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      delete newQuery[key]
    } else {
      newQuery[key] = value
    }
  }

  // Use replace for query param changes (pagination, filters)
  router.replace({ query: newQuery })
}

// ==========================================================================
// Computed
// ==========================================================================

const selectedCharacter = computed(() => shopStore.selectedCharacter)
const shopConfig = computed(() => shopStore.config)
const preferredDeliveryMethod = computed(() => shopStore.preferredDeliveryMethod)

const pagination = computed(() => ({
  page: currentPage.value,
  limit: limit.value,
  total: total.value,
  totalPages: totalPages.value,
}))

// ==========================================================================
// URL Watchers
// ==========================================================================

watch(
  () => getUrlParam('category'),
  (newCategory) => {
    const category = (newCategory || 'weapons') as ShopCategory
    if (VALID_CATEGORIES.includes(category) && selectedCategory.value !== category) {
      selectedCategory.value = category
      currentPage.value = 1
      loadItems()
    }
  }
)

watch(
  () => getUrlParam('page'),
  (newPage) => {
    const page = parseInt(newPage || '') || 1
    if (page !== currentPage.value) {
      currentPage.value = page
      loadItems()
    }
  }
)

watch(
  () => getUrlParam('search'),
  (newSearch) => {
    const search = newSearch || ''
    if (searchQuery.value !== search) {
      searchQuery.value = search
      currentPage.value = 1
      loadItems()
    }
  }
)

// ==========================================================================
// Item Helpers
// ==========================================================================

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
  const totalCost = item.shopPrice * getQuantity(item)
  return selectedCharacter.value.money >= totalCost
}

// ==========================================================================
// Utility Functions
// ==========================================================================

function getClassIcon(classId: number): string {
  return shopStore.getClassIcon(classId)
}

function formatMoney(copper: number): string {
  return shopStore.formatMoney(copper)
}

function getIconUrl(iconName: string): string {
  return shopStore.getIconUrl(iconName)
}

function showNotification(type: 'success' | 'error', message: string) {
  notification.value = { type, message }
  if (notificationTimer) clearTimeout(notificationTimer)
  notificationTimer = setTimeout(() => {
    notification.value = null
  }, 5000)
}

// ==========================================================================
// Data Loading
// ==========================================================================

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

    const response = await $fetch<{
      items: ShopItem[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>(`/api/shop/items?${params}`)

    items.value = response.items || []
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
    const deliveryMethod = shopStore.effectiveDeliveryMethod

    const response = await $fetch<{
      success: boolean
      message: string
      newBalance?: number
    }>('/api/shop/purchase', {
      method: 'POST',
      body: {
        itemId: item.entry,
        quantity,
        characterGuid: selectedCharacter.value.guid,
        realmId: selectedCharacter.value.realmId,
        deliveryMethod,
      },
    })

    if (response.success) {
      showNotification('success', response.message)

      if (response.newBalance !== undefined) {
        shopStore.updateCharacterMoney(
          selectedCharacter.value.guid,
          selectedCharacter.value.realmId,
          response.newBalance
        )
      }

      quantities.value[item.entry] = 1
    } else {
      showNotification('error', response.message || 'Purchase failed')
    }
  } catch (err: any) {
    console.error('Purchase error:', err)
    const message = err.data?.statusMessage || err.message || 'Failed to process purchase'
    showNotification('error', message)
  } finally {
    purchasing.value = null
  }
}

// ==========================================================================
// Navigation Actions
// ==========================================================================

function goToCharacterSelection() {
  shopStore.clearSelectedCharacter()
  router.push('/shop')
}

function selectCategory(category: ShopCategory) {
  selectedCategory.value = category
  currentPage.value = 1

  updateQueryParams({
    category: category === 'weapons' ? undefined : category,
    page: undefined,
  })

  loadItems()
}

function goToPage(page: number) {
  currentPage.value = page

  updateQueryParams({
    page: page === 1 ? undefined : String(page),
  })

  loadItems()
}

let notificationTimer: ReturnType<typeof setTimeout> | null = null
let searchTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1

    updateQueryParams({
      search: searchQuery.value || undefined,
      page: undefined,
    })

    loadItems()
  }, 300)
}

function setDeliveryMethod(method: 'mail' | 'bag') {
  shopStore.setDeliveryMethod(method)
}

// ==========================================================================
// Initialization
// ==========================================================================

async function initialize() {
  loading.value = true
  error.value = ''

  try {
    // Load shop config
    await shopStore.loadConfig()

    // Load characters if not already loaded
    if (shopStore.characters.length === 0) {
      await shopStore.loadCharacters()
    }

    // Find character from route params
    const realmId = route.params.realmId as string
    const guid = parseInt(route.params.guid as string, 10)

    if (!realmId || isNaN(guid)) {
      error.value = 'Invalid character URL'
      return
    }

    const character = shopStore.characters.find(
      c => c.guid === guid && c.realmId === realmId
    )

    if (!character) {
      error.value = 'Character not found or not linked to your account'
      return
    }

    // Select the character in the store
    shopStore.selectCharacter(character)

    // Load items
    await loadItems()
  } catch (err) {
    console.error('Failed to initialize shop:', err)
    error.value = 'Failed to load shop'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  initialize()
})

onUnmounted(() => {
  if (notificationTimer) clearTimeout(notificationTimer)
  if (searchTimeout) clearTimeout(searchTimeout)
})
</script>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.shop-page {
  @include container;

  &__loading,
  &__error {
    text-align: center;
    padding: 3rem;
  }

  &__error {
    color: var(--color-error, #e74c3c);
  }

  &__back-link {
    display: inline-block;
    margin-top: 1rem;
    color: var(--color-primary, #3498db);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__view-toggle {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;

    .view-btn {
      padding: 0.5rem 1rem;
      background: $bg-secondary;
      border: 1px solid $border-primary;
      border-radius: 8px;
      color: $text-secondary;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;

      &:hover {
        border-color: $color-accent;
        color: $text-primary;
      }

      &.active {
        background: rgba($color-accent, 0.1);
        border-color: $color-accent;
        color: $color-accent;
      }
    }
  }
}
</style>
