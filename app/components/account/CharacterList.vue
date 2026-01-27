<template>
  <div class="section characters-section">
    <h2>Characters</h2>
    <p class="section-description">Your characters on this account</p>

    <div v-if="characters.length === 0" class="no-data">
      <p>No characters found on this account.</p>
    </div>

    <div v-else class="characters-grid">
      <div
        v-for="char in characters"
        :key="char.guid"
        class="character-card"
      >
        <div class="char-header">
          <h3>{{ char.name }}</h3>
          <span :class="['char-status', char.deleteDate ? 'deleted' : '']">
            {{ char.deleteDate ? 'Deleted' : 'Active' }}
          </span>
        </div>

        <div class="char-info">
          <div class="char-detail">
            <span class="char-label">Level {{ char.level }}</span>
            <span class="char-value">{{ getClassName(char.class) }}</span>
          </div>
          <div class="char-detail">
            <span class="char-label">Race:</span>
            <span class="char-value">{{ getRaceName(char.race) }}</span>
          </div>
          <div class="char-detail">
            <span class="char-label">Gender:</span>
            <span class="char-value">{{ char.gender === 0 ? 'Male' : 'Female' }}</span>
          </div>
          <div class="char-detail">
            <span class="char-label">Gold:</span>
            <span class="char-value gold">{{ formatGold(char.money) }}</span>
          </div>
        </div>

        <div v-if="char.deleteDate" class="char-actions">
          <button
            @click="$emit('undelete', char)"
            :disabled="loading"
            class="action-button undelete"
          >
            Request Undelete
          </button>
        </div>
        <div v-else class="char-actions">
          <NuxtLink
            :to="`/character/${char.guid}/${realmId}`"
            class="action-button view"
          >
            View Character
          </NuxtLink>
          <button
            @click="$emit('rename', char)"
            :disabled="loading"
            class="action-button rename"
          >
            Request Rename
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WoWCharacter } from '~/types'

defineProps<{
  characters: WoWCharacter[]
  loading?: boolean
  realmId: string
}>()

defineEmits<{
  rename: [character: WoWCharacter]
  undelete: [character: WoWCharacter]
}>()

const formatGold = (copper: number) => {
  const gold = Math.floor(copper / 10000)
  const silver = Math.floor((copper % 10000) / 100)
  const copperRemainder = copper % 100

  if (gold > 0) {
    return `${gold}g ${silver}s ${copperRemainder}c`
  } else if (silver > 0) {
    return `${silver}s ${copperRemainder}c`
  } else {
    return `${copperRemainder}c`
  }
}

const getClassName = (classId: number) => {
  const classes: Record<number, string> = {
    1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
    5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
    9: 'Warlock', 11: 'Druid'
  }
  return classes[classId] || 'Unknown'
}

const getRaceName = (raceId: number) => {
  const races: Record<number, string> = {
    1: 'Human', 2: 'Orc', 3: 'Dwarf', 4: 'Night Elf',
    5: 'Undead', 6: 'Tauren', 7: 'Gnome', 8: 'Troll',
    10: 'Blood Elf', 11: 'Draenei'
  }
  return races[raceId] || 'Unknown'
}
</script>

<style scoped lang="scss">
.section {
  margin-bottom: 2rem;
  padding: 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;

  h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: #e2e8f0;
  }

  .section-description {
    margin: 0 0 1.5rem 0;
    color: #94a3b8;
    font-size: 0.95rem;
  }
}

.no-data {
  padding: 3rem 2rem;
  text-align: center;
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.05);
  border-radius: 0.75rem;
  border: 2px dashed #334155;

  p {
    margin: 0;
  }
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.character-card {
  padding: 1.5rem;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  background: #0f172a;
  transition: all 0.2s;

  &:hover {
    border-color: #475569;
    transform: translateY(-2px);
  }

  .char-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #334155;

    h3 {
      margin: 0;
      font-size: 1.25rem;
      color: #60a5fa;
    }

    .char-status {
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid #22c55e;
      color: #22c55e;

      &.deleted {
        background: rgba(239, 68, 68, 0.2);
        border-color: #ef4444;
        color: #fca5a5;
      }
    }
  }

  .char-info {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;

    .char-detail {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;

      .char-label {
        font-weight: 600;
        color: #94a3b8;
      }

      .char-value {
        color: #e2e8f0;

        &.gold {
          font-family: monospace;
          color: #fbbf24;
          font-weight: 600;
        }
      }
    }
  }

  .char-actions {
    display: flex;
    gap: 0.75rem;
  }
}

.action-button {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s;
  text-align: center;
  text-decoration: none;
  display: inline-block;

  &.view {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }
  }

  &.rename {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
  }

  &.undelete {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid #22c55e;
    color: #22c55e;

    &:hover:not(:disabled) {
      background: rgba(34, 197, 94, 0.3);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@media (max-width: 768px) {
  .characters-grid {
    grid-template-columns: 1fr;
  }
}
</style>
