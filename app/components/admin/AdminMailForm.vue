<script setup lang="ts">
/**
 * AdminMailForm - Send items and/or money via in-game mail form
 * Features:
 * - Multiple items support (up to 12)
 * - Item search with autocomplete
 * - Money (gold/silver/copper) support
 * - Quality-colored item display
 */

import UiFormGroup from '~/components/ui/UiFormGroup.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import { getQualityColor, getQualityName } from '~/utils/wow'

export interface RealmOption {
  id: string
  name: string
}

export interface MailItem {
  itemId: number
  itemCount: number
  name?: string
  quality?: number
}

export interface MailFormData {
  characterName: string
  items: MailItem[]
  money: number // in copper
  subject: string
  body: string
  realmId: string
}

export interface SearchItem {
  id: number
  name: string
  quality: number
  itemLevel: number
  requiredLevel: number
  stackable: number
}

export interface Props {
  realms: RealmOption[]
  loading?: boolean
  error?: string
  success?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [data: MailFormData]
}>()

// Form state
const characterName = ref('')
const realmId = ref('')
const subject = ref('GM Mail')
const mailBody = ref('')

// Money state (separate fields for UX)
const goldAmount = ref<number | null>(null)
const silverAmount = ref<number | null>(null)
const copperAmount = ref<number | null>(null)

// Items state
const selectedItems = ref<MailItem[]>([])

// Item search state
const searchQuery = ref('')
const searchResults = ref<SearchItem[]>([])
const isSearching = ref(false)
const showSearchDropdown = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Computed total money in copper
const totalMoney = computed(() => {
  const gold = (goldAmount.value || 0) * 10000
  const silver = (silverAmount.value || 0) * 100
  const copper = copperAmount.value || 0
  return gold + silver + copper
})

// Computed form validity
const isValid = computed(() => {
  return (
    characterName.value.trim() &&
    realmId.value &&
    (selectedItems.value.length > 0 || totalMoney.value > 0)
  )
})

// Search items when query changes
watch(searchQuery, (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)

  if (!query || query.length < 2 || !realmId.value) {
    searchResults.value = []
    showSearchDropdown.value = false
    return
  }

  searchTimeout = setTimeout(async () => {
    await searchItems(query)
  }, 300)
})

