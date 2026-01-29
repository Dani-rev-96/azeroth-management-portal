<template>
  <div class="shop-page">
    <UiPageHeader
      title="Shop"
      subtitle="Purchase crafting materials, trade goods, and mounts"
    />

    <!-- Character Selection -->
    <ShopCharacterSelect
      v-if="!selectedCharacter"
      :characters="allCharacters"
      :loading="loadingCharacters"
      :error="characterError"
      :get-class-icon="getClassIcon"
      :format-money="formatMoney"
      @select="selectCharacter"
    />

    <!-- Shop Content -->
    <template v-else>
      <ShopSelectedCharacterBar
        :character="selectedCharacter"
        :get-class-icon="getClassIcon"
        :format-money="formatMoney"
        @change="clearSelectedCharacter"
      />

      <ShopCategoryTabs
        :categories="categories"
        :selected="selectedCategory"
        @select="selectCategory"
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

    <ShopNotification :notification="notification" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import type { ShopCategoryInfo } from '~/types'

// Categories configuration
const categories: ShopCategoryInfo[] = [
  { id: 'trade_goods', name: 'Trade Goods', description: 'Crafting materials', icon: '🔨' },
  { id: 'mounts', name: 'Mounts', description: 'Rideable mounts', icon: '🐴' },
  { id: 'miscellaneous', name: 'Miscellaneous', description: 'General goods', icon: '📦' },
]

// Use the shop composable for all state and logic
const {
  selectedCharacter,
  selectedCategory,
  searchQuery,
  items,
  pagination,
  purchasing,
  notification,
  loadingCharacters,
  loadingItems,
  characterError,
  itemsError,
  shopConfig,
  allCharacters,
  getClassIcon,
  formatMoney,
  getQuantity,
  setQuantity,
  incrementQuantity,
  decrementQuantity,
  canAfford,
  getIconUrl,
  loadShopConfig,
  loadCharacters,
  purchaseItem,
  selectCharacter,
  clearSelectedCharacter,
  selectCategory,
  goToPage,
  debouncedSearch,
} = useShop()

// Lifecycle
onMounted(async () => {
  await loadShopConfig()
  await loadCharacters()
})
</script>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.shop-page {
  @include container;
}
</style>
