<script setup lang="ts">
/**
 * AdminDressingRoomTab - GM Dressing Room for character editing
 * Allows GMs to search characters and modify: items, money, professions, spells, level
 */
import UiButton from '~/components/ui/UiButton.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import UiFormGroup from '~/components/ui/UiFormGroup.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import AdminDressingRoomReputation from '~/components/admin/AdminDressingRoomReputation.vue'
import AdminDressingRoomQuests from '~/components/admin/AdminDressingRoomQuests.vue'
import AdminDressingRoomAchievements from '~/components/admin/AdminDressingRoomAchievements.vue'
import AdminDressingRoomTitles from '~/components/admin/AdminDressingRoomTitles.vue'
import { getClassName, getClassColor, getClassIcon, getRaceName, getRaceIcon } from '~/utils/wow'

export interface RealmOption {
  id: number | string
  name: string
}

export interface Props {
  realms: RealmOption[]
}

defineProps<Props>()

// Character search state
const searchQuery = ref('')
const searchRealmId = ref('')
const searchResults = ref<any[]>([])
const searching = ref(false)
const searchError = ref('')

// Selected character state
const selectedCharacter = ref<any | null>(null)
const characterDetail = ref<any | null>(null)
const loadingDetail = ref(false)

// Action states
const actionLoading = ref(false)
const actionError = ref('')
const actionSuccess = ref('')

// Money form
const goldAmount = ref<number | null>(null)
const silverAmount = ref<number | null>(null)
const copperAmount = ref<number | null>(null)
const moneyMode = ref<'set' | 'add' | 'remove'>('set')

// Level form
const newLevel = ref<number | null>(null)

// Item form
const itemSearchQuery = ref('')
const itemSearchResults = ref<any[]>([])
const isSearchingItems = ref(false)
const showItemDropdown = ref(false)
const selectedItems = ref<Array<{ itemId: number; count: number; name: string; quality: number }>>([])

// Spell form
const spellIdInput = ref('')
const spellSearchQuery = ref('')
const spellSearchResults = ref<Array<{ id: number; name: string; rank: string; description: string }>>([])
const isSearchingSpells = ref(false)
const showSpellDropdown = ref(false)
const selectedSpells = ref<Array<{ id: number; name: string; rank: string }>>([])

// Profession form
const professionSkillId = ref<number | null>(null)
const professionValue = ref<number | null>(null)
const professionMax = ref<number | null>(null)

const PROFESSIONS = [
  { value: 164, label: 'Blacksmithing' },
  { value: 165, label: 'Leatherworking' },
  { value: 171, label: 'Alchemy' },
  { value: 182, label: 'Herbalism' },
  { value: 186, label: 'Mining' },
  { value: 197, label: 'Tailoring' },
  { value: 202, label: 'Engineering' },
  { value: 333, label: 'Enchanting' },
  { value: 393, label: 'Skinning' },
  { value: 755, label: 'Jewelcrafting' },
  { value: 773, label: 'Inscription' },
  { value: 129, label: 'First Aid' },
  { value: 185, label: 'Cooking' },
  { value: 356, label: 'Fishing' },
]

const SLOT_NAMES: Record<number, string> = {
  0: 'Head', 1: 'Neck', 2: 'Shoulder', 3: 'Shirt', 4: 'Chest',
  5: 'Waist', 6: 'Legs', 7: 'Feet', 8: 'Wrists', 9: 'Hands',
  10: 'Ring 1', 11: 'Ring 2', 12: 'Trinket 1', 13: 'Trinket 2',
  14: 'Back', 15: 'Main Hand', 16: 'Off Hand', 17: 'Ranged', 18: 'Tabard',
}

const QUALITY_COLORS: Record<number, string> = {
  0: '#9d9d9d', 1: '#ffffff', 2: '#1eff00', 3: '#0070dd',
  4: '#a335ee', 5: '#ff8000', 6: '#e6cc80', 7: '#00ccff',
}

// Search characters
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (query: string) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!query || query.length < 2) {
    searchResults.value = []
    return
  }
  searchTimeout = setTimeout(() => searchCharacters(), 300)
})

