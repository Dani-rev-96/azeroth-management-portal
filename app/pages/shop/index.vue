<template>
  <div class="shop-page">
    <header class="page-header">
      <div class="header-content">
        <h1>🛒 Shop</h1>
        <p class="subtitle">Purchase crafting materials, trade goods, and mounts</p>
      </div>
    </header>

    <main class="content-section">
      <!-- Character Selection -->
      <section class="character-select-section" v-if="!selectedCharacter">
        <div class="section-header">
          <h2>Select a Character</h2>
          <p>Choose which character will receive your purchases</p>
        </div>

        <div v-if="loadingCharacters" class="loading">
          <p>Loading your characters...</p>
        </div>

        <div v-else-if="characterError" class="error-state">
          <p>{{ characterError }}</p>
        </div>

        <div v-else-if="allCharacters.length === 0" class="empty-state">
          <p>No characters found. Create a character in-game first.</p>
        </div>

        <div v-else class="character-grid">
          <button
            v-for="char in allCharacters"
            :key="`${char.realmId}-${char.guid}`"
            class="character-card"
            @click="selectCharacter(char)"
          >
            <div class="char-avatar" :class="`class-${char.class}`">
              {{ getClassIcon(char.class) }}
            </div>
            <div class="char-info">
              <h3>{{ char.name }}</h3>
              <p class="char-details">
                Level {{ char.level }} {{ getClassName(char.class) }}
              </p>
              <p class="char-realm">{{ char.realmName }}</p>
              <p class="char-gold">💰 {{ formatMoney(char.money) }}</p>
            </div>
          </button>
        </div>
      </section>

      <!-- Shop Content -->
      <template v-else>
        <!-- Selected Character Header -->
        <div class="selected-character-bar">
          <div class="selected-char-info">
            <span class="char-avatar small" :class="`class-${selectedCharacter.class}`">
              {{ getClassIcon(selectedCharacter.class) }}
            </span>
            <span class="char-name">{{ selectedCharacter.name }}</span>
            <span class="char-balance">💰 {{ formatMoney(selectedCharacter.money) }}</span>
          </div>
          <button class="btn-change-char" @click="selectedCharacter = null">
            Change Character
          </button>
        </div>

        <!-- Category Tabs -->
        <div class="category-tabs">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="category-tab"
            :class="{ active: selectedCategory === cat.id }"
            @click="selectCategory(cat.id)"
          >
            <span class="cat-icon">{{ cat.icon }}</span>
            <span class="cat-name">{{ cat.name }}</span>
          </button>
        </div>

        <!-- Search and Filters -->
        <div class="shop-controls">
          <div class="search-box">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search items..."
              @input="debouncedSearch"
            />
            <span class="search-icon">🔍</span>
          </div>
          <div class="markup-info">
            <span class="info-icon">ℹ️</span>
            <span>Prices include {{ shopConfig?.priceMarkupPercent }}% markup</span>
          </div>
        </div>

        <!-- Items Grid -->
        <div v-if="loadingItems" class="loading">
          <p>Loading items...</p>
        </div>

        <div v-else-if="itemsError" class="error-state">
          <p>{{ itemsError }}</p>
        </div>

        <div v-else-if="items.length === 0" class="empty-state">
          <p>No items found in this category</p>
        </div>

        <div v-else class="items-grid">
          <div
            v-for="item in items"
            :key="item.entry"
            class="item-card"
            :class="`quality-${item.quality}`"
          >
            <div class="item-icon">
              <img
                v-if="item.icon"
                :src="getIconUrl(item.icon)"
                :alt="item.name"
                @error="onIconError"
              />
              <span v-else class="icon-placeholder">📦</span>
            </div>
            <div class="item-info">
              <h3 :class="`quality-text-${item.quality}`">{{ item.name }}</h3>
              <p v-if="item.description" class="item-desc">{{ item.description }}</p>
              <div class="item-meta">
                <span v-if="item.requiredLevel > 1" class="req-level">
                  Requires Level {{ item.requiredLevel }}
                </span>
                <span class="item-level">iLvl {{ item.itemLevel }}</span>
              </div>
              <div class="item-price">
                <span class="price-label">Price:</span>
                <span class="price-value">{{ formatMoney(item.shopPrice) }}</span>
              </div>
            </div>
            <div class="item-actions">
              <div class="quantity-control">
                <button
                  class="qty-btn"
                  @click="decrementQuantity(item)"
                  :disabled="getQuantity(item) <= 1"
                >
                  -
                </button>
                <input
                  type="number"
                  :value="getQuantity(item)"
                  min="1"
                  :max="item.maxStackSize * 10"
                  @change="setQuantity(item, $event)"
                />
                <button class="qty-btn" @click="incrementQuantity(item)">
                  +
                </button>
              </div>
              <button
                class="btn-buy"
                :disabled="!canAfford(item) || purchasing === item.entry"
                @click="purchaseItem(item)"
              >
                <span v-if="purchasing === item.entry">...</span>
                <span v-else>Buy</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.totalPages > 1" class="pagination">
          <button
            class="page-btn"
            :disabled="pagination.page <= 1"
            @click="goToPage(pagination.page - 1)"
          >
            ← Prev
          </button>
          <span class="page-info">
            Page {{ pagination.page }} of {{ pagination.totalPages }}
          </span>
          <button
            class="page-btn"
            :disabled="pagination.page >= pagination.totalPages"
            @click="goToPage(pagination.page + 1)"
          >
            Next →
          </button>
        </div>
      </template>

      <!-- Purchase Notifications -->
      <Teleport to="body">
        <div v-if="notification" class="notification" :class="notification.type">
          <span class="notification-icon">
            {{ notification.type === 'success' ? '✅' : '❌' }}
          </span>
          <span class="notification-message">{{ notification.message }}</span>
        </div>
      </Teleport>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { ShopItem, ShopCategory, ShopCategoryInfo, RealmId } from '~/types'

