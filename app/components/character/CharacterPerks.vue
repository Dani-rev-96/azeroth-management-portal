<script setup lang="ts">
/**
 * CharacterPerks — Data-driven perk container
 *
 * Renders all enabled perks grouped by category, driven entirely by the
 * server-side perk config (which reads the shared perk registry + env overrides).
 *
 * Each perk card is rendered from the config with a unified activation handler
 * that calls the generic /api/characters/activate-perk endpoint.
 *
 * Features:
 * - Level-based visibility: perks with requiredLevel > character level are hidden
 * - Collapsible groups for better navigation
 * - Online status polling for live online/offline feedback
 */
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import type { CharacterDetailResponse } from '~/types'
import { useCharactersStore } from '~/stores/characters'
import { useAuthStore } from '~/stores/auth'
import CharacterPerkCard from '~/components/character/CharacterPerkCard.vue'
import type { RollResult } from '~/components/character/CharacterPerkCard.vue'

const props = defineProps<{
  character: CharacterDetailResponse
  characterGuid: number
  realmId: string
}>()

const charactersStore = useCharactersStore()
const authStore = useAuthStore()

const canAccessPerks = computed(() => {
  const isOwner = !!charactersStore.getCharacter(props.characterGuid, props.realmId)
  const isGM = !!authStore.user?.isGM
  return isOwner || isGM
})

const isCharacterOnline = computed(() => {
  return charactersStore.isOnline(props.characterGuid, props.realmId)
})

// ── Online status polling (mirrors shop behaviour) ──
onMounted(() => {
  charactersStore.startOnlinePolling(30000)
})
onUnmounted(() => {
  charactersStore.stopOnlinePolling()
})

// ── Perk config from server (registry + env overrides) ──
const { data: perkConfig } = await useFetch('/api/characters/perk-config')

// ── Collapsible group state (collapsed by default) ──
const collapsedGroups = ref<Set<string>>(
  new Set(perkConfig.value?.groups?.map(g => g.id) ?? []),
)

function toggleGroup(groupId: string) {
  if (collapsedGroups.value.has(groupId)) {
    collapsedGroups.value.delete(groupId)
  } else {
    collapsedGroups.value.add(groupId)
  }
  // trigger reactivity on the Set
  collapsedGroups.value = new Set(collapsedGroups.value)
}

function isGroupCollapsed(groupId: string): boolean {
  return collapsedGroups.value.has(groupId)
}

// ── Daily usage from server ──
const { data: perkStatus, refresh: refreshStatus } = await useFetch('/api/characters/perk-status', {
  query: { characterGuid: props.characterGuid, realmId: props.realmId },
})

// ── Per-perk reactive state ──
interface PerkState {
  loading: boolean
  unlocked: boolean
  error: string
  successMessage: string
  lastRoll: RollResult | null
  usesToday: number
}

const perkStates = reactive<Record<string, PerkState>>({})

function getState(perkId: string): PerkState {
  if (!perkStates[perkId]) {
    perkStates[perkId] = {
      loading: false,
      unlocked: false,
      error: '',
      successMessage: '',
      lastRoll: null,
      usesToday: perkStatus.value?.usage?.[perkId] ?? 0,
    }
  }
  return perkStates[perkId]
}

// Sync usage counts when perkStatus refreshes
watch(() => perkStatus.value, (val) => {
  if (!val?.usage) return
  for (const [perkId, count] of Object.entries(val.usage)) {
    if (perkStates[perkId]) {
      perkStates[perkId].usesToday = count as number
    }
  }
}, { immediate: true })

// ── Unified activation handler ──
interface ActivateResponse {
  success: boolean
  message: string
  roll?: number
  diceSides?: number
  threshold?: number
  outcome?: 'success' | 'fail' | 'critfail'
  usesToday?: number
  dailyLimit?: number
}

async function activatePerk(perkId: string) {
  const state = getState(perkId)
  if (state.loading || state.unlocked) return

  state.loading = true
  state.error = ''

  try {
    const response = await $fetch<ActivateResponse>('/api/characters/activate-perk', {
      method: 'POST',
      body: {
        perkId,
        characterGuid: props.characterGuid,
        realmId: props.realmId,
      },
    })

    // Update usage count from server response
    if (response.usesToday != null) {
      state.usesToday = response.usesToday
    }

    // Set roll result if we have dice data
    if (response.outcome && response.roll != null && response.diceSides != null && response.threshold != null) {
      state.lastRoll = {
        roll: response.roll,
        diceSides: response.diceSides,
        threshold: response.threshold,
        outcome: response.outcome,
        message: response.message,
      }
    }

    if (response.success) {
      state.unlocked = true
      state.successMessage = response.message
    }
  } catch (err: any) {
    state.error = err?.data?.message || err?.statusMessage || err?.message || 'Failed to activate perk'
  } finally {
    state.loading = false
  }
}

// ── Helpers for the template ──
function diceInfoText(diceSides: number, rollThreshold: number): string {
  return `d${diceSides}, need ${rollThreshold}+`
}

