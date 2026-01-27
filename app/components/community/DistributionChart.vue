<template>
  <section class="content-section">
    <h2>{{ icon }} {{ title }}</h2>
    <div class="distribution-grid">
      <div v-for="(count, id) in distribution" :key="id" class="distribution-item">
        <div class="distribution-icon">{{ getIcon(Number(id)) }}</div>
        <div class="distribution-info">
          <span class="distribution-name">{{ getName(Number(id)) }}</span>
          <span class="distribution-count">{{ count }} characters</span>
          <div class="distribution-bar">
            <div class="distribution-fill" :style="{ width: getPercentage(count) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  icon: string
  distribution: Record<number, number>
  totalCharacters: number
  type: 'class' | 'race'
}>()

function getIcon(id: number): string {
  if (props.type === 'class') {
    const icons: Record<number, string> = {
      1: '⚔️', 2: '🛡️', 3: '🏹', 4: '🗡️',
      5: '✨', 6: '💀', 7: '⚡', 8: '🔮',
      9: '👿', 11: '🐾'
    }
    return icons[id] || '❓'
  } else {
    const icons: Record<number, string> = {
      1: '👤', 2: '💪', 3: '⛏️', 4: '🌙',
      5: '☠️', 6: '🐃', 7: '🔧', 8: '🏝️',
      10: '✨', 11: '🔷'
    }
    return icons[id] || '❓'
  }
}

function getName(id: number): string {
  if (props.type === 'class') {
    const classes: Record<number, string> = {
      1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
      5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
      9: 'Warlock', 11: 'Druid'
    }
    return classes[id] || `Class ${id}`
  } else {
    const races: Record<number, string> = {
      1: 'Human', 2: 'Orc', 3: 'Dwarf', 4: 'Night Elf',
      5: 'Undead', 6: 'Tauren', 7: 'Gnome', 8: 'Troll',
      10: 'Blood Elf', 11: 'Draenei'
    }
    return races[id] || `Race ${id}`
  }
}

function getPercentage(count: number): number {
  if (!props.totalCharacters || props.totalCharacters === 0) return 0
  return (count / props.totalCharacters * 100)
}
</script>

<style scoped>
.distribution-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.distribution-item {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.distribution-icon {
  font-size: 2rem;
  opacity: 0.8;
}

.distribution-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.distribution-name {
  font-weight: 600;
  color: #e2e8f0;
}

.distribution-count {
  font-size: 0.85rem;
  color: #94a3b8;
}

.distribution-bar {
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.25rem;
}

.distribution-fill {
  height: 100%;
  background: linear-gradient(to right, #60a5fa, #a78bfa);
  transition: width 0.5s ease;
}

@media (max-width: 768px) {
  .distribution-grid {
    grid-template-columns: 1fr;
  }
}
</style>
