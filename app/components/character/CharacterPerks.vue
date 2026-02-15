<script setup lang="ts">
/**
 * CharacterPerks - Container for all character perk/unlockable cards
 *
 * This component manages the perks tab content for a character detail view.
 * It handles access control (owner/GM) and renders available perks using
 * CharacterPerkCard components.
 *
 * Each perk encapsulates its own unlock logic and API call.
 * Add new perks by adding a new CharacterPerkCard with its own state/handler.
 */
import { ref, computed } from 'vue'
import type { CharacterDetailResponse } from '~/types'
import { useCharactersStore } from '~/stores/characters'
import { useAuthStore } from '~/stores/auth'
import CharacterPerkCard from '~/components/character/CharacterPerkCard.vue'

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
// Perk: Old World Flying (Spell 31700)
// ─────────────────────────────────────────────
const FLYING_REQUIRED_LEVEL = 60

const flyingMeetsLevel = computed(() => {
  return (props.character.character.level ?? 0) >= FLYING_REQUIRED_LEVEL
})

const flyingLoading = ref(false)
const flyingUnlocked = ref(false)
const flyingError = ref('')
const flyingSuccessMessage = ref('')

async function unlockOldWorldFlying() {
  if (flyingLoading.value || flyingUnlocked.value) return

  flyingLoading.value = true
  flyingError.value = ''

  try {
    const response = await $fetch<{ success: boolean; message: string; alreadyKnown?: boolean }>('/api/characters/learn-mount', {
      method: 'POST',
      body: {
        characterGuid: props.characterGuid,
        realmId: props.realmId,
      },
    })

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
// Delivered via in-game mail (works online & offline)
// ─────────────────────────────────────────────
const DRAKEFIRE_ITEM_ID = 16309

const drakefireLoading = ref(false)
const drakefireUnlocked = ref(false)
const drakefireError = ref('')
const drakefireSuccessMessage = ref('')

async function unlockDrakefireAmulet() {
  if (drakefireLoading.value || drakefireUnlocked.value) return

  drakefireLoading.value = true
  drakefireError.value = ''

  try {
    const response = await $fetch<{ success: boolean; message: string; alreadyPending?: boolean }>('/api/characters/grant-item', {
      method: 'POST',
      body: {
        characterGuid: props.characterGuid,
        realmId: props.realmId,
        itemId: DRAKEFIRE_ITEM_ID,
      },
    })

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
// 2. Define state refs (loading, unlocked, error, message)
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
        :locked-message="`Requires level ${FLYING_REQUIRED_LEVEL} to unlock. Current level: ${character.character.level}.`"
        offline-message="Character must be online to learn this spell."
        :success-message="flyingSuccessMessage || 'Old World Flying has been unlocked!'"
        :meets-requirements="flyingMeetsLevel"
        :is-online="isCharacterOnline"
        :loading="flyingLoading"
        :unlocked="flyingUnlocked"
        :error="flyingError"
        button-label="Learn Spell"
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
        offline-message=""
        success-message="Drakefire Amulet has been sent! Check your in-game mailbox."
        :meets-requirements="true"
        :is-online="true"
        :loading="drakefireLoading"
        :unlocked="drakefireUnlocked"
        :error="drakefireError"
        button-label="Obtain Amulet"
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