function meetsLevel(requiredLevel: number): boolean {
  return (props.character.character.level ?? 0) >= requiredLevel
}

/**
 * Filter perks to only show those the character's level qualifies for.
 * For perks sharing a rankGroup, only the highest applicable rank is shown.
 */
function visiblePerks(perks: any[]): any[] {
  const charLevel = props.character.character.level ?? 0

  // First: filter to only level-qualified perks
  const qualified = perks.filter(p => charLevel >= p.requiredLevel)

  // Second: for perks with a rankGroup, keep only the highest requiredLevel one
  const bestByRankGroup: Record<string, any> = {}
  const result: any[] = []

  for (const perk of qualified) {
    if (perk.rankGroup) {
      const existing = bestByRankGroup[perk.rankGroup]
      if (!existing || perk.requiredLevel > existing.requiredLevel) {
        bestByRankGroup[perk.rankGroup] = perk
      }
    } else {
      result.push(perk)
    }
  }

  // Add the best rank for each group
  result.push(...Object.values(bestByRankGroup))

  // Preserve original display order
  const idOrder = perks.map(p => p.id)
  result.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id))

  return result
}
</script>

<template>
  <div v-if="canAccessPerks" class="character-perks">
    <div class="perks-header">
      <p class="perks-subtitle">Special abilities and bonuses for this character. Roll the dice to claim a perk!</p>
    </div>

    <template v-if="perkConfig?.groups?.length">
      <div v-for="group in perkConfig.groups" :key="group.id" class="perks-group">
        <!-- Only show groups that have at least one visible perk for the character's level -->
        <template v-if="visiblePerks(group.perks).length > 0">
          <div class="perks-group__header" @click="toggleGroup(group.id)">
            <span class="perks-group__icon">{{ group.icon }}</span>
            <div class="perks-group__info">
              <h3 class="perks-group__title">{{ group.label }}</h3>
              <p class="perks-group__description">{{ group.description }}</p>
            </div>
            <span class="perks-group__chevron" :class="{ 'perks-group__chevron--collapsed': isGroupCollapsed(group.id) }">▼</span>
          </div>

          <div v-show="!isGroupCollapsed(group.id)" class="perks-grid">
            <CharacterPerkCard
              v-for="perk in visiblePerks(group.perks)"
              :key="perk.id"
            :icon="perk.icon"
            :title="perk.name"
            :description="perk.description"
            :locked-message="perk.requiredLevel > 0 ? `Requires level ${perk.requiredLevel}. Current: ${character.character.level}.` : ''"
            offline-message="Character must be online. The dice gods demand your presence!"
            :success-message="getState(perk.id).successMessage || perk.successMessage"
            :meets-requirements="meetsLevel(perk.requiredLevel)"
            :is-online="perk.requiresOnline ? isCharacterOnline : true"
            :loading="getState(perk.id).loading"
            :unlocked="getState(perk.id).unlocked"
            :error="getState(perk.id).error"
            :dice-info="diceInfoText(perk.diceSides, perk.rollThreshold)"
            :last-roll="getState(perk.id).lastRoll"
            :uses-today="getState(perk.id).usesToday"
            :daily-limit="perk.dailyLimit"
            :one-time="perk.oneTime"
            :button-label="perk.oneTime ? 'Roll the Dice' : '🎲 Roll'"
            :button-unlocked-label="perk.deliveryType === 'item' || perk.deliveryType === 'bag-item' ? '✓ Sent' : '✓ Applied'"
            :accent="perk.accent"
            @unlock="activatePerk(perk.id)"
          />
          </div>
        </template>
      </div>
    </template>

    <div v-else class="perks-empty">
      <p>No perks are currently available. Check back later!</p>
    </div>
  </div>

  <div v-else class="perks-restricted">
    <div class="restricted-icon">🔒</div>
    <p>You can only view perks for characters you own.</p>
  </div>
</template>

<style scoped lang="scss">
.character-perks {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.perks-header {
  margin-bottom: 0;
}

.perks-subtitle {
  margin: 0;
  color: #94a3b8;
  font-size: 0.95rem;
}

// ── Group sections ──
.perks-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.perks-group__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #334155;
  cursor: pointer;
  user-select: none;

  &:hover {
    .perks-group__title {
      color: #f1f5f9;
    }
    .perks-group__chevron {
      color: #94a3b8;
    }
  }
}

.perks-group__icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.perks-group__info {
  flex: 1;
  min-width: 0;
}

.perks-group__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #e2e8f0;
  transition: color 0.15s;
}

.perks-group__description {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: #64748b;
}

.perks-group__chevron {
  font-size: 0.75rem;
  color: #64748b;
  transition: transform 0.2s ease, color 0.15s;
  flex-shrink: 0;

  &--collapsed {
    transform: rotate(-90deg);
  }
}

.perks-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.perks-empty {
  text-align: center;
  padding: 2rem;
  color: #64748b;

  p {
    margin: 0;
  }
}

.perks-restricted {
  text-align: center;
  padding: 3rem 1.5rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  color: #64748b;

  .restricted-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 1rem;
  }
}
</style>