// Auth
const authStore = useAuthStore()

// State
const selectedCharacter = ref<{
  guid: number
  name: string
  class: number
  level: number
  money: number
  realmId: RealmId
  realmName: string
} | null>(null)

const selectedCategory = ref<ShopCategory>('trade_goods')
const searchQuery = ref('')
const items = ref<ShopItem[]>([])
const quantities = ref<Record<number, number>>({})
const pagination = ref({ page: 1, limit: 50, total: 0, totalPages: 0 })
const purchasing = ref<number | null>(null)
const notification = ref<{ type: 'success' | 'error'; message: string } | null>(null)

// Loading states
const loadingCharacters = ref(true)
const loadingItems = ref(false)
const characterError = ref('')
const itemsError = ref('')

// Config
const shopConfig = ref<{ priceMarkupPercent: number; categories: ShopCategory[] } | null>(null)

// Characters from all linked accounts
const allCharacters = ref<Array<{
  guid: number
  name: string
  class: number
  race: number
  level: number
  money: number
  realmId: RealmId
  realmName: string
}>>([])

// Categories
const categories: ShopCategoryInfo[] = [
  { id: 'trade_goods', name: 'Trade Goods', description: 'Crafting materials', icon: '🔨' },
  { id: 'mounts', name: 'Mounts', description: 'Rideable mounts', icon: '🐴' },
  { id: 'miscellaneous', name: 'Miscellaneous', description: 'General goods', icon: '📦' },
]

// Class data
const CLASS_NAMES: Record<number, string> = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
  5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
  9: 'Warlock', 11: 'Druid',
}

const CLASS_ICONS: Record<number, string> = {
  1: '⚔️', 2: '🛡️', 3: '🏹', 4: '🗡️',
  5: '✨', 6: '💀', 7: '⚡', 8: '❄️',
  9: '🔥', 11: '🐻',
}

// Helper functions
function getClassName(classId: number): string {
  return CLASS_NAMES[classId] || 'Unknown'
}

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

function setQuantity(item: ShopItem, event: Event): void {
  const input = event.target as HTMLInputElement
  const value = Math.max(1, Math.min(parseInt(input.value) || 1, item.maxStackSize * 10))
  quantities.value[item.entry] = value
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

function onIconError(event: Event): void {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
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
      page: String(pagination.value.page),
      limit: String(pagination.value.limit),
    })

    if (searchQuery.value) {
      params.set('search', searchQuery.value)
    }

    const { data, error } = await useFetch(`/api/shop/items?${params}`)

    if (error.value) {
      itemsError.value = 'Failed to load items'
      return
    }

    const response = data.value as any
    items.value = response.items || []
    pagination.value = response.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 }
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

function getIconUrl(iconName: string) {
  // Remove .blp extension if present and convert to lowercase
  const cleanName = iconName.replace('.blp', '').toLowerCase()
  return `https://wow.zamimg.com/images/wow/icons/large/${cleanName}.jpg`
}

function showNotification(type: 'success' | 'error', message: string) {
  notification.value = { type, message }
  setTimeout(() => {
    notification.value = null
  }, 5000)
}

function selectCharacter(char: typeof allCharacters.value[0]) {
  selectedCharacter.value = char
  loadItems()
}

function selectCategory(category: ShopCategory) {
  selectedCategory.value = category
  pagination.value.page = 1
  loadItems()
}

