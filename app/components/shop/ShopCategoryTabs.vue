<script setup lang="ts">
import type { ShopCategory, ShopCategoryInfo } from '~/types'

defineProps<{
  categories: ShopCategoryInfo[]
  selected: ShopCategory
}>()

const emit = defineEmits<{
  select: [category: ShopCategory]
}>()
</script>

<template>
  <div class="category-tabs">
    <button
      v-for="cat in categories"
      :key="cat.id"
      class="category-tab"
      :class="{ active: selected === cat.id }"
      @click="emit('select', cat.id)"
    >
      <span class="cat-icon">{{ cat.icon }}</span>
      <span class="cat-name">{{ cat.name }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

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
</style>
