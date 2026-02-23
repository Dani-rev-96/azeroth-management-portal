<script setup lang="ts">
/**
 * AdminDressingRoomTitles - Title management sub-component
 * Add/remove/set active titles for a character
 *
 * WotLK titles are stored as a bitmask in characters.knownTitles
 * Each bit position corresponds to a title ID
 */
import UiButton from '~/components/ui/UiButton.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import UiBadge from '~/components/ui/UiBadge.vue'

const props = defineProps<{
  guid: number
  realmId: string | number
  characterName: string
  knownTitles: string // space-separated uint32 bitmask
  chosenTitle: number
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

// WotLK 3.3.5a title IDs and names
// Format: { id, name, suffix } where suffix=true means the title goes after the name
const WOTLK_TITLES: Array<{ id: number; name: string; suffix: boolean }> = [
  // Classic / BC
  { id: 1, name: 'Private / Scout', suffix: false },
  { id: 2, name: 'Corporal / Grunt', suffix: false },
  { id: 3, name: 'Sergeant', suffix: false },
  { id: 4, name: 'Master Sergeant / Senior Sergeant', suffix: false },
  { id: 5, name: 'Sergeant Major / First Sergeant', suffix: false },
  { id: 6, name: 'Knight / Stone Guard', suffix: false },
  { id: 7, name: 'Knight-Lieutenant / Blood Guard', suffix: false },
  { id: 8, name: 'Knight-Captain / Legionnaire', suffix: false },
  { id: 9, name: 'Knight-Champion / Centurion', suffix: false },
  { id: 10, name: 'Lieutenant Commander / Champion', suffix: false },
  { id: 11, name: 'Commander / Lieutenant General', suffix: false },
  { id: 12, name: 'Marshal / General', suffix: false },
  { id: 13, name: 'Field Marshal / Warlord', suffix: false },
  { id: 14, name: 'Grand Marshal / High Warlord', suffix: false },
  // BC Arena
  { id: 42, name: 'Gladiator', suffix: false },
  { id: 43, name: 'Duelist', suffix: false },
  { id: 44, name: 'Rival', suffix: false },
  { id: 45, name: 'Challenger', suffix: false },
  // BC Misc
  { id: 46, name: 'Scarab Lord', suffix: false },
  { id: 47, name: 'Conqueror', suffix: false },
  { id: 48, name: 'Justicar / Conqueror', suffix: false },
  { id: 53, name: 'Champion of the Naaru', suffix: false },
  { id: 64, name: 'Hand of A\'dal', suffix: false },
  // WotLK
  { id: 72, name: 'of the Alliance / of the Horde', suffix: true },
  { id: 74, name: 'Merciless Gladiator', suffix: false },
  { id: 75, name: 'Vengeful Gladiator', suffix: false },
  { id: 76, name: 'Brutal Gladiator', suffix: false },
  { id: 77, name: 'Elder', suffix: false },
  { id: 78, name: 'Flame Warden / Flame Keeper', suffix: false },
  { id: 79, name: 'the Hallowed', suffix: true },
  { id: 80, name: 'the Love Fool', suffix: true },
  { id: 81, name: 'Matron / Patron', suffix: false },
  { id: 82, name: 'the Pilgrim', suffix: true },
  { id: 83, name: 'Brewmaster', suffix: false },
  { id: 84, name: 'Merrymaker', suffix: false },
  { id: 85, name: 'the Noble', suffix: true },
  { id: 87, name: 'the Explorer', suffix: true },
  { id: 89, name: 'Champion of the Frozen Wastes', suffix: true },
  { id: 90, name: 'Ambassador', suffix: false },
  { id: 91, name: 'of the Exodar / of Silvermoon', suffix: true },
  { id: 92, name: 'of Darnassus / of Thunder Bluff', suffix: true },
  { id: 93, name: 'of Ironforge / of Orgrimmar', suffix: true },
  { id: 94, name: 'of Stormwind / of Undercity', suffix: true },
  { id: 95, name: 'of Gnomeregan / of Sen\'jin', suffix: true },
  { id: 96, name: 'the Argent Champion', suffix: true },
  { id: 97, name: 'Guardian of Cenarius', suffix: true },
  { id: 98, name: 'Brewmaster', suffix: false },
  { id: 99, name: 'the Diplomat', suffix: true },
  { id: 100, name: 'the Exalted', suffix: true },
  { id: 101, name: 'Loremaster', suffix: false },
  { id: 102, name: 'of the Nightfall / of the Shattered Sun', suffix: true },
  { id: 105, name: 'the Seeker', suffix: true },
  { id: 108, name: 'the Undying', suffix: true },
  { id: 109, name: 'the Immortal', suffix: true },
  { id: 110, name: 'Jenkins', suffix: true },
  { id: 113, name: 'the Insane', suffix: true },
  { id: 114, name: 'of the Ebon Blade', suffix: true },
  { id: 115, name: 'Crusader', suffix: false },
  { id: 116, name: 'Death\'s Demise', suffix: true },
  { id: 117, name: 'the Celestial Defender', suffix: true },
  { id: 118, name: 'the Conqueror of Ulduar', suffix: true },
  { id: 119, name: 'Champion of Ulduar', suffix: true },
  { id: 120, name: 'Vanquisher', suffix: false },
  { id: 121, name: 'Starcaller', suffix: false },
  { id: 122, name: 'the Astral Walker', suffix: true },
  { id: 123, name: 'Herald of the Titans', suffix: true },
  { id: 124, name: 'Furious Gladiator', suffix: false },
  { id: 125, name: 'the Pilgrim', suffix: true },
  { id: 126, name: 'Relentless Gladiator', suffix: false },
  { id: 127, name: 'Grand Crusader', suffix: false },
  { id: 128, name: 'the Argent Defender', suffix: true },
  { id: 129, name: 'the Patient', suffix: true },
  { id: 130, name: 'the Light of Dawn', suffix: true },
  { id: 131, name: 'Bane of the Fallen King', suffix: true },
  { id: 132, name: 'the Kingslayer', suffix: true },
  { id: 133, name: 'of the Ashen Verdict', suffix: true },
  { id: 134, name: 'Wrathful Gladiator', suffix: false },
  { id: 137, name: 'the Bloodthirsty', suffix: true },
  { id: 139, name: 'the Flamebreaker', suffix: true },
  { id: 140, name: 'Firelord', suffix: false },
]

interface TitleState {
  id: number
  name: string
  suffix: boolean
  known: boolean
}

const error = ref('')
const success = ref('')
const actionLoading = ref<number | string | null>(null)
const customTitleId = ref<number | null>(null)
const filterMode = ref<'all' | 'known' | 'unknown'>('all')

// Parse the bitmask to determine which titles are known
const knownTitleSet = computed(() => {
  const set = new Set<number>()
  if (!props.knownTitles) return set

  const fields = props.knownTitles.split(' ').map(Number)
  for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
    const value = fields[fieldIdx]
    if (!value) continue
    for (let bit = 0; bit < 32; bit++) {
      if ((value >>> bit) & 1) {
        set.add(fieldIdx * 32 + bit)
      }
    }
  }
  return set
})

