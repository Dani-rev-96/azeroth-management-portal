<script setup lang="ts">
/**
 * AdminDressingRoomReputation - Reputation editor sub-component
 * Displays all character reputations and allows setting standing levels
 */
import UiButton from '~/components/ui/UiButton.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'

const props = defineProps<{
  guid: number
  realmId: string | number
  characterName: string
}>()

const STANDING_PRESETS = [
  { value: 42000, label: 'Exalted (42000)' },
  { value: 21000, label: 'Revered (21000)' },
  { value: 9000, label: 'Honored (9000)' },
  { value: 3000, label: 'Friendly (3000)' },
  { value: 0, label: 'Neutral (0)' },
  { value: -3000, label: 'Unfriendly (-3000)' },
  { value: -6000, label: 'Hostile (-6000)' },
  { value: -42000, label: 'Hated (-42000)' },
]

const STANDING_COLORS: Record<string, string> = {
  Exalted: '#1eff00',
  Revered: '#0070dd',
  Honored: '#1eff00',
  Friendly: '#1eff00',
  Neutral: '#ffd700',
  Unfriendly: '#ee6600',
  Hostile: '#ff4444',
  Hated: '#cc0000',
}

interface Reputation {
  factionId: number
  factionName: string
  standing: number
  standingName: string
  flags: number
  known: boolean
}

const reputations = ref<Reputation[]>([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const actionLoading = ref<number | null>(null)
const filterKnown = ref(true)
const selectedStanding = ref<Record<number, number | null>>({})
const bulkStanding = ref<number | null>(null)
const bulkLoading = ref(false)

const filteredReputations = computed(() => {
  if (!filterKnown.value) return reputations.value
  return reputations.value.filter(r => r.known)
})

async function loadReputations() {
  loading.value = true
  error.value = ''

  try {
    const data = await $fetch<{ reputations: Reputation[] }>(
      `/api/admin/dressingroom/reputations/${props.guid}/${props.realmId}`
    )
    reputations.value = data.reputations || []
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || 'Failed to load reputations'
  } finally {
    loading.value = false
  }
}

async function setReputation(factionId: number) {
  const standing = selectedStanding.value[factionId]
  if (standing === null || standing === undefined) return

  actionLoading.value = factionId
  error.value = ''
  success.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/set-reputation', {
      method: 'POST',
      body: { guid: props.guid, realmId: props.realmId, factionId, standing },
    })
    success.value = data.message
    // Refresh to show updated standings
    await loadReputations()
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || 'Failed to set reputation'
  } finally {
    actionLoading.value = null
  }
}

async function setAllKnownToStanding() {
  if (bulkStanding.value === null || bulkStanding.value === undefined) return

  bulkLoading.value = true
  error.value = ''
  success.value = ''
  let count = 0

  try {
    const targets = filteredReputations.value
    for (const rep of targets) {
      await $fetch('/api/admin/dressingroom/set-reputation', {
        method: 'POST',
        body: { guid: props.guid, realmId: props.realmId, factionId: rep.factionId, standing: bulkStanding.value },
      })
      count++
    }
    success.value = `Set ${count} faction(s) to standing ${bulkStanding.value}`
    await loadReputations()
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || `Failed after ${count} factions`
  } finally {
    bulkLoading.value = false
  }
}

// Load on mount
onMounted(loadReputations)
</script>

<template>
  <div class="reputation-editor">
    <h3 class="editor-card__title">🏛️ Reputations</h3>

    <UiMessage v-if="error" variant="error">{{ error }}</UiMessage>
    <UiMessage v-if="success" variant="success">{{ success }}</UiMessage>

    <UiLoadingState v-if="loading" message="Loading reputations..." />

    <template v-if="!loading && reputations.length > 0">
      <!-- Bulk action -->
      <div class="reputation-bulk">
        <UiSelect
          v-model="bulkStanding"
          :options="STANDING_PRESETS"
          placeholder="Set all to..."
        />
        <UiButton
          size="sm"
          :loading="bulkLoading"
          :disabled="bulkStanding === null || bulkStanding === undefined"
          @click="setAllKnownToStanding"
        >
          Set All ({{ filteredReputations.length }})
        </UiButton>
        <label class="filter-toggle">
          <input v-model="filterKnown" type="checkbox" />
          <span>Known only</span>
        </label>
      </div>

      <!-- Reputation list -->
      <div class="reputation-list">
        <div
          v-for="rep in filteredReputations"
          :key="rep.factionId"
          class="reputation-row"
        >
          <div class="reputation-row__info">
            <span class="reputation-row__name">{{ rep.factionName }}</span>
            <span
              class="reputation-row__standing"
              :style="{ color: STANDING_COLORS[rep.standingName] || '#fff' }"
            >
              {{ rep.standingName }} ({{ rep.standing }})
            </span>
          </div>
          <div class="reputation-row__actions">
            <UiSelect
              :model-value="selectedStanding[rep.factionId]"
              :options="STANDING_PRESETS"
              placeholder="Set to..."
              @update:model-value="selectedStanding[rep.factionId] = $event"
            />
            <UiButton
              size="sm"
              :loading="actionLoading === rep.factionId"
              :disabled="selectedStanding[rep.factionId] === null || selectedStanding[rep.factionId] === undefined"
              @click="setReputation(rep.factionId)"
            >
              Set
            </UiButton>
          </div>
        </div>
      </div>
    </template>
    <p v-else-if="!loading" class="empty-hint">No reputation data found</p>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.reputation-editor {
  @include card-base;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.reputation-bulk {
  display: flex;
  gap: $spacing-2;
  align-items: center;
  flex-wrap: wrap;
}

.filter-toggle {
  display: flex;
  align-items: center;
  gap: $spacing-1;
  font-size: $font-size-xs;
  color: $text-secondary;
  cursor: pointer;
  white-space: nowrap;

  input { cursor: pointer; }
}

.reputation-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  max-height: 400px;
  overflow-y: auto;
}

.reputation-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-2 $spacing-3;
  background: $bg-primary;
  border-radius: $radius-md;
  font-size: $font-size-sm;

  &__info {
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
    min-width: 0;
    flex: 1;
  }

  &__name {
    color: $text-primary;
    font-weight: $font-weight-medium;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__standing {
    font-size: $font-size-xs;
    font-family: monospace;
  }

  &__actions {
    display: flex;
    gap: $spacing-2;
    align-items: center;
    flex-shrink: 0;
  }
}

.empty-hint {
  font-size: $font-size-sm;
  color: $text-muted;
  font-style: italic;
  margin: 0;
}
</style>