async function searchCharacters() {
  if (!searchQuery.value || searchQuery.value.length < 2) return
  searching.value = true
  searchError.value = ''

  try {
    const params: Record<string, string> = { search: searchQuery.value }
    if (searchRealmId.value) params.realmId = searchRealmId.value

    const data = await $fetch<{ characters: any[] }>('/api/admin/dressingroom/characters', {
      query: params,
    })
    searchResults.value = data.characters || []
  } catch (error: any) {
    searchError.value = error.data?.statusMessage || 'Search failed'
  } finally {
    searching.value = false
  }
}

async function selectCharacter(char: any) {
  selectedCharacter.value = char
  searchResults.value = []
  searchQuery.value = ''
  await loadCharacterDetail(char.guid, char.realmId)
}

async function loadCharacterDetail(guid: number, realmId: string) {
  loadingDetail.value = true
  actionError.value = ''
  actionSuccess.value = ''

  try {
    const data = await $fetch<any>(`/api/admin/dressingroom/character/${guid}/${realmId}`)
    characterDetail.value = data

    // Pre-fill money fields
    const money = data.character.money || 0
    goldAmount.value = Math.floor(money / 10000)
    silverAmount.value = Math.floor((money % 10000) / 100)
    copperAmount.value = money % 100

    newLevel.value = data.character.level
  } catch (error: any) {
    actionError.value = error.data?.statusMessage || 'Failed to load character details'
    characterDetail.value = null
  } finally {
    loadingDetail.value = false
  }
}

function deselectCharacter() {
  selectedCharacter.value = null
  characterDetail.value = null
  selectedItems.value = []
  actionError.value = ''
  actionSuccess.value = ''
}

// Money Management
const totalCopper = computed(() => {
  return (goldAmount.value || 0) * 10000 + (silverAmount.value || 0) * 100 + (copperAmount.value || 0)
})

async function setMoney() {
  if (!selectedCharacter.value) return
  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/modify-money', {
      method: 'POST',
      body: {
        guid: selectedCharacter.value.guid,
        realmId: selectedCharacter.value.realmId,
        money: totalCopper.value,
        mode: moneyMode.value,
      },
    })
    actionSuccess.value = data.message
    await refreshCharacter()
  } catch (error: any) {
    actionError.value = error.data?.statusMessage || 'Failed to set money'
  } finally {
    actionLoading.value = false
  }
}

// Level Management
async function setLevel() {
  if (!selectedCharacter.value || !newLevel.value) return
  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/set-level', {
      method: 'POST',
      body: {
        guid: selectedCharacter.value.guid,
        realmId: selectedCharacter.value.realmId,
        level: newLevel.value,
      },
    })
    actionSuccess.value = data.message
    await refreshCharacter()
  } catch (error: any) {
    actionError.value = error.data?.statusMessage || 'Failed to set level'
  } finally {
    actionLoading.value = false
  }
}

// Item Management
let itemSearchTimeout: ReturnType<typeof setTimeout> | null = null

watch(itemSearchQuery, (query: string) => {
  if (itemSearchTimeout) clearTimeout(itemSearchTimeout)
  if (!query || query.length < 2 || !selectedCharacter.value) {
    itemSearchResults.value = []
    showItemDropdown.value = false
    return
  }
  itemSearchTimeout = setTimeout(() => searchItems(query), 300)
})

async function searchItems(query: string) {
  if (!selectedCharacter.value) return
  isSearchingItems.value = true
  try {
    const response = await $fetch<{ items: any[] }>('/api/admin/items/search', {
      query: {
        q: query,
        realmId: selectedCharacter.value.realmId,
        limit: 30,
      },
    })
    itemSearchResults.value = response.items || []
    showItemDropdown.value = itemSearchResults.value.length > 0
  } catch {
    itemSearchResults.value = []
  } finally {
    isSearchingItems.value = false
  }
}

function addItem(item: any) {
  const existing = selectedItems.value.find((i: any) => i.itemId === item.id)
  if (existing) {
    existing.count++
  } else {
    selectedItems.value.push({
      itemId: item.id,
      count: 1,
      name: item.name,
      quality: item.quality,
    })
  }
  itemSearchQuery.value = ''
  showItemDropdown.value = false
}