const titleStates = computed((): TitleState[] => {
  return WOTLK_TITLES.map(t => ({
    ...t,
    known: knownTitleSet.value.has(t.id),
  }))
})

const filteredTitles = computed(() => {
  if (filterMode.value === 'known') return titleStates.value.filter(t => t.known)
  if (filterMode.value === 'unknown') return titleStates.value.filter(t => !t.known)
  return titleStates.value
})

const knownCount = computed(() => titleStates.value.filter(t => t.known).length)

const chosenTitleOptions = computed(() => {
  const known = titleStates.value.filter(t => t.known)
  return [
    { value: 0, label: 'None' },
    ...known.map(t => ({ value: t.id, label: t.name })),
  ]
})

async function toggleTitle(titleId: number, currentlyKnown: boolean) {
  actionLoading.value = titleId
  error.value = ''
  success.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/set-title', {
      method: 'POST',
      body: {
        guid: props.guid,
        realmId: props.realmId,
        titleId,
        action: currentlyKnown ? 'remove' : 'add',
      },
    })
    success.value = data.message
    emit('refresh')
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || 'Failed to update title'
  } finally {
    actionLoading.value = null
  }
}

async function addCustomTitle() {
  if (!customTitleId.value || customTitleId.value < 1) return

  actionLoading.value = 'custom'
  error.value = ''
  success.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/set-title', {
      method: 'POST',
      body: {
        guid: props.guid,
        realmId: props.realmId,
        titleId: customTitleId.value,
        action: 'add',
      },
    })
    success.value = data.message
    customTitleId.value = null
    emit('refresh')
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || 'Failed to add title'
  } finally {
    actionLoading.value = null
  }
}

async function setChosenTitle(titleId: number) {
  actionLoading.value = 'chosen'
  error.value = ''
  success.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/set-title', {
      method: 'POST',
      body: {
        guid: props.guid,
        realmId: props.realmId,
        titleId,
        action: 'setChosen',
      },
    })
    success.value = data.message
    emit('refresh')
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || 'Failed to set active title'
  } finally {
    actionLoading.value = null
  }
}

