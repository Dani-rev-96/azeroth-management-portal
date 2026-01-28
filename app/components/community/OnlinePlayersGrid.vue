<script setup lang="ts">
/**
 * OnlinePlayersGrid - Grid of online player cards
 */
import type { OnlinePlayer } from '~/stores/community'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import OnlinePlayerCard from '~/components/community/OnlinePlayerCard.vue'

export interface Props {
  players: OnlinePlayer[]
  loading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  refresh: []
}>()
</script>

<template>
  <section class="online-players-section">
    <UiSectionHeader title="Who's Online Right Now">
      <template #actions>
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

    <UiLoadingState v-if="loading" message="Loading online players..." />

    <UiEmptyState
      v-else-if="players.length === 0"
      icon="👥"
      message="No players are currently online"
    />

    <div v-else class="online-players-grid">
      <OnlinePlayerCard
        v-for="player in players"
        :key="`${player.realmId}-${player.guid}`"
        :player="player"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.online-players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $spacing-6;
}
</style>
