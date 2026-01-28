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

      <!-- Equipment Section - Full Width -->
      <div class="equipment-section">
        <h2>Equipped Items</h2>
        <div class="equipment-paperdoll">
          <!-- Left Column -->
          <div class="equipment-column left-column">
            <CharacterEquipmentSlot :slot="getSlotDefinition(0)" :item="getItemInSlot(0)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(1)" :item="getItemInSlot(1)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(2)" :item="getItemInSlot(2)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(14)" :item="getItemInSlot(14)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(4)" :item="getItemInSlot(4)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(3)" :item="getItemInSlot(3)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(18)" :item="getItemInSlot(18)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(8)" :item="getItemInSlot(8)" />
          </div>

          <!-- Center Column -->
          <div class="equipment-column center-column">
            <div class="character-placeholder">
              <span class="character-icon">🧙</span>
            </div>
            <div class="weapon-slots">
              <CharacterEquipmentSlot :slot="getSlotDefinition(15)" :item="getItemInSlot(15)" />
              <CharacterEquipmentSlot :slot="getSlotDefinition(16)" :item="getItemInSlot(16)" />
              <CharacterEquipmentSlot :slot="getSlotDefinition(17)" :item="getItemInSlot(17)" />
            </div>
          </div>

          <!-- Right Column -->
          <div class="equipment-column right-column">
            <CharacterEquipmentSlot :slot="getSlotDefinition(9)" :item="getItemInSlot(9)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(5)" :item="getItemInSlot(5)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(6)" :item="getItemInSlot(6)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(7)" :item="getItemInSlot(7)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(10)" :item="getItemInSlot(10)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(11)" :item="getItemInSlot(11)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(12)" :item="getItemInSlot(12)" />
            <CharacterEquipmentSlot :slot="getSlotDefinition(13)" :item="getItemInSlot(13)" />
          </div>
        </div>
      </div>

      <!-- Stats and Talents Grid -->
      <div class="content-grid">
        <!-- Stats Column -->
        <div class="stats-section">
          <!-- Resources -->
          <div class="core-stats section-card">
            <h2>Resources</h2>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">❤️ Health</span>
                <span class="stat-value">{{ data.character.health }} / {{ stats?.maxhealth || data.character.health }}</span>
              </div>
              <div class="stat-item" v-if="showsResource(data.character.class, 'mana') && data.character.mana">
                <span class="stat-label">💧 Mana</span>
                <span class="stat-value">{{ data.character.mana }} / {{ stats?.maxpower1 || data.character.mana }}</span>
              </div>
              <div class="stat-item" v-if="showsResource(data.character.class, 'rage') && data.character.rage !== undefined">
                <span class="stat-label">🔥 Rage</span>
                <span class="stat-value">{{ data.character.rage }} / {{ stats?.maxpower2 || 100 }}</span>
              </div>
              <div class="stat-item" v-if="showsResource(data.character.class, 'energy') && data.character.energy !== undefined">
                <span class="stat-label">⚡ Energy</span>
                <span class="stat-value">{{ data.character.energy }} / {{ stats?.maxpower4 || 100 }}</span>
              </div>
            </div>
          </div>

          <!-- Attributes -->
          <div class="attributes-section section-card" v-if="stats">
            <h2>Attributes</h2>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">💪 Strength</span>
                <span class="stat-value">{{ stats.strength }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">🏃 Agility</span>
                <span class="stat-value">{{ stats.agility }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">🛡️ Stamina</span>
                <span class="stat-value">{{ stats.stamina }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">🧠 Intellect</span>
                <span class="stat-value">{{ stats.intellect }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">✨ Spirit</span>
                <span class="stat-value">{{ stats.spirit }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">🛡️ Armor</span>
                <span class="stat-value">{{ stats.armor }}</span>
              </div>
            </div>
          </div>

          <!-- Combat Stats -->
          <div class="combat-section section-card" v-if="stats">
            <h2>Combat Stats</h2>
            <div class="stats-grid">
              <div class="stat-item" v-if="stats.attackPower">
                <span class="stat-label">⚔️ Attack Power</span>
                <span class="stat-value">{{ stats.attackPower }}</span>
              </div>
              <div class="stat-item" v-if="stats.rangedAttackPower">
                <span class="stat-label">🏹 Ranged AP</span>
                <span class="stat-value">{{ stats.rangedAttackPower }}</span>
              </div>
              <div class="stat-item" v-if="stats.spellPower">
                <span class="stat-label">🔮 Spell Power</span>
                <span class="stat-value">{{ stats.spellPower }}</span>
              </div>
              <!-- Show Melee Crit for melee classes -->
              <div class="stat-item" v-if="stats.critPct !== undefined && isMeleeClass(data.character.class)">
                <span class="stat-label">💥 Melee Crit</span>
                <span class="stat-value">{{ stats.critPct.toFixed(2) }}%</span>
              </div>
              <!-- Show Ranged Crit for Hunters, or Spell Crit for casters (using rangedCritPct) -->
              <div class="stat-item" v-if="stats.rangedCritPct !== undefined">
                <span class="stat-label">{{ getCritLabel(data.character.class) }}</span>
                <span class="stat-value">{{ stats.rangedCritPct.toFixed(2) }}%</span>
              </div>
            </div>
          </div>

          <!-- Defensive Stats -->
          <div class="defensive-section section-card" v-if="stats && (stats.dodgePct || stats.parryPct || stats.blockPct)">
            <h2>Defense</h2>
            <div class="stats-grid">
              <div class="stat-item" v-if="stats.dodgePct !== undefined">
                <span class="stat-label">🌀 Dodge</span>
                <span class="stat-value">{{ stats.dodgePct.toFixed(2) }}%</span>
              </div>
              <div class="stat-item" v-if="stats.parryPct !== undefined">
                <span class="stat-label">🛡️ Parry</span>
                <span class="stat-value">{{ stats.parryPct.toFixed(2) }}%</span>
              </div>
              <div class="stat-item" v-if="stats.blockPct !== undefined">
                <span class="stat-label">🚫 Block</span>
                <span class="stat-value">{{ stats.blockPct.toFixed(2) }}%</span>
              </div>
              <div class="stat-item" v-if="stats.resilience">
                <span class="stat-label">💎 Resilience</span>
                <span class="stat-value">{{ stats.resilience }}</span>
              </div>
            </div>
          </div>

          <!-- Resistances -->
          <div class="resistances-section section-card" v-if="stats && (stats.resHoly || stats.resFire || stats.resNature || stats.resFrost || stats.resShadow || stats.resArcane)">
            <h2>Resistances</h2>
            <div class="stats-grid">
              <div class="stat-item" v-if="stats.resHoly">
                <span class="stat-label">✝️ Holy</span>
                <span class="stat-value">{{ stats.resHoly }}</span>
              </div>
              <div class="stat-item" v-if="stats.resFire">
                <span class="stat-label">🔥 Fire</span>
                <span class="stat-value">{{ stats.resFire }}</span>
              </div>
              <div class="stat-item" v-if="stats.resNature">
                <span class="stat-label">🌿 Nature</span>
                <span class="stat-value">{{ stats.resNature }}</span>
              </div>
              <div class="stat-item" v-if="stats.resFrost">
                <span class="stat-label">❄️ Frost</span>
                <span class="stat-value">{{ stats.resFrost }}</span>
              </div>
              <div class="stat-item" v-if="stats.resShadow">
                <span class="stat-label">🌑 Shadow</span>
                <span class="stat-value">{{ stats.resShadow }}</span>
              </div>
              <div class="stat-item" v-if="stats.resArcane">
                <span class="stat-label">🔮 Arcane</span>
                <span class="stat-value">{{ stats.resArcane }}</span>
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

        <!-- Talents Column -->
        <div class="talents-section section-card">
          <h2>Talents</h2>
          <CharacterTalentTree
            :talents="data.talents"
            :character-class="data.character.class"
            :active-spec="data.character.activeSpec"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CharacterDetailResponse } from '~/types'
import CharacterEquipmentSlot from '~/components/character/CharacterEquipmentSlot.vue'
import CharacterTalentTree from '~/components/character/CharacterTalentTree.vue'

const route = useRoute()
const guid = computed(() => parseInt(route.params.guid as string))
const realmId = computed(() => route.params.realmId as string)

// Fetch character data
const { data, pending, error } = await useFetch<CharacterDetailResponse>(
  `/api/characters/${guid.value}/${realmId.value}`
)

// Get stats object
const stats = computed(() => {
  return data.value?.stats && data.value.stats.length > 0 ? data.value.stats[0] : null
})

// Helper to determine which resource to show based on class
// 1=Warrior (Rage), 2=Paladin (Mana), 3=Hunter (Mana), 4=Rogue (Energy),
// 5=Priest (Mana), 6=DK (Runic Power), 7=Shaman (Mana), 8=Mage (Mana),
// 9=Warlock (Mana), 11=Druid (Mana)
function showsResource(classId: number, resourceType: 'mana' | 'rage' | 'energy' | 'focus') {
  if (resourceType === 'mana') {
    return [2, 3, 5, 7, 8, 9, 11].includes(classId)
  }
  if (resourceType === 'rage') {
    return [1].includes(classId) // Warriors, Druids use it in bear form but we show mana as primary
  }
  if (resourceType === 'energy') {
    return [4].includes(classId) // Rogues, Druids use it in cat form but we show mana as primary
  }
  if (resourceType === 'focus') {
    return [3].includes(classId) // Hunters (though they use mana in WotLK)
  }
  return false
}

// Helper to determine if class is primarily melee
function isMeleeClass(classId: number): boolean {
  // Warriors, Rogues, Death Knights, Enhancement Shamans (all shamans for simplicity)
  return [1, 4, 6].includes(classId)
}

// Helper to get the correct crit label based on class
function getCritLabel(classId: number): string {
  // Hunter uses Ranged Crit
  if (classId === 3) {
    return '🎯 Ranged Crit'
  }
  // Caster classes (Priest, Mage, Warlock, Druid, Shaman, Paladin) use Spell Crit
  // Note: rangedCritPct actually stores spell crit for these classes in the DB
  if ([2, 5, 7, 8, 9, 11].includes(classId)) {
    return '✨ Spell Crit'
  }
  // Melee classes
  return '🎯 Crit'
}

// Equipment slot definitions
const equipmentSlots = [
  { id: 0, name: 'Head', icon: '🪖' },
  { id: 1, name: 'Neck', icon: '📿' },
  { id: 2, name: 'Shoulders', icon: '🛡️' },
  { id: 15, name: 'Back', icon: '🧥' },
  { id: 4, name: 'Chest', icon: '👕' },
  { id: 3, name: 'Shirt', icon: '👔' },
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

function getSlotDefinition(slotId: number) {
  return equipmentSlots.find(slot => slot.id === slotId) || { id: slotId, name: 'Unknown', icon: '❓' }
}

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

<style scoped lang="scss">
@use "~/styles/mixins" as *;

.character-showroom {
  @include container;
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
  margin-top: 2rem;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

.equipment-section {
  margin-bottom: 2rem;
}

.equipment-section h2 {
  color: #f1f5f9;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.equipment-paperdoll {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5));
  border-radius: 1rem;
  border: 1px solid #334155;
}

@media (max-width: 768px) {
  .equipment-paperdoll {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

.equipment-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.center-column {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

.character-placeholder {
  width: 100%;
  aspect-ratio: 1;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1));
  border: 2px solid #334155;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .character-placeholder {
    display: none;
  }
}

.character-icon {
  font-size: 4rem;
  opacity: 0.3;
}

.weapon-slots {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.stats-section,
.talents-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-section h2,
.talents-section h2 {
  color: #f1f5f9;
  margin-bottom: 1rem;
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
  padding: 1rem;
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
  align-items: center;
  padding: 0.75rem;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid #334155;
  border-radius: 0.375rem;
  gap: 0.5rem;
}

@media (max-width: 640px) {
  .stat-item,
  .currency-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
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
