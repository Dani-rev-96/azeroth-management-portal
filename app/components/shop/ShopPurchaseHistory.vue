<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ShopPurchaseHistoryEntry } from '~/types'
import { useShopStore } from '~/stores/shop'
import { getQualityColor, formatRelativeTime } from '~/utils/wow'

const props = defineProps<{
  characterGuid: number
  realmId: string
  visible: boolean
}>()

const shopStore = useShopStore()
const history = ref<ShopPurchaseHistoryEntry[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const totalPages = ref(0)
const total = ref(0)

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: 'Pending', color: '#f59e0b' },
  waiting: { text: 'Waiting for login', color: '#3b82f6' },
  done: { text: 'Delivered', color: '#22c55e' },
  error: { text: 'Failed', color: '#ef4444' },
}

async function fetchHistory() {
  if (!props.characterGuid || !props.realmId) return

  loading.value = true
  error.value = ''

  try {
    const data = await $fetch<{
      history: ShopPurchaseHistoryEntry[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>('/api/shop/history', {
      params: {
        characterGuid: props.characterGuid,
        realmId: props.realmId,
        page: page.value,
      },
    })

    history.value = data.history
    total.value = data.pagination.total
    totalPages.value = data.pagination.totalPages
  } catch (err: any) {
    console.error('Failed to load purchase history:', err)
    error.value = err.data?.statusMessage || 'Failed to load purchase history'
  } finally {
    loading.value = false
  }
}

function goToPage(newPage: number) {
  if (newPage < 1 || newPage > totalPages.value) return
  page.value = newPage
  fetchHistory()
}

watch(
  () => props.visible,
  (visible) => {
    if (visible && history.value.length === 0) {
      fetchHistory()
    }
  },
  { immediate: true }
)

function getDeliveryIcon(method: string): string {
  return method === 'mail' ? '📬' : '🎒'
}
</script>

<template>
  <div class="purchase-history">
    <div class="history-header">
      <h3>Purchase History</h3>
      <span v-if="total > 0" class="history-count">{{ total }} purchase{{ total !== 1 ? 's' : '' }}</span>
    </div>

    <div v-if="loading" class="history-loading">
      Loading purchase history...
    </div>

    <div v-else-if="error" class="history-error">
      {{ error }}
    </div>

    <div v-else-if="history.length === 0" class="history-empty">
      <span class="empty-icon">📋</span>
      <p>No purchases yet</p>
    </div>

    <div v-else class="history-list">
      <div
        v-for="entry in history"
        :key="`${entry.deliveryMethod}-${entry.id}`"
        class="history-entry"
      >
        <div class="entry-icon">
          <img
            v-if="entry.itemIcon"
            :src="shopStore.getIconUrl(entry.itemIcon)"
            :alt="entry.itemName"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <span v-else class="icon-placeholder">📦</span>
        </div>

        <div class="entry-info">
          <div class="entry-name" :style="{ color: getQualityColor(entry.itemQuality) }">
            {{ entry.quantity > 1 ? `${entry.quantity}x ` : '' }}{{ entry.itemName }}
          </div>
          <div class="entry-meta">
            <span class="entry-delivery" :title="entry.deliveryMethod === 'mail' ? 'Via mail' : 'Via bags'">
              {{ getDeliveryIcon(entry.deliveryMethod) }}
            </span>
            <span
              class="entry-status"
              :style="{ color: STATUS_LABELS[entry.status]?.color || '#ffffff' }"
            >
              {{ STATUS_LABELS[entry.status]?.text || entry.status }}
            </span>
            <span class="entry-date" :title="entry.createdAt">
              {{ formatRelativeTime(entry.createdAt) }}
            </span>
          </div>
        </div>

        <div v-if="entry.totalCost > 0" class="entry-cost">
          {{ shopStore.formatMoney(entry.totalCost) }}
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="history-pagination">
      <button
        :disabled="page <= 1"
        @click="goToPage(page - 1)"
      >
        ←
      </button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button
        :disabled="page >= totalPages"
        @click="goToPage(page + 1)"
      >
        →
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.purchase-history {
  margin-top: 1.5rem;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;

  h3 {
    margin: 0;
    font-size: 1.125rem;
    color: $text-primary;
  }

  .history-count {
    font-size: 0.8125rem;
    color: $text-muted;
  }
}

.history-loading,
.history-error,
.history-empty {
  text-align: center;
  padding: 2rem;
  color: $text-muted;
}

.history-error {
  color: $error;
}

.history-empty {
  .empty-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  p {
    margin: 0;
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-entry {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: 8px;
  transition: border-color 0.2s;

  &:hover {
    border-color: $border-secondary;
  }
}

.entry-icon {
  width: 36px;
  height: 36px;
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
    font-size: 1.25rem;
  }
}

.entry-info {
  flex: 1;
  min-width: 0;

  .entry-name {
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
  }

  .entry-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: $text-muted;

    .entry-delivery {
      font-size: 0.875rem;
    }

    .entry-status {
      font-weight: 500;
    }

    .entry-date {
      color: $text-muted;
    }
  }
}

.entry-cost {
  flex-shrink: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: $quality-legendary;
  white-space: nowrap;
}

.history-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid $border-primary;

  button {
    padding: 0.375rem 0.75rem;
    background: $bg-tertiary;
    border: 1px solid $border-primary;
    border-radius: 4px;
    color: $text-primary;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: $color-accent;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .page-info {
    font-size: 0.8125rem;
    color: $text-secondary;
  }
}
</style>
