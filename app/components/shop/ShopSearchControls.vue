<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  markupPercent?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: []
}>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  emit('search')
}
</script>

<template>
  <div class="shop-controls">
    <div class="search-box">
      <input
        :value="modelValue"
        type="text"
        placeholder="Search items..."
        @input="onInput"
      />
      <span class="search-icon">🔍</span>
    </div>
    <div v-if="markupPercent !== undefined" class="markup-info">
      <span class="info-icon">ℹ️</span>
      <span>Prices include {{ markupPercent }}% markup</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

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

@media (max-width: 768px) {
  .shop-controls {
    flex-direction: column;
    align-items: stretch;

    .search-box {
      max-width: none;
    }
  }
}
</style>