function removeItem(index: number) {
  selectedItems.value.splice(index, 1)
}

async function sendItems() {
  if (!selectedCharacter.value || selectedItems.value.length === 0) return
  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/add-item', {
      method: 'POST',
      body: {
        guid: selectedCharacter.value.guid,
        realmId: selectedCharacter.value.realmId,
        items: selectedItems.value.map((i: any) => ({ itemId: i.itemId, count: i.count })),
      },
    })
    actionSuccess.value = data.message
    selectedItems.value = []
    await refreshCharacter()
  } catch (error: any) {
    actionError.value = error.data?.statusMessage || 'Failed to add items'
  } finally {
    actionLoading.value = false
  }
}

// Spell Management
let spellSearchTimeout: ReturnType<typeof setTimeout> | null = null

watch(spellSearchQuery, (query: string) => {
  if (spellSearchTimeout) clearTimeout(spellSearchTimeout)
  if (!query || query.length < 2 || !selectedCharacter.value) {
    spellSearchResults.value = []
    showSpellDropdown.value = false
    return
  }
  spellSearchTimeout = setTimeout(() => searchSpells(query), 300)
})

async function searchSpells(query: string) {
  if (!selectedCharacter.value) return
  isSearchingSpells.value = true
  try {
    const response = await $fetch<{ spells: Array<{ id: number; name: string; rank: string; description: string }> }>('/api/admin/dressingroom/spell-search', {
      query: { q: query, limit: 30 },
    })
    spellSearchResults.value = response.spells || []
    showSpellDropdown.value = spellSearchResults.value.length > 0
  } catch {
    spellSearchResults.value = []
  } finally {
    isSearchingSpells.value = false
  }
}

function addSpell(spell: { id: number; name: string; rank: string }) {
  if (selectedSpells.value.some(s => s.id === spell.id)) return
  selectedSpells.value.push({ id: spell.id, name: spell.name, rank: spell.rank })
  spellSearchQuery.value = ''
  showSpellDropdown.value = false
}

function removeSpell(index: number) {
  selectedSpells.value.splice(index, 1)
}

async function teachSpells() {
  if (!selectedCharacter.value) return

  // Combine manual IDs and selected spells
  const manualIds = spellIdInput.value
    .split(/[\s,;]+/)
    .map((s: string) => parseInt(s.trim()))
    .filter((n: number) => !isNaN(n) && n > 0)

  const searchIds = selectedSpells.value.map(s => s.id)
  const allIds = [...new Set([...manualIds, ...searchIds])]

  if (allIds.length === 0) {
    actionError.value = 'Enter spell IDs or search and select spells'
    return
  }

  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/teach-spell', {
      method: 'POST',
      body: {
        guid: selectedCharacter.value.guid,
        realmId: selectedCharacter.value.realmId,
        spellIds: allIds,
      },
    })
    actionSuccess.value = data.message
    spellIdInput.value = ''
    selectedSpells.value = []
    await refreshCharacter()
  } catch (error: any) {
    actionError.value = error.data?.statusMessage || 'Failed to teach spells'
  } finally {
    actionLoading.value = false
  }
}

// Profession Management
async function setProfession() {
  if (!selectedCharacter.value || !professionSkillId.value) return
  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/set-profession', {
      method: 'POST',
      body: {
        guid: selectedCharacter.value.guid,
        realmId: selectedCharacter.value.realmId,
        skillId: professionSkillId.value,
        value: professionValue.value || 0,
        max: professionMax.value || 0,
      },
    })
    actionSuccess.value = data.message
    await refreshCharacter()
  } catch (error: any) {
    actionError.value = error.data?.statusMessage || 'Failed to set profession'
  } finally {
    actionLoading.value = false
  }
}

async function refreshCharacter() {
  if (!selectedCharacter.value) return
  await loadCharacterDetail(selectedCharacter.value.guid, selectedCharacter.value.realmId)
}

function formatMoney(copper: number): string {
  const gold = Math.floor(copper / 10000)
  const silver = Math.floor((copper % 10000) / 100)
  const c = copper % 100
  const parts: string[] = []
  if (gold > 0) parts.push(`${gold}g`)
  if (silver > 0) parts.push(`${silver}s`)
  if (c > 0 || parts.length === 0) parts.push(`${c}c`)
  return parts.join(' ')
}

