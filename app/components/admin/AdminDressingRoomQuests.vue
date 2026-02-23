<script setup lang="ts">
/**
 * AdminDressingRoomQuests - Quest completion sub-component
 * Search quests and mark them as completed for a character
 */
import UiButton from '~/components/ui/UiButton.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import UiBadge from '~/components/ui/UiBadge.vue'

const props = defineProps<{
  guid: number
  realmId: string | number
  characterName: string
}>()

interface Quest {
  id: number
  name: string
  level: number
  minLevel: number
  completed: boolean
}

const searchQuery = ref('')
const searchResults = ref<Quest[]>([])
const searching = ref(false)
const error = ref('')
const success = ref('')
const actionLoading = ref(false)
const selectedQuests = ref<Quest[]>([])

let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (query: string) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!query || query.length < 2) {
    searchResults.value = []
    return
  }
  searchTimeout = setTimeout(() => searchQuests(), 300)
})

async function searchQuests() {
  if (!searchQuery.value || searchQuery.value.length < 2) return
  searching.value = true
  error.value = ''

  try {
    const data = await $fetch<{ quests: Quest[] }>('/api/admin/dressingroom/quest-search', {
      query: {
        q: searchQuery.value,
        realmId: props.realmId,
        guid: props.guid,
      },
    })
    searchResults.value = data.quests || []
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || 'Failed to search quests'
  } finally {
    searching.value = false
  }
}

function addQuest(quest: Quest) {
  if (quest.completed) return
  if (selectedQuests.value.some(q => q.id === quest.id)) return
  selectedQuests.value.push({ ...quest })
}

function removeQuest(index: number) {
  selectedQuests.value.splice(index, 1)
}

async function completeQuests() {
  if (selectedQuests.value.length === 0) return

  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/complete-quest', {
      method: 'POST',
      body: {
        guid: props.guid,
        realmId: props.realmId,
        questIds: selectedQuests.value.map(q => q.id),
      },
    })
    success.value = data.message
    selectedQuests.value = []
    // Re-search to update completion status
    if (searchQuery.value.length >= 2) {
      await searchQuests()
    }
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || 'Failed to complete quests'
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="quest-editor">
    <h3 class="editor-card__title">📜 Quests</h3>

    <UiMessage v-if="error" variant="error">{{ error }}</UiMessage>
    <UiMessage v-if="success" variant="success">{{ success }}</UiMessage>

    <p class="form-hint">Search by quest name or ID, then select quests to mark as completed.</p>

    <!-- Search -->
    <div class="quest-search">
      <UiInput
        v-model="searchQuery"
        type="text"
        placeholder="Search quests by name or ID..."
      />
      <span v-if="searching" class="search-spinner">⏳</span>
    </div>

    <!-- Search results -->
    <div v-if="searchResults.length > 0" class="quest-results">
      <div
        v-for="quest in searchResults"
        :key="quest.id"
        class="quest-result"
        :class="{ 'quest-result--completed': quest.completed, 'quest-result--selected': selectedQuests.some(q => q.id === quest.id) }"
        @click="addQuest(quest)"
      >
        <div class="quest-result__info">
          <span class="quest-result__name">{{ quest.name }}</span>
          <span class="quest-result__meta">
            ID: {{ quest.id }}
            <span v-if="quest.level > 0">· Level {{ quest.level }}</span>
            <span v-if="quest.minLevel > 0">· Min {{ quest.minLevel }}</span>
          </span>
        </div>
        <UiBadge v-if="quest.completed" variant="success">Done</UiBadge>
        <UiBadge v-else-if="selectedQuests.some(q => q.id === quest.id)" variant="info">Selected</UiBadge>
      </div>
    </div>
    <p v-else-if="searchQuery.length >= 2 && !searching" class="empty-hint">No quests found</p>

    <!-- Selected quests -->
    <div v-if="selectedQuests.length > 0" class="selected-quests">
      <h4 class="subsection-title">Selected Quests ({{ selectedQuests.length }})</h4>
      <div
        v-for="(quest, index) in selectedQuests"
        :key="quest.id"
        class="selected-quest"
      >
        <span class="selected-quest__name">{{ quest.name }}</span>
        <span class="selected-quest__id">#{{ quest.id }}</span>
        <button type="button" class="selected-quest__remove" @click="removeQuest(index)">✕</button>
      </div>
      <UiButton
        size="sm"
        :loading="actionLoading"
        @click="completeQuests"
      >
        📜 Complete {{ selectedQuests.length }} Quest(s)
      </UiButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.quest-editor {
  @include card-base;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.form-hint {
  font-size: $font-size-xs;
  color: $text-muted;
  margin: 0;
}

.quest-search {
  position: relative;

  .search-spinner {
    position: absolute;
    right: $spacing-3;
    top: 50%;
    transform: translateY(-50%);
    font-size: $font-size-lg;
    animation: spin 1s linear infinite;
  }
}

.quest-results {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  max-height: 300px;
  overflow-y: auto;
}

.quest-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-2 $spacing-3;
  background: $bg-primary;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: background $transition-fast;

  &:hover:not(&--completed) {
    background: rgba($blue-light, 0.05);
  }

  &--completed {
    opacity: 0.5;
    cursor: default;
  }

  &--selected {
    border-left: 3px solid $blue-light;
  }

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
    font-size: $font-size-sm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    font-size: $font-size-xs;
    color: $text-muted;
  }
}

.selected-quests {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding-top: $spacing-3;
  border-top: 1px solid $border-primary;
}

.subsection-title {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $text-secondary;
  margin: 0;
}

.selected-quest {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-2 $spacing-3;
  background: $bg-primary;
  border-radius: $radius-sm;
  border-left: 3px solid $blue-light;

  &__name {
    flex: 1;
    color: $text-primary;
    font-weight: $font-weight-medium;
    font-size: $font-size-sm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__id {
    font-size: $font-size-xs;
    color: $text-muted;
    font-family: monospace;
  }

  &__remove {
    background: none;
    border: none;
    color: $error-light;
    font-size: $font-size-sm;
    cursor: pointer;
    padding: $spacing-1;
    border-radius: $radius-sm;
    line-height: 1;
    transition: background $transition-fast;

    &:hover { background: rgba($error-light, 0.1); }
  }
}

.empty-hint {
  font-size: $font-size-sm;
  color: $text-muted;
  font-style: italic;
  margin: 0;
}

@keyframes spin {
  from { transform: translateY(-50%) rotate(0deg); }
  to { transform: translateY(-50%) rotate(360deg); }
}
</style>
