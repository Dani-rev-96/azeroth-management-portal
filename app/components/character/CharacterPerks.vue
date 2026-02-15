<script setup lang="ts">
/**
 * CharacterPerks - Container for all character perk/unlockable cards
 *
 * This component manages the perks tab content for a character detail view.
 * It handles access control (owner/GM) and renders available perks using
 * CharacterPerkCard components.
 *
 * Each perk encapsulates its own unlock logic and API call.
 * The gambling/gacha mechanic is driven by the server — a dice is rolled
 * on each attempt, and the server returns the outcome (success/fail/critfail).
 *
 * Add new perks by adding a new CharacterPerkCard with its own state/handler.
 */
import { ref, computed } from 'vue'
import type { CharacterDetailResponse } from '~/types'
import { useCharactersStore } from '~/stores/characters'
import { useAuthStore } from '~/stores/auth'
import CharacterPerkCard from '~/components/character/CharacterPerkCard.vue'
import type { RollResult } from '~/components/character/CharacterPerkCard.vue'

const props = defineProps<{
  /** Full character data from the detail API */
  character: CharacterDetailResponse
  /** Character GUID (parsed from route) */
  characterGuid: number
  /** Realm ID (from route) */
  realmId: string
}>()

const charactersStore = useCharactersStore()
const authStore = useAuthStore()

// Access control: only show perks to the account owner or a GM
const canAccessPerks = computed(() => {
  const isOwner = !!charactersStore.getCharacter(props.characterGuid, props.realmId)
  const isGM = !!authStore.user?.isGM
  return isOwner || isGM
})

// Online status (single source of truth from the characters store)
const isCharacterOnline = computed(() => {
  return charactersStore.isOnline(props.characterGuid, props.realmId)
})

// ─────────────────────────────────────────────
// Perk config — fetched from server for dice info display
// ─────────────────────────────────────────────
const { data: perkConfig } = await useFetch('/api/characters/perk-config')

// ─────────────────────────────────────────────
// Perk: Old World Flying (Spell 31700)
// ─────────────────────────────────────────────
const flyingRequiredLevel = computed(() => perkConfig.value?.perks?.flying?.requiredLevel ?? 60)

const flyingMeetsLevel = computed(() => {
  return (props.character.character.level ?? 0) >= flyingRequiredLevel.value
})

const flyingDiceInfo = computed(() => {
  const cfg = perkConfig.value?.perks?.flying
  if (!cfg) return ''
  return `d${cfg.diceSides}, need ${cfg.rollThreshold}+`
})

const flyingLoading = ref(false)
const flyingUnlocked = ref(false)
const flyingError = ref('')
const flyingSuccessMessage = ref('')
const flyingLastRoll = ref<RollResult | null>(null)

interface MountResponse {
  success: boolean
  message: string
  roll?: number
  diceSides?: number
  threshold?: number
  outcome?: 'success' | 'fail' | 'critfail'
  alreadyKnown?: boolean
}

async function unlockOldWorldFlying() {
  if (flyingLoading.value || flyingUnlocked.value) return

  flyingLoading.value = true
  flyingError.value = ''

  try {
    const response = await $fetch<MountResponse>('/api/characters/learn-mount', {
      method: 'POST',
      body: {
        characterGuid: props.characterGuid,
        realmId: props.realmId,
      },
    })

    if (response.outcome && response.roll != null && response.diceSides != null && response.threshold != null) {
      flyingLastRoll.value = {
        roll: response.roll,
        diceSides: response.diceSides,
        threshold: response.threshold,
        outcome: response.outcome,
        message: response.message,
      }
    }

    if (response.success) {
      flyingUnlocked.value = true
      flyingSuccessMessage.value = response.message
    }
  } catch (err: any) {
    const errorMessage = err?.data?.message || err?.statusMessage || err?.message || 'Failed to learn the spell'
    flyingError.value = errorMessage
  } finally {
    flyingLoading.value = false
  }
}

// ─────────────────────────────────────────────
// Perk: Drakefire Amulet (Item 16309)
// Onyxia's Lair attunement item — skip the long quest chain
// Requires online (debuffs need an online player)
// ─────────────────────────────────────────────
const DRAKEFIRE_ITEM_ID = 16309

