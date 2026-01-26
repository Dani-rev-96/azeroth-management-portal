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
  padding: 1.5rem;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  h2 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
  }

  .section-description {
    margin: -0.5rem 0 1rem 0;
    color: #666;
    font-size: 0.9rem;
  }
}

.no-data {
  padding: 2rem;
  text-align: center;
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.character-card {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fafafa;

  .char-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e0e0e0;

    h3 {
      margin: 0;
      font-size: 1.25rem;
    }

    .char-status {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #4caf50;
      color: white;

      &.deleted {
        background: #f44336;
      }
    }
  }

  .char-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;

    .char-detail {
      display: flex;
      justify-content: space-between;

      .char-label {
        font-weight: 600;
        color: #555;
      }

      .char-value {
        color: #333;

        &.gold {
          font-family: monospace;
          color: #ff9800;
          font-weight: 600;
        }
      }
    }
  }

  .char-actions {
    display: flex;
    gap: 0.5rem;
  }
}

.action-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;

  &.rename {
    background: #2196f3;
    color: white;

    &:hover:not(:disabled) {
      background: #1976d2;
    }
  }

  &.undelete {
    background: #4caf50;
    color: white;

    &:hover:not(:disabled) {
      background: #388e3c;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
