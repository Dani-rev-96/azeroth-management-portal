<script setup lang="ts">
import type { ShopDeliveryMethod } from '~/types'
import type { Character } from '~/stores/characters'

const props = defineProps<{
  configDeliveryMethod: ShopDeliveryMethod
  selectedMethod: 'mail' | 'bag'
  character: Character | null
}>()

const emit = defineEmits<{
  'update:selectedMethod': [method: 'mail' | 'bag']
}>()

// Only show toggle when 'both' is enabled
const showToggle = computed(() => props.configDeliveryMethod === 'both')

// Check if character is online
const isOnline = computed(() => props.character?.online === true)

// Disable bag option if character is offline
const bagDisabled = computed(() => !isOnline.value)
</script>

<template>
  <div v-if="showToggle" class="delivery-toggle">
    <span class="toggle-label">Delivery:</span>
    <div class="toggle-options">
      <button
        class="toggle-btn"
        :class="{ active: selectedMethod === 'mail' }"
        @click="emit('update:selectedMethod', 'mail')"
      >
        <span class="btn-icon">📬</span>
        <span class="btn-text">Mail</span>
      </button>
      <button
        class="toggle-btn"
        :class="{ active: selectedMethod === 'bag', disabled: bagDisabled }"
        :disabled="bagDisabled"
        :title="bagDisabled ? 'Character must be online for direct bag delivery' : 'Items go directly to your bags'"
        @click="emit('update:selectedMethod', 'bag')"
      >
        <span class="btn-icon">🎒</span>
        <span class="btn-text">Bag</span>
        <span v-if="bagDisabled" class="offline-badge">Offline</span>
      </button>
    </div>
    <p v-if="selectedMethod === 'bag' && !bagDisabled" class="delivery-hint success">
      ✓ Items will be added directly to your bags
    </p>
    <p v-else-if="bagDisabled && selectedMethod === 'bag'" class="delivery-hint warning">
      ⚠ Character is offline - using mail delivery
    </p>
  </div>

  <!-- Show info for bag-only mode -->
  <div v-else-if="configDeliveryMethod === 'bag'" class="delivery-info">
    <span class="info-icon">🎒</span>
    <span v-if="isOnline">Items will be delivered directly to your bags</span>
    <span v-else class="offline-warning">
      ⚠ Character must be online for purchases
    </span>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.delivery-toggle {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: 8px;

  .toggle-label {
    display: block;
    color: $text-secondary;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .toggle-options {
    display: flex;
    gap: 0.5rem;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: $bg-tertiary;
    border: 1px solid $border-primary;
    border-radius: 6px;
    color: $text-secondary;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;

    .btn-icon {
      font-size: 1rem;
    }

    .btn-text {
      font-size: 0.875rem;
    }

    .offline-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      background: $warning;
      color: $bg-primary;
      font-size: 0.625rem;
      padding: 2px 4px;
      border-radius: 4px;
      font-weight: 600;
    }

    &:hover:not(:disabled) {
      border-color: $color-accent;
      color: $text-primary;
    }

    &.active {
      background: rgba($color-accent, 0.15);
      border-color: $color-accent;
      color: $color-accent;
    }

    &.disabled,
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .delivery-hint {
    margin: 0.75rem 0 0 0;
    font-size: 0.75rem;

    &.success {
      color: $success;
    }

    &.warning {
      color: $warning;
    }
  }
}

.delivery-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: 6px;
  color: $text-secondary;
  font-size: 0.875rem;

  .info-icon {
    font-size: 1rem;
  }

  .offline-warning {
    color: $warning;
  }
}
</style>
