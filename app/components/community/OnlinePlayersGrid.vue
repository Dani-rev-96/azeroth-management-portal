<script setup lang="ts">
/**
 * OnlinePlayersGrid - Grid of online player cards with search and pagination
 */
import type { OnlinePlayer } from '~/stores/characters'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import OnlinePlayerCard from '~/components/community/OnlinePlayerCard.vue'

export interface Props {
  players: OnlinePlayer[]
  loading?: boolean
  searchQuery?: string
  currentPage?: number
  totalPages?: number
  filteredCount?: number
  totalCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  currentPage: 1,
  totalPages: 1,
  filteredCount: 0,
  totalCount: 0,
})

const emit = defineEmits<{
  refresh: []
  'update:searchQuery': [value: string]
  'update:currentPage': [value: number]
}>()

function handleSearchInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:searchQuery', target.value)
}

function goToPage(page: number) {
  if (page >= 1 && page <= props.totalPages) {
    emit('update:currentPage', page)
  }
}
</script>

<template>
  <section class="online-players-section">
    <UiSectionHeader title="Who's Online Right Now">
      <template #actions>
        <span v-if="totalCount > 0" class="player-count">
          {{ filteredCount === totalCount ? totalCount : `${filteredCount} / ${totalCount}` }} online
        </span>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="loading"
          @click="emit('refresh')"
        >
          🔄 Refresh
        </UiButton>
      </template>
    </UiSectionHeader>

    <!-- Search Controls -->
    <div class="search-controls">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          :value="searchQuery"
          placeholder="Search by name, zone, realm, or ID..."
          @input="handleSearchInput"
        />
        <button
          v-if="searchQuery"
          class="clear-btn"
          @click="emit('update:searchQuery', '')"
        >
          ×
        </button>
      </div>
    </div>

    <UiLoadingState v-if="loading" message="Loading online players..." />

    <UiEmptyState
      v-else-if="players.length === 0 && !searchQuery"
      icon="👥"
      message="No players are currently online"
    />

    <UiEmptyState
      v-else-if="players.length === 0 && searchQuery"
      icon="🔍"
      message="No players match your search"
    />

    <template v-else>
      <div class="online-players-grid">
        <OnlinePlayerCard
          v-for="player in players"
          :key="`${player.realmId}-${player.guid}`"
          :player="player"
        />
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          ← Prev
        </button>
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          class="page-btn"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Next →
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.online-players-section {
  .player-count {
    color: $text-muted;
    font-size: $font-size-sm;
    margin-right: $spacing-3;
  }
}

.search-controls {
  margin-bottom: $spacing-6;
}

.search-box {
  position: relative;
  max-width: 400px;

  .search-icon {
    position: absolute;
    left: $spacing-3;
    top: 50%;
    transform: translateY(-50%);
    font-size: $font-size-base;
    pointer-events: none;
  }

  input {
    width: 100%;
    padding: $spacing-3 $spacing-10;
    padding-right: $spacing-10;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    color: $text-primary;
    font-size: $font-size-sm;

    &:focus {
      outline: none;
      border-color: $blue-primary;
    }

    &::placeholder {
      color: $text-muted;
    }
  }

  .clear-btn {
    position: absolute;
    right: $spacing-3;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: $text-muted;
    font-size: $font-size-xl;
    cursor: pointer;
    padding: 0;
    line-height: 1;

    &:hover {
      color: $text-primary;
    }
  }
}

.online-players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $spacing-6;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-4;
  margin-top: $spacing-6;
  padding-top: $spacing-4;
  border-top: 1px solid $border-primary;

  .page-btn {
    padding: $spacing-2 $spacing-4;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    color: $text-secondary;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      border-color: $blue-primary;
      color: $text-primary;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .page-info {
    color: $text-muted;
    font-size: $font-size-sm;
  }
}
</style>
