<script setup lang="ts">
import type { ShopItem } from '~/types'

const props = defineProps<{
  item: ShopItem
  quantity: number
  canAfford: boolean
  purchasing: boolean
  formatMoney: (copper: number) => string
  getIconUrl: (iconName: string) => string
}>()

const emit = defineEmits<{
  increment: []
  decrement: []
  setQuantity: [value: number]
  purchase: []
}>()

function onQuantityChange(event: Event) {
  const input = event.target as HTMLInputElement
  emit('setQuantity', parseInt(input.value) || 1)
}

function onIconError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<template>
  <div class="item-card" :class="`quality-${item.quality}`">
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
          :disabled="quantity <= 1"
          @click="emit('decrement')"
        >
          -
        </button>
        <input
          type="number"
          :value="quantity"
          min="1"
          :max="item.maxStackSize * 10"
          @change="onQuantityChange"
        />
        <button class="qty-btn" @click="emit('increment')">
          +
        </button>
      </div>
      <button
        class="btn-buy"
        :disabled="!canAfford || purchasing"
        @click="emit('purchase')"
      >
        <span v-if="purchasing">...</span>
        <span v-else>Buy</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use 'sass:color' as color;

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
        background: color.adjust($color-accent, $lightness:5%);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}

@media (max-width: 768px) {
  .item-card {
    flex-direction: column;

    .item-actions {
      flex-direction: row;
      width: 100%;
      justify-content: space-between;
    }
  }
}
</style>