// Click outside to close item dropdown
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.item-search')) {
    showItemDropdown.value = false
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
  <div class="dressing-room">
    <!-- Global feedback -->
    <UiMessage v-if="actionError" variant="error" dismissible @dismiss="actionError = ''">
      {{ actionError }}
    </UiMessage>
    <UiMessage v-if="actionSuccess" variant="success" dismissible @dismiss="actionSuccess = ''">
      {{ actionSuccess }}
    </UiMessage>

    <!-- Character Search -->
    <div v-if="!selectedCharacter" class="search-section">
      <UiSectionHeader
        title="Search Character"
        subtitle="Find a character by name or GUID to edit"
      />

      <div class="search-bar">
        <div class="search-bar__input">
          <UiInput
            v-model="searchQuery"
            type="text"
            placeholder="Search by character name or GUID..."
          />
        </div>
        <UiButton :loading="searching" @click="searchCharacters">
          🔍 Search
        </UiButton>
      </div>

      <UiMessage v-if="searchError" variant="error">{{ searchError }}</UiMessage>

      <!-- Search Results -->
      <div v-if="searchResults.length > 0" class="search-results">
        <div
          v-for="char in searchResults"
          :key="`${char.guid}-${char.realmId}`"
          class="character-result"
          @click="selectCharacter(char)"
        >
          <div class="character-result__icon" :style="{ color: getClassColor(char.class) }">
            {{ getClassIcon(char.class) }}
          </div>
          <div class="character-result__info">
            <span class="character-result__name" :style="{ color: getClassColor(char.class) }">
              {{ char.name }}
            </span>
            <span class="character-result__meta">
              Level {{ char.level }} {{ getRaceName(char.race) }} {{ getClassName(char.class) }}
              · {{ char.realmName }}
              · {{ formatMoney(char.money) }}
            </span>
          </div>
          <div class="character-result__status">
            <UiBadge :variant="char.online ? 'online' : 'offline'" size="sm">
              {{ char.online ? 'Online' : 'Offline' }}
            </UiBadge>
          </div>
        </div>
      </div>

      <div v-else-if="searchQuery.length >= 2 && !searching" class="no-results">
        No characters found
      </div>
    </div>

    <!-- Character Editor -->
    <div v-else class="editor-section">
      <!-- Character Header -->
      <div class="character-header">
        <UiButton variant="ghost" size="sm" @click="deselectCharacter">
          ← Back to Search
        </UiButton>

        <div v-if="characterDetail" class="character-header__info">
          <span class="character-header__icon" :style="{ color: getClassColor(selectedCharacter.class) }">
            {{ getClassIcon(selectedCharacter.class) }}
          </span>
          <div class="character-header__details">
            <h2 class="character-header__name" :style="{ color: getClassColor(selectedCharacter.class) }">
              {{ selectedCharacter.name }}
            </h2>
            <span class="character-header__meta">
              Level {{ characterDetail.character.level }}
              {{ getRaceName(selectedCharacter.race) }}
              {{ getClassName(selectedCharacter.class) }}
              · {{ selectedCharacter.realmName }}
              · {{ formatMoney(characterDetail.character.money) }}
              · {{ characterDetail.spellCount }} spells
            </span>
          </div>
          <UiBadge :variant="selectedCharacter.online ? 'online' : 'offline'">
            {{ selectedCharacter.online ? 'Online' : 'Offline' }}
          </UiBadge>
          <UiButton variant="ghost" size="sm" :loading="loadingDetail" @click="refreshCharacter">
            🔄
          </UiButton>
        </div>
      </div>

      <UiLoadingState v-if="loadingDetail" message="Loading character details..." />

      <template v-if="characterDetail && !loadingDetail">
        <div class="editor-grid">
          <!-- Level & Money Column -->
          <div class="editor-column">
            <!-- Level -->
            <div class="editor-card">
              <h3 class="editor-card__title">⬆️ Level</h3>
              <div class="inline-form">
                <UiInput
                  v-model="newLevel"
                  type="number"
                  :min="1"
                  :max="80"
                  placeholder="1-80"
                />
                <UiButton
                  size="sm"
                  :loading="actionLoading"
                  :disabled="!newLevel || newLevel < 1 || newLevel > 80"
                  @click="setLevel"
                >
                  Set Level
                </UiButton>
              </div>
            </div>

            <!-- Money -->
            <div class="editor-card">
              <h3 class="editor-card__title">💰 Money</h3>
              <div class="money-form">
                <div class="money-mode">
                  <button
                    class="money-mode__btn"
                    :class="{ 'money-mode__btn--active': moneyMode === 'set' }"
                    @click="moneyMode = 'set'"
                  >
                    Set
                  </button>
                  <button
                    class="money-mode__btn"
                    :class="{ 'money-mode__btn--active': moneyMode === 'add' }"
                    @click="moneyMode = 'add'"
                  >
                    Add
                  </button>
                  <button
                    class="money-mode__btn money-mode__btn--remove"
                    :class="{ 'money-mode__btn--active': moneyMode === 'remove' }"
                    @click="moneyMode = 'remove'"
                  >
                    Remove
                  </button>
                </div>
                <div class="money-inputs">
                  <div class="money-field">
                    <UiInput v-model="goldAmount" type="number" :min="0" placeholder="0" />
                    <span class="money-label money-label--gold">🪙 Gold</span>
                  </div>
                  <div class="money-field">
                    <UiInput v-model="silverAmount" type="number" :min="0" :max="99" placeholder="0" />
                    <span class="money-label money-label--silver">🥈 Silver</span>
                  </div>
                  <div class="money-field">
                    <UiInput v-model="copperAmount" type="number" :min="0" :max="99" placeholder="0" />
                    <span class="money-label money-label--copper">🥉 Copper</span>
                  </div>
                </div>
                <UiButton size="sm" :loading="actionLoading" @click="setMoney">
                  {{ moneyMode === 'set' ? 'Set Money' : moneyMode === 'add' ? 'Add Money' : 'Remove Money' }}
                </UiButton>
                <p v-if="moneyMode !== 'set'" class="form-hint">
                  {{ moneyMode === 'add' ? 'Adds the entered amount to current gold' : 'Subtracts the entered amount from current gold (floor at 0)' }}
                </p>
              </div>
            </div>

            <!-- Professions -->
            <div class="editor-card">
              <h3 class="editor-card__title">🔨 Professions</h3>

              <!-- Current professions -->
              <div v-if="characterDetail.professions.length > 0" class="current-professions">
                <div
                  v-for="prof in characterDetail.professions"
                  :key="prof.skillId"
                  class="profession-row"
                >
                  <span class="profession-row__name">{{ prof.name }}</span>
                  <span class="profession-row__value">{{ prof.value }}/{{ prof.max }}</span>
                </div>
              </div>
              <p v-else class="empty-hint">No professions learned</p>

              <!-- Set profession form -->
              <div class="profession-form">
                <UiSelect
                  v-model="professionSkillId"
                  :options="PROFESSIONS"
                  placeholder="Select profession"
                />
                <div class="inline-form">
                  <UiInput
                    v-model="professionValue"
                    type="number"
                    :min="0"
                    :max="450"
                    placeholder="Current level"
                  />
                  <UiInput
                    v-model="professionMax"
                    type="number"
                    :min="0"
                    :max="450"
                    placeholder="Max level"
                  />
                  <UiButton
                    size="sm"
                    :loading="actionLoading"
                    :disabled="!professionSkillId"
                    @click="setProfession"
                  >
                    Set
                  </UiButton>
                </div>
                <p class="form-hint">Current = your progress (e.g. 375). Max = rank cap (75/150/225/300/375/450). Set both to 0 to remove.</p>
              </div>
            </div>
          </div>

          <!-- Items & Spells Column -->
          <div class="editor-column">
            <!-- Add Items -->
            <div class="editor-card">
              <h3 class="editor-card__title">📦 Add Items</h3>

              <div class="item-search">
                <div class="item-search__input-wrapper">
                  <input
                    v-model="itemSearchQuery"
                    type="text"
                    class="item-search__input"
                    placeholder="Search items by name..."
                    @focus="showItemDropdown = itemSearchResults.length > 0"
                  />
                  <span v-if="isSearchingItems" class="item-search__loading">⏳</span>
                </div>

                <div v-if="showItemDropdown" class="item-search__dropdown">
                  <div
                    v-for="item in itemSearchResults"
                    :key="item.id"
                    class="item-search__result"
                    :style="{ '--quality-color': QUALITY_COLORS[item.quality] || '#fff' }"
                    @click="addItem(item)"
                  >
                    <span class="item-search__name">{{ item.name }}</span>
                    <span class="item-search__meta">
                      ID: {{ item.id }}
                      <span v-if="item.itemLevel">· iLvl {{ item.itemLevel }}</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Selected Items -->
              <div v-if="selectedItems.length > 0" class="selected-items">
                <div
                  v-for="(item, index) in selectedItems"
                  :key="item.itemId"
                  class="selected-item"
                  :style="{ '--quality-color': QUALITY_COLORS[item.quality] || '#fff' }"
                >
                  <span class="selected-item__name">{{ item.name }}</span>
                  <div class="selected-item__controls">
                    <input
                      type="number"
                      class="selected-item__count"
                      :value="item.count"
                      min="1"
                      max="1000"
                      @input="item.count = parseInt(($event.target as HTMLInputElement).value) || 1"
                    />
                    <button type="button" class="selected-item__remove" @click="removeItem(index)">✕</button>
                  </div>
                </div>
                <UiButton size="sm" :loading="actionLoading" @click="sendItems">
                  📦 Send {{ selectedItems.length }} Item(s)
                </UiButton>
              </div>

              <!-- Current Equipment -->
              <div v-if="characterDetail.items.length > 0" class="current-items">
                <h4 class="subsection-title">Current Equipment</h4>
                <div class="equipment-list">
                  <div
                    v-for="item in characterDetail.items"
                    :key="item.slot"
                    class="equipment-row"
                    :style="{ '--quality-color': QUALITY_COLORS[item.quality] || '#fff' }"
                  >
                    <span class="equipment-row__slot">{{ SLOT_NAMES[item.slot] || `Slot ${item.slot}` }}</span>
                    <span class="equipment-row__name">{{ item.name }}</span>
                    <span class="equipment-row__ilvl">{{ item.itemLevel }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Teach Spells -->
            <div class="editor-card">
              <h3 class="editor-card__title">✨ Teach Spells</h3>
              <p class="form-hint">
                Search spells by name or enter IDs directly.
                Known spells: {{ characterDetail.spellCount }}
              </p>

              <!-- Spell Search -->
              <div class="spell-search">
                <div class="spell-search__input-wrapper">
                  <input
                    v-model="spellSearchQuery"
                    type="text"
                    class="spell-search__input"
                    placeholder="Search spells by name..."
                    @focus="showSpellDropdown = spellSearchResults.length > 0"
                  />
                  <span v-if="isSearchingSpells" class="spell-search__loading">⏳</span>
                </div>

                <div v-if="showSpellDropdown && spellSearchResults.length > 0" class="spell-search__dropdown">
                  <div
                    v-for="spell in spellSearchResults"
                    :key="spell.id"
                    class="spell-search__result"
                    @click="addSpell(spell)"
                  >
                    <span class="spell-search__name">
                      {{ spell.name }}
                      <span v-if="spell.rank" class="spell-search__rank">({{ spell.rank }})</span>
                    </span>
                    <span class="spell-search__meta">ID: {{ spell.id }}</span>
                  </div>
                </div>
              </div>

              <!-- Selected spells from search -->
              <div v-if="selectedSpells.length > 0" class="selected-spells">
                <div v-for="(spell, index) in selectedSpells" :key="spell.id" class="selected-spell">
                  <span class="selected-spell__name">{{ spell.name }}</span>
                  <span v-if="spell.rank" class="selected-spell__rank">({{ spell.rank }})</span>
                  <span class="selected-spell__id">#{{ spell.id }}</span>
                  <button type="button" class="selected-spell__remove" @click="removeSpell(index)">✕</button>
                </div>
              </div>

              <!-- Manual ID input -->
              <div class="spell-form">
                <UiInput
                  v-model="spellIdInput"
                  type="text"
                  placeholder="Or enter spell IDs: 48443, 48461, 53307"
                />
                <UiButton
                  size="sm"
                  :loading="actionLoading"
                  :disabled="!spellIdInput.trim() && selectedSpells.length === 0"
                  @click="teachSpells"
                >
                  ✨ Teach Spells
                </UiButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Extended Features -->
        <div class="extended-grid">
          <AdminDressingRoomReputation
            :guid="selectedCharacter.guid"
            :realm-id="selectedCharacter.realmId"
            :character-name="selectedCharacter.name"
          />
          <AdminDressingRoomQuests
            :guid="selectedCharacter.guid"
            :realm-id="selectedCharacter.realmId"
            :character-name="selectedCharacter.name"
          />
          <AdminDressingRoomAchievements
            :guid="selectedCharacter.guid"
            :realm-id="selectedCharacter.realmId"
            :character-name="selectedCharacter.name"
          />
          <AdminDressingRoomTitles
            :guid="selectedCharacter.guid"
            :realm-id="selectedCharacter.realmId"
            :character-name="selectedCharacter.name"
            :known-titles="characterDetail.character?.knownTitles || ''"
            :chosen-title="characterDetail.character?.chosenTitle || 0"
            @refresh="refreshCharacter"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.dressing-room {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

// Search Section
.search-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.search-bar {
  display: flex;
  gap: $spacing-3;
  align-items: flex-start;

  &__input {
    flex: 1;
  }
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.character-result {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-3 $spacing-4;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-lg;
  cursor: pointer;
  transition: all $transition-base;

  &:hover {
    border-color: $blue-light;
    background: rgba($blue-light, 0.05);
  }

  &__icon {
    font-size: $font-size-xl;
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
    min-width: 0;
  }

  &__name {
    font-weight: $font-weight-semibold;
    font-size: $font-size-base;
  }

  &__meta {
    color: $text-muted;
    font-size: $font-size-xs;
  }

  &__status {
    flex-shrink: 0;
  }
}

.no-results {
  text-align: center;
  padding: $spacing-8;
  color: $text-muted;
  font-size: $font-size-sm;
}

// Character Header
.character-header {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
  margin-bottom: $spacing-4;

  &__info {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    flex-wrap: wrap;
  }

  &__icon {
    font-size: $font-size-3xl;
  }

  &__details {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: $font-size-2xl;
    font-weight: $font-weight-bold;
    margin: 0;
  }

  &__meta {
    color: $text-secondary;
    font-size: $font-size-sm;
  }
}

// Editor Grid
.editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-6;

  @media (max-width: $breakpoint-lg) {
    grid-template-columns: 1fr;
  }
}

// Extended features grid (reputation, quests, achievements, titles)
.extended-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-6;
  margin-top: $spacing-6;

  @media (max-width: $breakpoint-lg) {
    grid-template-columns: 1fr;
  }
}

.editor-column {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-card {
  @include card-base;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;

  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0;
  }
}

// Inline form row
.inline-form {
  display: flex;
  gap: $spacing-2;
  align-items: flex-start;
}

// Money
.money-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.money-mode {
  display: flex;
  gap: $spacing-1;
  background: $bg-primary;
  border-radius: $radius-md;
  padding: 2px;

  &__btn {
    flex: 1;
    padding: $spacing-1 $spacing-2;
    border: none;
    background: transparent;
    color: $text-secondary;
    font-size: $font-size-xs;
    font-weight: 600;
    border-radius: $radius-sm;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      color: $text-primary;
      background: rgba(255, 255, 255, 0.05);
    }

    &--active {
      background: $color-accent;
      color: $text-primary;
    }

    &--remove.money-mode__btn--active {
      background: $color-danger;
    }
  }
}