async function searchItems(query: string) {
  if (!realmId.value) return

  isSearching.value = true
  try {
    const response = await $fetch<{ items: SearchItem[] }>('/api/admin/items/search', {
      query: {
        q: query,
        realmId: realmId.value,
        limit: 50,
      },
    })
    searchResults.value = response.items || []
    showSearchDropdown.value = searchResults.value.length > 0
  } catch (error) {
    console.error('Item search failed:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

function selectItem(item: SearchItem) {
  if (selectedItems.value.length >= 12) {
    alert('Maximum 12 items per mail')
    return
  }

  // Check if item already added
  const existing = selectedItems.value.find(i => i.itemId === item.id)
  if (existing) {
    // Increment count instead
    existing.itemCount = Math.min(existing.itemCount + 1, item.stackable || 1000)
  } else {
    selectedItems.value.push({
      itemId: item.id,
      itemCount: 1,
      name: item.name,
      quality: item.quality,
    })
  }

  // Clear search
  searchQuery.value = ''
  searchResults.value = []
  showSearchDropdown.value = false
}

function removeItem(index: number) {
  selectedItems.value.splice(index, 1)
}

function updateItemCount(index: number, count: number) {
  const item = selectedItems.value[index]
  if (!item) return

  if (count < 1) {
    removeItem(index)
  } else {
    item.itemCount = Math.min(count, 1000)
  }
}

function handleSubmit() {
  if (!isValid.value) return

  emit('submit', {
    characterName: characterName.value.trim(),
    items: selectedItems.value.map(i => ({
      itemId: i.itemId,
      itemCount: i.itemCount,
    })),
    money: totalMoney.value,
    subject: subject.value,
    body: mailBody.value,
    realmId: realmId.value,
  })
}

// Reset form after successful submission
watch(() => props.success, (newSuccess) => {
  if (newSuccess) {
    characterName.value = ''
    realmId.value = ''
    subject.value = 'GM Mail'
    mailBody.value = ''
    goldAmount.value = null
    silverAmount.value = null
    copperAmount.value = null
    selectedItems.value = []
    searchQuery.value = ''
  }
})

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.item-search')) {
    showSearchDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="mail-form-section">
    <h3 class="mail-form-section__title">📧 Send Mail</h3>
    <p class="mail-form-section__description">Send items and/or gold to a character via in-game mail.</p>

    <form class="mail-form" @submit.prevent="handleSubmit">
      <!-- Character & Realm -->
      <div class="form-row">
        <UiFormGroup label="Character Name" html-for="mail-character" required>
          <UiInput
            id="mail-character"
            v-model="characterName"
            type="text"
            placeholder="Enter character name"
            required
          />
        </UiFormGroup>

        <UiFormGroup label="Realm" html-for="mail-realm" required>
          <UiSelect
            id="mail-realm"
            v-model="realmId"
            :options="realms.map(r => ({ value: r.id, label: r.name }))"
            placeholder="Select realm"
            required
          />
        </UiFormGroup>
      </div>

      <!-- Item Search -->
      <UiFormGroup
        label="Add Items"
        html-for="mail-item-search"
        :hint="`Search by name. ${selectedItems.length}/12 items added.`"
      >
        <div class="item-search">
          <div class="item-search__input-wrapper">
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              class="item-search__input"
              placeholder="Search items by name..."
              :disabled="!realmId"
              @focus="showSearchDropdown = searchResults.length > 0"
            />
            <span v-if="isSearching" class="item-search__loading">⏳</span>
          </div>

          <!-- Search Results Dropdown -->
          <div v-if="showSearchDropdown" class="item-search__dropdown">
            <div
              v-for="item in searchResults"
              :key="item.id"
              class="item-search__result"
              :style="{ '--quality-color': getQualityColor(item.quality) }"
              @click="selectItem(item)"
            >
              <span class="item-search__name">{{ item.name }}</span>
              <span class="item-search__meta">
                <span class="item-search__quality">{{ getQualityName(item.quality) }}</span>
                <span class="item-search__id">ID: {{ item.id }}</span>
                <span v-if="item.itemLevel" class="item-search__ilvl">iLvl {{ item.itemLevel }}</span>
              </span>
            </div>
            <div v-if="searchResults.length === 0 && !isSearching" class="item-search__empty">
              No items found
            </div>
          </div>
        </div>
      </UiFormGroup>

      <!-- Selected Items List -->
      <div v-if="selectedItems.length > 0" class="selected-items">
        <div class="selected-items__header">
          <span>Selected Items ({{ selectedItems.length }})</span>
          <button type="button" class="selected-items__clear" @click="selectedItems = []">
            Clear all
          </button>
        </div>
        <div class="selected-items__list">
          <div
            v-for="(item, index) in selectedItems"
            :key="item.itemId"
            class="selected-item"
            :style="{ '--quality-color': getQualityColor(item.quality || 1) }"
          >
            <span class="selected-item__name">{{ item.name || `Item #${item.itemId}` }}</span>
            <div class="selected-item__controls">
              <input
                type="number"
                class="selected-item__count"
                :value="item.itemCount"
                min="1"
                max="1000"
                @input="updateItemCount(index, parseInt(($event.target as HTMLInputElement).value) || 1)"
              />
              <button type="button" class="selected-item__remove" @click="removeItem(index)">
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Money -->
      <UiFormGroup label="Money" html-for="mail-gold" hint="Optional: Send gold, silver, and/or copper">
        <div class="money-inputs">
          <div class="money-input">
            <UiInput
              id="mail-gold"
              v-model="goldAmount"
              type="number"
              placeholder="0"
              :min="0"
            />
            <span class="money-label money-label--gold">🪙 Gold</span>
          </div>
          <div class="money-input">
            <UiInput
              v-model="silverAmount"
              type="number"
              placeholder="0"
              :min="0"
              :max="99"
            />
            <span class="money-label money-label--silver">🥈 Silver</span>
          </div>
          <div class="money-input">
            <UiInput
              v-model="copperAmount"
              type="number"
              placeholder="0"
              :min="0"
              :max="99"
            />
            <span class="money-label money-label--copper">🥉 Copper</span>
          </div>
        </div>
      </UiFormGroup>

      <!-- Subject & Body -->
      <UiFormGroup label="Mail Subject" html-for="mail-subject">
        <UiInput
          id="mail-subject"
          v-model="subject"
          type="text"
          placeholder="GM Mail"
        />
      </UiFormGroup>

      <UiFormGroup label="Mail Body" html-for="mail-body">
        <UiTextarea
          id="mail-body"
          v-model="mailBody"
          placeholder="Message to player..."
          :rows="4"
          :maxlength="8000"
        />
      </UiFormGroup>

      <!-- Summary & Submit -->
      <div class="mail-form__summary">
        <div v-if="selectedItems.length > 0" class="summary-line">
          📦 {{ selectedItems.length }} item(s)
        </div>
        <div v-if="totalMoney > 0" class="summary-line">
          💰 {{ Math.floor(totalMoney / 10000) }}g {{ Math.floor((totalMoney % 10000) / 100) }}s {{ totalMoney % 100 }}c
        </div>
      </div>

      <div class="mail-form__actions">
        <UiButton type="submit" :loading="loading" :disabled="!isValid">
          📧 Send Mail
        </UiButton>
      </div>

      <UiMessage v-if="error" variant="error">{{ error }}</UiMessage>
      <UiMessage v-if="success" variant="success">{{ success }}</UiMessage>
    </form>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.mail-form-section {
  @include card-base;
  margin-bottom: $spacing-8;

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0 0 $spacing-2;
  }

  &__description {
    color: $text-secondary;
    font-size: $font-size-sm;
    margin: 0 0 $spacing-6;
  }
}

.mail-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;

  &__actions {
    margin-top: $spacing-2;
  }

  &__summary {
    display: flex;
    gap: $spacing-4;
    padding: $spacing-3 $spacing-4;
    background: $bg-tertiary;
    border-radius: $radius-md;
    font-size: $font-size-sm;
    color: $text-secondary;

    .summary-line {
      display: flex;
      align-items: center;
      gap: $spacing-2;
    }
  }
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: $spacing-4;
}

// Item Search
.item-search {
  position: relative;

  &__input-wrapper {
    position: relative;
  }

  &__input {
    width: 100%;
    padding: $spacing-3 $spacing-4;
    padding-right: $spacing-10;
    background: $bg-primary;
    border: 1px solid $border-primary;
    border-radius: $radius-lg;
    color: $text-primary;
    font-size: $font-size-base;
    font-family: inherit;
    transition: border-color $transition-base;

    &::placeholder {
      color: $text-muted;
    }

    &:focus {
      outline: none;
      border-color: $blue-light;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__loading {
    position: absolute;
    right: $spacing-3;
    top: 50%;
    transform: translateY(-50%);
    font-size: $font-size-lg;
    animation: spin 1s linear infinite;
  }

  &__dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 300px;
    overflow-y: auto;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    box-shadow: $shadow-lg;
    z-index: 100;
    margin-top: $spacing-1;
  }

  &__result {
    padding: $spacing-3 $spacing-4;
    cursor: pointer;
    border-left: 3px solid var(--quality-color, $text-primary);
    transition: background $transition-fast;

    &:hover {
      background: $bg-tertiary;
    }

    &:not(:last-child) {
      border-bottom: 1px solid $border-primary;
    }
  }

  &__name {
    display: block;
    color: var(--quality-color, $text-primary);
    font-weight: $font-weight-medium;
    margin-bottom: $spacing-1;
  }

  &__meta {
    display: flex;
    gap: $spacing-3;
    font-size: $font-size-xs;
    color: $text-muted;
  }

  &__quality {
    color: var(--quality-color, $text-secondary);
  }

  &__empty {
    padding: $spacing-4;
    text-align: center;
    color: $text-muted;
    font-size: $font-size-sm;
  }
}

// Selected Items
.selected-items {
  background: $bg-tertiary;
  border-radius: $radius-md;
  padding: $spacing-4;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-3;
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  &__clear {
    background: none;
    border: none;
    color: $error-light;
    font-size: $font-size-xs;
    cursor: pointer;
    padding: $spacing-1 $spacing-2;
    border-radius: $radius-sm;
    transition: background $transition-fast;

    &:hover {
      background: rgba($error-light, 0.1);
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }
}

.selected-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-2 $spacing-3;
  background: $bg-primary;
  border-radius: $radius-sm;
  border-left: 3px solid var(--quality-color, $text-primary);

  &__name {
    color: var(--quality-color, $text-primary);
    font-weight: $font-weight-medium;
    font-size: $font-size-sm;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: $spacing-2;
  }

  &__count {
    width: 60px;
    padding: $spacing-1 $spacing-2;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-sm;
    color: $text-primary;
    font-size: $font-size-sm;
    text-align: center;

    &:focus {
      outline: none;
      border-color: $blue-light;
    }
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

    &:hover {
      background: rgba($error-light, 0.1);
    }
  }
}

// Money Inputs
.money-inputs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-3;
}

.money-input {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.money-label {
  font-size: $font-size-xs;
  text-align: center;

  &--gold {
    color: #ffd700;
  }

  &--silver {
    color: #c0c0c0;
  }

  &--copper {
    color: #b87333;
  }
}

@keyframes spin {
  from {
    transform: translateY(-50%) rotate(0deg);
  }
  to {
    transform: translateY(-50%) rotate(360deg);
  }
}
</style>