const drakefireDiceInfo = computed(() => {
  const cfg = perkConfig.value?.perks?.drakefire
  if (!cfg) return ''
  return `d${cfg.diceSides}, need ${cfg.rollThreshold}+`
})

const drakefireLoading = ref(false)
const drakefireUnlocked = ref(false)
const drakefireError = ref('')
const drakefireSuccessMessage = ref('')
const drakefireLastRoll = ref<RollResult | null>(null)

interface ItemResponse {
  success: boolean
  message: string
  roll?: number
  diceSides?: number
  threshold?: number
  outcome?: 'success' | 'fail' | 'critfail'
  alreadyPending?: boolean
}

async function unlockDrakefireAmulet() {
  if (drakefireLoading.value || drakefireUnlocked.value) return

  drakefireLoading.value = true
  drakefireError.value = ''

  try {
    const response = await $fetch<ItemResponse>('/api/characters/grant-item', {
      method: 'POST',
      body: {
        characterGuid: props.characterGuid,
        realmId: props.realmId,
        itemId: DRAKEFIRE_ITEM_ID,
      },
    })

    if (response.outcome && response.roll != null && response.diceSides != null && response.threshold != null) {
      drakefireLastRoll.value = {
        roll: response.roll,
        diceSides: response.diceSides,
        threshold: response.threshold,
        outcome: response.outcome,
        message: response.message,
      }
    }

    if (response.success) {
      drakefireUnlocked.value = true
      drakefireSuccessMessage.value = response.message
    }
  } catch (err: any) {
    const errorMessage = err?.data?.message || err?.statusMessage || err?.message || 'Failed to grant the item'
    drakefireError.value = errorMessage
  } finally {
    drakefireLoading.value = false
  }
}

// ─────────────────────────────────────────────
// Future perks go here — follow the same pattern:
// 1. Define requirements (computed)
// 2. Define state refs (loading, unlocked, error, message, lastRoll)
// 3. Define unlock handler (async function)
// 4. Add a <CharacterPerkCard> in the template
// ─────────────────────────────────────────────
</script>

<template>
  <div v-if="canAccessPerks" class="character-perks">
    <div class="perks-header">
      <p class="perks-subtitle">Special abilities and bonuses for this character.</p>
    </div>

    <div class="perks-grid">
      <!-- Old World Flying -->
      <CharacterPerkCard
        icon="🦅"
        title="Old World Flying"
        description="Learn the ability to fly in Kalimdor and the Eastern Kingdoms."
        :locked-message="`Requires level ${flyingRequiredLevel} to unlock. Current level: ${character.character.level}.`"
        offline-message="Character must be online to attempt this perk. The dice gods demand your presence!"
        :success-message="flyingSuccessMessage || 'Old World Flying has been unlocked!'"
        :meets-requirements="flyingMeetsLevel"
        :is-online="isCharacterOnline"
        :loading="flyingLoading"
        :unlocked="flyingUnlocked"
        :error="flyingError"
        :dice-info="flyingDiceInfo"
        :last-roll="flyingLastRoll"
        button-label="Roll the Dice"
        button-unlocked-label="✓ Learned"
        accent="purple"
        @unlock="unlockOldWorldFlying"
      />

      <!-- Drakefire Amulet -->
      <CharacterPerkCard
        icon="🐉"
        title="Drakefire Amulet"
        description="Receive the Drakefire Amulet via mail — grants access to Onyxia's Lair without completing the attunement chain."
        locked-message=""
        offline-message="Character must be online to attempt this perk. The dice gods demand your presence!"
        :success-message="drakefireSuccessMessage || 'Drakefire Amulet has been sent! Check your in-game mailbox.'"
        :meets-requirements="true"
        :is-online="isCharacterOnline"
        :loading="drakefireLoading"
        :unlocked="drakefireUnlocked"
        :error="drakefireError"
        :dice-info="drakefireDiceInfo"
        :last-roll="drakefireLastRoll"
        button-label="Roll the Dice"
        button-unlocked-label="✓ Sent"
        accent="orange"
        @unlock="unlockDrakefireAmulet"
      />

      <!-- Placeholder: more perks will be added here -->
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
  gap: 1.5rem;
}

.perks-header {
  margin-bottom: 0.5rem;
}

.perks-subtitle {
  margin: 0;
  color: #94a3b8;
  font-size: 0.95rem;
}

.perks-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