.money-inputs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-3;
}

.money-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.money-label {
  font-size: $font-size-xs;
  text-align: center;

  &--gold { color: #ffd700; }
  &--silver { color: #c0c0c0; }
  &--copper { color: #b87333; }
}

// Professions
.current-professions {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  margin-bottom: $spacing-3;
}

.profession-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-2 $spacing-3;
  background: $bg-primary;
  border-radius: $radius-md;
  font-size: $font-size-sm;

  &__name {
    color: $text-primary;
    font-weight: $font-weight-medium;
  }

  &__value {
    color: $text-secondary;
    font-family: monospace;
  }
}

.profession-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.form-hint {
  font-size: $font-size-xs;
  color: $text-muted;
  margin: 0;
}

.empty-hint {
  font-size: $font-size-sm;
  color: $text-muted;
  font-style: italic;
  margin: 0;
}

// Item Search (reuse pattern from AdminMailForm)
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

    &::placeholder { color: $text-muted; }
    &:focus { outline: none; border-color: $blue-light; }
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
    max-height: 250px;
    overflow-y: auto;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    box-shadow: $shadow-lg;
    z-index: 100;
    margin-top: $spacing-1;
  }

  &__result {
    padding: $spacing-2 $spacing-3;
    cursor: pointer;
    border-left: 3px solid var(--quality-color, $text-primary);
    transition: background $transition-fast;

    &:hover { background: $bg-tertiary; }
    &:not(:last-child) { border-bottom: 1px solid $border-primary; }
  }

  &__name {
    display: block;
    color: var(--quality-color, $text-primary);
    font-weight: $font-weight-medium;
    font-size: $font-size-sm;
  }

  &__meta {
    font-size: $font-size-xs;
    color: $text-muted;
  }
}