async function grantAllTitles() {
  actionLoading.value = 'grantAll'
  error.value = ''
  success.value = ''
  let count = 0

  try {
    const unknownTitles = titleStates.value.filter(t => !t.known)
    for (const title of unknownTitles) {
      await $fetch('/api/admin/dressingroom/set-title', {
        method: 'POST',
        body: {
          guid: props.guid,
          realmId: props.realmId,
          titleId: title.id,
          action: 'add',
        },
      })
      count++
    }
    success.value = `Granted ${count} title(s) to ${props.characterName}`
    emit('refresh')
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || `Failed after ${count} titles`
  } finally {
    actionLoading.value = null
  }
}
</script>

<template>
  <div class="title-editor">
    <h3 class="editor-card__title">👑 Titles</h3>

    <UiMessage v-if="error" type="error" :message="error" />
    <UiMessage v-if="success" type="success" :message="success" />

    <!-- Active title selector -->
    <div class="chosen-title">
      <label class="chosen-title__label">Active Title:</label>
      <div class="chosen-title__controls">
        <UiSelect
          :model-value="chosenTitle"
          :options="chosenTitleOptions"
          placeholder="No title"
          @update:model-value="setChosenTitle($event as number)"
        />
        <span
          v-if="actionLoading === 'chosen'"
          class="loading-spinner"
        >⏳</span>
      </div>
    </div>

    <!-- Bulk actions & filter -->
    <div class="title-toolbar">
      <div class="title-toolbar__filters">
        <button
          class="filter-btn"
          :class="{ 'filter-btn--active': filterMode === 'all' }"
          @click="filterMode = 'all'"
        >All ({{ titleStates.length }})</button>
        <button
          class="filter-btn"
          :class="{ 'filter-btn--active': filterMode === 'known' }"
          @click="filterMode = 'known'"
        >Known ({{ knownCount }})</button>
        <button
          class="filter-btn"
          :class="{ 'filter-btn--active': filterMode === 'unknown' }"
          @click="filterMode = 'unknown'"
        >Unknown ({{ titleStates.length - knownCount }})</button>
      </div>
      <UiButton
        size="sm"
        :loading="actionLoading === 'grantAll'"
        :disabled="knownCount >= titleStates.length"
        @click="grantAllTitles"
      >
        Grant All
      </UiButton>
    </div>

    <!-- Custom title ID -->
    <div class="custom-title">
      <UiInput
        v-model="customTitleId"
        type="number"
        :min="1"
        placeholder="Custom title ID"
      />
      <UiButton
        size="sm"
        :loading="actionLoading === 'custom'"
        :disabled="!customTitleId || customTitleId < 1"
        @click="addCustomTitle"
      >
        Add
      </UiButton>
    </div>

    <!-- Title list -->
    <div class="title-list">
      <div
        v-for="title in filteredTitles"
        :key="title.id"
        class="title-row"
        :class="{ 'title-row--known': title.known }"
      >
        <div class="title-row__info">
          <span class="title-row__name">{{ title.name }}</span>
          <span class="title-row__id">#{{ title.id }}</span>
        </div>
        <div class="title-row__actions">
          <UiBadge
            v-if="title.known && chosenTitle === title.id"
            variant="info"
          >Active</UiBadge>
          <UiButton
            :size="'sm'"
            :variant="title.known ? 'danger' : 'primary'"
            :loading="actionLoading === title.id"
            @click="toggleTitle(title.id, title.known)"
          >
            {{ title.known ? 'Remove' : 'Add' }}
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.title-editor {
  @include card-base;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.chosen-title {
  display: flex;
  align-items: center;
  gap: $spacing-3;

  &__label {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $text-secondary;
    white-space: nowrap;
  }

  &__controls {
    display: flex;
    gap: $spacing-2;
    align-items: center;
    flex: 1;
  }
}

.title-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-3;
  flex-wrap: wrap;

  &__filters {
    display: flex;
    gap: $spacing-1;
  }
}

.filter-btn {
  background: $bg-primary;
  border: 1px solid $border-primary;
  border-radius: $radius-sm;
  padding: $spacing-1 $spacing-2;
  font-size: $font-size-xs;
  color: $text-muted;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    border-color: $blue-light;
    color: $text-primary;
  }

  &--active {
    background: rgba($blue-light, 0.1);
    border-color: $blue-light;
    color: $text-primary;
  }
}

.custom-title {
  display: flex;
  gap: $spacing-2;
  align-items: flex-start;
}

.title-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  max-height: 400px;
  overflow-y: auto;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-2 $spacing-3;
  background: $bg-primary;
  border-radius: $radius-sm;
  font-size: $font-size-sm;

  &--known {
    border-left: 3px solid $success-light;
  }

  &__info {
    display: flex;
    align-items: center;
    gap: $spacing-2;
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

  &__id {
    font-size: $font-size-xs;
    color: $text-muted;
    font-family: monospace;
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    gap: $spacing-2;
    align-items: center;
    flex-shrink: 0;
  }
}

.loading-spinner {
  font-size: $font-size-lg;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
