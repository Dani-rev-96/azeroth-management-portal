<script setup lang="ts">
import type { ShopItem } from '~/types'

defineProps<{
  items: ShopItem[]
  loading: boolean
  error: string
  purchasingId: number | null
  getQuantity: (item: ShopItem) => number
  canAfford: (item: ShopItem) => boolean
  formatMoney: (copper: number) => string
  getIconUrl: (iconName: string) => string
}>()

const emit = defineEmits<{
  increment: [item: ShopItem]
  decrement: [item: ShopItem]
  setQuantity: [item: ShopItem, value: number]
  purchase: [item: ShopItem]
}>()
</script>

<template>
  <div>
    <UiLoadingState v-if="loading" message="Loading items..." />

    <UiEmptyState
      v-else-if="error"
      icon="❌"
      :message="error"
    />

    <UiEmptyState
      v-else-if="items.length === 0"
      icon="📦"
      message="No items found in this category"
    />

    <div v-else class="items-grid">
      <ShopItemCard
        v-for="item in items"
        :key="item.entry"
        :item="item"
        :quantity="getQuantity(item)"
        :can-afford="canAfford(item)"
        :purchasing="purchasingId === item.entry"
        :format-money="formatMoney"
        :get-icon-url="getIconUrl"
        @increment="emit('increment', item)"
        @decrement="emit('decrement', item)"
        @set-quantity="(val) => emit('setQuantity', item, val)"
        @purchase="emit('purchase', item)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .items-grid {
    grid-template-columns: 1fr;
  }
}
</style>