// Selected Items
.selected-items {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  margin-top: $spacing-2;
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

    &:focus { outline: none; border-color: $blue-light; }
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

// Current Equipment
.current-items {
  margin-top: $spacing-4;
  padding-top: $spacing-4;
  border-top: 1px solid $border-primary;
}

.subsection-title {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $text-secondary;
  margin: 0 0 $spacing-2;
}

.equipment-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.equipment-row {
  display: grid;
  grid-template-columns: 100px 1fr 40px;
  gap: $spacing-2;
  padding: $spacing-1 $spacing-2;
  font-size: $font-size-xs;
  border-radius: $radius-sm;

  &:hover {
    background: rgba($text-secondary, 0.05);
  }

  &__slot {
    color: $text-muted;
    font-weight: $font-weight-medium;
  }

  &__name {
    color: var(--quality-color, $text-primary);
    font-weight: $font-weight-medium;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__ilvl {
    color: $text-muted;
    text-align: right;
  }
}

// Spell Search
.spell-search {
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

    &::placeholder { color: $text-muted; }
    &:focus { outline: none; border-color: $purple-primary; }
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
    max-height: 250px;
    overflow-y: auto;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    box-shadow: $shadow-lg;
    z-index: 100;
    margin-top: $spacing-1;
  }

  &__result {
    padding: $spacing-2 $spacing-3;
    cursor: pointer;
    transition: background $transition-fast;

    &:hover { background: $bg-tertiary; }
    &:not(:last-child) { border-bottom: 1px solid $border-primary; }
  }

  &__name {
    display: block;
    color: $purple-light;
    font-weight: $font-weight-medium;
    font-size: $font-size-sm;
  }

  &__rank {
    color: $text-muted;
    font-weight: $font-weight-normal;
    font-size: $font-size-xs;
  }

  &__meta {
    font-size: $font-size-xs;
    color: $text-muted;
  }
}

// Selected Spells
.selected-spells {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.selected-spell {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-1 $spacing-2;
  background: $bg-primary;
  border-radius: $radius-sm;
  border-left: 3px solid $purple-primary;

  &__name {
    color: $purple-light;
    font-weight: $font-weight-medium;
    font-size: $font-size-sm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  &__rank {
    color: $text-muted;
    font-size: $font-size-xs;
    flex-shrink: 0;
  }

  &__id {
    font-size: $font-size-xs;
    color: $text-muted;
    font-family: monospace;
    flex-shrink: 0;
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
    flex-shrink: 0;

    &:hover { background: rgba($error-light, 0.1); }
  }
}

// Spell form
.spell-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

@keyframes spin {
  from { transform: translateY(-50%) rotate(0deg); }
  to { transform: translateY(-50%) rotate(360deg); }
}
</style>
