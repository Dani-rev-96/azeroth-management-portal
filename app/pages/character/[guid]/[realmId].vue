<template>
  <div class="character-showroom">
    <div v-if="pending" class="loading">
      <p>Loading character...</p>
    </div>

    <div v-else-if="error" class="error">
      <h2>Error Loading Character</h2>
      <p>{{ error.message }}</p>
      <NuxtLink to="/account" class="back-button">← Back to Accounts</NuxtLink>
    </div>

    <div v-else-if="data" class="character-content">
      <!-- Character Header -->
      <div class="character-header">
        <div class="character-title">
          <h1>{{ data.character.name }}</h1>
          <div class="character-subtitle">
            <span class="level">Level {{ data.character.level }}</span>
            <span class="class-race">
              {{ getRaceName(data.character.race) }} {{ getClassName(data.character.class) }}
            </span>
            <span class="gender">{{ data.character.gender === 0 ? 'Male' : 'Female' }}</span>
          </div>
        </div>
        <div class="character-stats-summary">
          <div class="stat-pill">
            <span class="stat-icon">⚔️</span>
            <span class="stat-value">{{ data.character.totalKills }}</span>
            <span class="stat-label">Kills</span>
          </div>
          <div class="stat-pill">
            <span class="stat-icon">🏆</span>
            <span class="stat-value">{{ data.character.honorPoints }}</span>
            <span class="stat-label">Honor</span>
          </div>
          <div class="stat-pill">
            <span class="stat-icon">⏱️</span>
            <span class="stat-value">{{ formatPlaytime(data.character.totalTime) }}</span>
            <span class="stat-label">Played</span>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="content-grid">
        <!-- Left Column: Equipment -->
        <div class="equipment-section">
          <h2>Equipped Items</h2>
          <div class="equipment-grid">
            <CharacterEquipmentSlot
              v-for="slot in equipmentSlots"
              :key="slot.id"
              :slot="slot"
              :item="getItemInSlot(slot.id)"
            />
          </div>
        </div>

        <!-- Right Column: Talents & Stats -->
        <div class="info-section">
          <!-- Talents -->
          <div class="talents-section section-card">
            <h2>Talents</h2>
            <CharacterTalents
              :talents="data.talents"
              :character-class="data.character.class"
              :active-spec="data.character.activeSpec"
            />
          </div>

          <!-- Core Stats -->
          <div class="core-stats section-card">
            <h2>Core Stats</h2>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">❤️ Health</span>
                <span class="stat-value">{{ data.character.health }}</span>
              </div>
              <div class="stat-item" v-if="data.character.mana">
                <span class="stat-label">💧 Mana</span>
                <span class="stat-value">{{ data.character.mana }}</span>
              </div>
              <div class="stat-item" v-if="data.character.energy">
                <span class="stat-label">⚡ Energy</span>
                <span class="stat-value">{{ data.character.energy }}</span>
              </div>
              <div class="stat-item" v-if="data.character.rage">
                <span class="stat-label">🔥 Rage</span>
                <span class="stat-value">{{ data.character.rage }}</span>
              </div>
            </div>
          </div>

          <!-- Currency -->
          <div class="currency-section section-card">
            <h2>Currency</h2>
            <div class="currency-grid">
              <div class="currency-item">
                <span class="currency-label">💰 Gold</span>
                <span class="currency-value">{{ formatGold(data.character.money) }}</span>
              </div>
              <div class="currency-item">
                <span class="currency-label">🎖️ Arena Points</span>
                <span class="currency-value">{{ data.character.arenaPoints }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CharacterDetailResponse } from '~/types'
import CharacterEquipmentSlot from '~/components/character/CharacterEquipmentSlot.vue'
import CharacterTalents from '~/components/character/CharacterTalents.vue'

const route = useRoute()
const guid = computed(() => parseInt(route.params.guid as string))
const realmId = computed(() => route.params.realmId as string)

// Fetch character data
const { data, pending, error } = await useFetch<CharacterDetailResponse>(
  `/api/characters/${guid.value}/${realmId.value}`
)

// Equipment slot definitions
const equipmentSlots = [
  { id: 0, name: 'Head', icon: '🪖' },
  { id: 1, name: 'Neck', icon: '📿' },
  { id: 2, name: 'Shoulders', icon: '🛡️' },
  { id: 15, name: 'Back', icon: '🧥' },
  { id: 4, name: 'Chest', icon: '👕' },
  { id: 18, name: 'Tabard', icon: '🎗️' },
  { id: 8, name: 'Wrist', icon: '⌚' },
  { id: 9, name: 'Hands', icon: '🧤' },
  { id: 5, name: 'Waist', icon: '🔗' },
  { id: 6, name: 'Legs', icon: '👖' },
  { id: 7, name: 'Feet', icon: '👢' },
  { id: 10, name: 'Finger 1', icon: '💍' },
  { id: 11, name: 'Finger 2', icon: '💍' },
  { id: 12, name: 'Trinket 1', icon: '🔮' },
  { id: 13, name: 'Trinket 2', icon: '🔮' },
  { id: 14, name: 'Main Hand', icon: '⚔️' },
  { id: 16, name: 'Off Hand', icon: '🛡️' },
  { id: 17, name: 'Ranged', icon: '🏹' }
]

function getItemInSlot(slotId: number) {
  return data.value?.items.find(item => item.slot === slotId)
}

function getClassName(classId: number) {
  const classes: Record<number, string> = {
    1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
    5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
    9: 'Warlock', 11: 'Druid'
  }
  return classes[classId] || 'Unknown'
}

function getRaceName(raceId: number) {
  const races: Record<number, string> = {
    1: 'Human', 2: 'Orc', 3: 'Dwarf', 4: 'Night Elf',
    5: 'Undead', 6: 'Tauren', 7: 'Gnome', 8: 'Troll',
    10: 'Blood Elf', 11: 'Draenei'
  }
  return races[raceId] || `Race ${raceId}`
}

function formatGold(copper: number) {
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

function formatPlaytime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  return `${hours}h`
}
</script>

<style scoped>
.character-showroom {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.loading, .error {
  text-align: center;
  padding: 3rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
}

.error h2 {
  color: #ef4444;
  margin-bottom: 1rem;
}

.back-button {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border-radius: 0.375rem;
  text-decoration: none;
  transition: background 0.2s;
}

.back-button:hover {
  background: #2563eb;
}

.character-header {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border: 1px solid #475569;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.character-title h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.character-subtitle {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  font-size: 1.1rem;
  color: #94a3b8;
}

.level {
  color: #fbbf24;
  font-weight: 600;
}

.character-stats-summary {
  display: grid;
  gap: 1rem;
	grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
	width: 100%;
}

.stat-pill {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid #3b82f6;
  border-radius: 0.5rem;
  padding: 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #60a5fa;
}

.stat-label {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: uppercase;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

.equipment-section h2,
.info-section h2 {
  color: #f1f5f9;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.section-card h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.stats-grid,
.currency-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.stat-item,
.currency-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid #334155;
  border-radius: 0.375rem;
}

.stat-label,
.currency-label {
  color: #94a3b8;
  font-size: 0.9rem;
}

.stat-value,
.currency-value {
  color: #60a5fa;
  font-weight: 600;
}
</style>
