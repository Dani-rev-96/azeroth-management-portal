<template>
  <div class="section stats-section">
    <h2>Account Statistics</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-value">{{ totalCharacters }}</span>
        <span class="stat-label">Total Characters</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ activeCharacters }}</span>
        <span class="stat-label">Active Characters</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ maxLevel }}</span>
        <span class="stat-label">Highest Level</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ formatGold(totalGold) }}</span>
        <span class="stat-label">Total Gold</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WoWCharacter } from '~/types'
import { computed } from 'vue'

const props = defineProps<{
  characters: WoWCharacter[]
}>()

const totalCharacters = computed(() => props.characters.length)

const activeCharacters = computed(() =>
  props.characters.filter(c => !c.deleteDate).length
)

const maxLevel = computed(() =>
  props.characters.reduce((max, c) => Math.max(max, c.level), 0)
)

const totalGold = computed(() =>
  props.characters.reduce((sum, c) => sum + c.money, 0)
)

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
</script>

<style scoped lang="scss">
.section {
  padding: 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;

  h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.5rem;
    color: #e2e8f0;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1.5rem;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.75rem;
    text-align: center;
    transition: all 0.2s;

    &:hover {
      border-color: #475569;
      transform: translateY(-2px);
    }

    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      background: linear-gradient(to right, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .stat-label {
      font-size: 0.9rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
}
</style>