function goToPage(page: number) {
  pagination.value.page = page
  loadItems()
}

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.value.page = 1
    loadItems()
  }, 300)
}

// Lifecycle
onMounted(async () => {
  await loadShopConfig()
  await loadCharacters()
})

// Watch for category changes
watch(selectedCategory, () => {
  if (selectedCharacter.value) {
    pagination.value.page = 1
    loadItems()
  }
})
</script>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.shop-page {
  min-height: 100vh;
  background: $bg-primary;
}

.page-header {
  background: linear-gradient(135deg, $bg-secondary 0%, rgba($color-accent, 0.1) 100%);
  padding: 2rem;
  border-bottom: 1px solid $border-primary;

  .header-content {
    max-width: 1200px;
    margin: 0 auto;

    h1 {
      color: $text-primary;
      font-size: 2rem;
      margin: 0 0 0.5rem 0;
    }

    .subtitle {
      color: $text-secondary;
      margin: 0;
    }
  }
}

.content-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

// Character Selection
.character-select-section {
  .section-header {
    text-align: center;
    margin-bottom: 2rem;

    h2 {
      color: $text-primary;
      margin: 0 0 0.5rem 0;
    }

    p {
      color: $text-secondary;
      margin: 0;
    }
  }
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.character-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    border-color: $color-accent;
    transform: translateY(-2px);
  }

  .char-avatar {
    width: 50px;
    height: 50px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    background: $bg-tertiary;

    &.class-1 { background: rgba($class-warrior, 0.2); border: 2px solid $class-warrior; }
    &.class-2 { background: rgba($class-paladin, 0.2); border: 2px solid $class-paladin; }
    &.class-3 { background: rgba($class-hunter, 0.2); border: 2px solid $class-hunter; }
    &.class-4 { background: rgba($class-rogue, 0.2); border: 2px solid $class-rogue; }
    &.class-5 { background: rgba($class-priest, 0.2); border: 2px solid $class-priest; }
    &.class-6 { background: rgba($class-deathknight, 0.2); border: 2px solid $class-deathknight; }
    &.class-7 { background: rgba($class-shaman, 0.2); border: 2px solid $class-shaman; }
    &.class-8 { background: rgba($class-mage, 0.2); border: 2px solid $class-mage; }
    &.class-9 { background: rgba($class-warlock, 0.2); border: 2px solid $class-warlock; }
    &.class-11 { background: rgba($class-druid, 0.2); border: 2px solid $class-druid; }
  }

  .char-info {
    flex: 1;

    h3 {
      color: $text-primary;
      margin: 0 0 0.25rem 0;
      font-size: 1rem;
    }

    .char-details {
      color: $text-secondary;
      margin: 0 0 0.25rem 0;
      font-size: 0.875rem;
    }

    .char-realm {
      color: $text-muted;
      font-size: 0.75rem;
      margin: 0 0 0.25rem 0;
    }

    .char-gold {
      color: $quality-legendary;
      font-size: 0.875rem;
      margin: 0;
    }
  }
}

// Selected Character Bar
.selected-character-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: 8px;
  margin-bottom: 1.5rem;

  .selected-char-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .char-avatar.small {
      width: 32px;
      height: 32px;
      font-size: 1rem;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: $bg-tertiary;

      &.class-1 { background: rgba($class-warrior, 0.2); border: 1px solid $class-warrior; }
      &.class-2 { background: rgba($class-paladin, 0.2); border: 1px solid $class-paladin; }
      &.class-3 { background: rgba($class-hunter, 0.2); border: 1px solid $class-hunter; }
      &.class-4 { background: rgba($class-rogue, 0.2); border: 1px solid $class-rogue; }
      &.class-5 { background: rgba($class-priest, 0.2); border: 1px solid $class-priest; }
      &.class-6 { background: rgba($class-deathknight, 0.2); border: 1px solid $class-deathknight; }
      &.class-7 { background: rgba($class-shaman, 0.2); border: 1px solid $class-shaman; }
      &.class-8 { background: rgba($class-mage, 0.2); border: 1px solid $class-mage; }
      &.class-9 { background: rgba($class-warlock, 0.2); border: 1px solid $class-warlock; }
      &.class-11 { background: rgba($class-druid, 0.2); border: 1px solid $class-druid; }
    }

    .char-name {
      color: $text-primary;
      font-weight: 600;
    }

    .char-balance {
      color: $quality-legendary;
      font-size: 0.875rem;
    }
  }

  .btn-change-char {
    padding: 0.5rem 1rem;
    background: $bg-tertiary;
    border: 1px solid $border-primary;
    border-radius: 4px;
    color: $text-secondary;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: $color-accent;
      color: $text-primary;
    }
  }
}

// Category Tabs
.category-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: 8px;
  color: $text-secondary;
  cursor: pointer;
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

  .cat-icon {
    font-size: 1.25rem;
  }

  .cat-name {
    font-weight: 500;
  }
}

// Shop Controls
.shop-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;

  .search-box {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 400px;

    input {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 2.5rem;
      background: $bg-secondary;
      border: 1px solid $border-primary;
      border-radius: 8px;
      color: $text-primary;
      font-size: 0.875rem;

      &:focus {
        outline: none;
        border-color: $color-accent;
      }

      &::placeholder {
        color: $text-muted;
      }
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1rem;
    }
  }

  .markup-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: $text-muted;
    font-size: 0.875rem;

    .info-icon {
      font-size: 1rem;
    }
  }
}

// Items Grid
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.item-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: $border-secondary;
  }

  // Quality border colors
  @each $quality, $color in (0: $quality-poor, 1: $quality-common, 2: $quality-uncommon, 3: $quality-rare, 4: $quality-epic, 5: $quality-legendary) {
    &.quality-#{$quality} {
      border-left: 3px solid $color;
    }
  }

  .item-icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    background: $bg-tertiary;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .icon-placeholder {
      font-size: 1.5rem;
    }
  }

  .item-info {
    flex: 1;
    min-width: 0;

    h3 {
      margin: 0 0 0.25rem 0;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    // Quality text colors
    @each $quality, $color in (0: $quality-poor, 1: $quality-common, 2: $quality-uncommon, 3: $quality-rare, 4: $quality-epic, 5: $quality-legendary) {
      .quality-text-#{$quality} {
        color: $color;
      }
    }

    .item-desc {
      color: $text-muted;
      font-size: 0.75rem;
      margin: 0 0 0.5rem 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .item-meta {
      display: flex;
      gap: 0.75rem;
      font-size: 0.75rem;
      color: $text-secondary;
      margin-bottom: 0.5rem;

      .req-level {
        color: $error;
      }
    }

    .item-price {
      .price-label {
        color: $text-muted;
        font-size: 0.75rem;
      }

      .price-value {
        color: $quality-legendary;
        font-weight: 600;
        font-size: 0.875rem;
        margin-left: 0.25rem;
      }
    }
  }

  .item-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;

    .quantity-control {
      display: flex;
      align-items: center;

      .qty-btn {
        width: 28px;
        height: 28px;
        background: $bg-tertiary;
        border: 1px solid $border-primary;
        color: $text-primary;
        cursor: pointer;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;

        &:first-child {
          border-radius: 4px 0 0 4px;
        }

        &:last-child {
          border-radius: 0 4px 4px 0;
        }

        &:hover:not(:disabled) {
          background: $bg-secondary;
          border-color: $color-accent;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      input {
        width: 48px;
        height: 28px;
        text-align: center;
        background: $bg-tertiary;
        border: 1px solid $border-primary;
        border-left: none;
        border-right: none;
        color: $text-primary;
        font-size: 0.875rem;

        &:focus {
          outline: none;
        }

        &::-webkit-inner-spin-button,
        &::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      }
    }

    .btn-buy {
      padding: 0.5rem 1rem;
      background: $color-accent;
      border: none;
      border-radius: 4px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 60px;

      &:hover:not(:disabled) {
        background: lighten($color-accent, 5%);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}

// Pagination
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid $border-primary;

  .page-btn {
    padding: 0.5rem 1rem;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: 4px;
    color: $text-secondary;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      border-color: $color-accent;
      color: $text-primary;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .page-info {
    color: $text-muted;
  }
}

// Notification
.notification {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 1000;
  animation: slideIn 0.3s ease;

  &.success {
    background: rgba($success, 0.9);
    color: white;
  }

  &.error {
    background: rgba($error, 0.9);
    color: white;
  }

  .notification-icon {
    font-size: 1.25rem;
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

// Loading & States
.loading,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: $text-secondary;

  p {
    margin: 0;
  }
}

.error-state {
  color: $error;
}

// Responsive
@media (max-width: 768px) {
  .content-section {
    padding: 1rem;
  }

  .selected-character-bar {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .shop-controls {
    flex-direction: column;
    align-items: stretch;

    .search-box {
      max-width: none;
    }
  }

  .items-grid {
    grid-template-columns: 1fr;
  }

  .item-card {
    flex-direction: column;

    .item-actions {
      flex-direction: row;
      width: 100%;
      justify-content: space-between;
    }
  }

  .notification {
    left: 1rem;
    right: 1rem;
    bottom: 1rem;
  }
}
</style>
