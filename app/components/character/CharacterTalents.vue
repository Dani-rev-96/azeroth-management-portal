<template>
  <div class="talents-container">
    <div v-if="talents.length === 0" class="no-talents">
      <p>No talents selected yet</p>
    </div>
    <div v-else class="talents-display">
      <div class="spec-tabs">
        <button
          v-for="specNum in [1, 2]"
          :key="specNum"
          :class="['spec-tab', { active: selectedSpec === specNum }]"
          @click="selectedSpec = specNum"
        >
          Spec {{ specNum }}
          <span v-if="specNum - 1 === activeSpec" class="active-badge">Active</span>
          <span class="talent-count">{{ getTalentCountForSpec(specNum) }}</span>
        </button>
      </div>

      <div class="talents-grid">
        <div
          v-for="(talent, index) in talentsForSpec"
          :key="`${talent.spell}-${index}`"
          class="talent-slot"
          :title="`Spell ID: ${talent.spell}`"
        >
          <div class="talent-icon">
            <span class="talent-number">{{ index + 1 }}</span>
          </div>
          <div class="talent-info">
            <span class="talent-spell">{{ talent.spellName || `Spell ${talent.spell}` }}</span>
          </div>
        </div>
      </div>

      <div class="talent-summary">
        <p>{{ talentsForSpec.length }} talents selected</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CharacterTalent } from '~/types'

const props = defineProps<{
  talents: CharacterTalent[]
  characterClass: number
  activeSpec: number
}>()

const selectedSpec = ref(1)

function getTalentCountForSpec(specNum: number): number {
  const mask = specNum === 1 ? 1 : 2
  return props.talents.filter(t => (t.specMask & mask) !== 0).length
}

const talentsForSpec = computed(() => {
  const mask = selectedSpec.value === 1 ? 1 : 2
  return props.talents
    .filter(t => (t.specMask & mask) !== 0)
    .sort((a, b) => a.spell - b.spell)
})
</script>

<style scoped>
.talents-container {
  width: 100%;
}

.no-talents {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.spec-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.spec-tab {
  flex: 1;
  padding: 0.75rem 0.5rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid #334155;
  border-radius: 0.375rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.spec-tab:hover {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.2);
}

.spec-tab.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.active-badge {
  background: #10b981;
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.talents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.talent-slot {
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid #334155;
  border-radius: 0.375rem;
  padding: 0.75rem;
  text-align: center;
  transition: all 0.2s;
}

.talent-slot:hover {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  transform: translateY(-2px);
}

.talent-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 0.5rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
}

.talent-number {
  font-size: 1.25rem;
}

.talent-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.talent-spell {
  font-size: 0.75rem;
  color: #94a3b8;
}

.talent-summary {
  text-align: center;
  padding: 0.75rem;
  background: rgba(59, 130, 246, 0.05);
  border-radius: 0.375rem;
  color: #60a5fa;
  font-size: 0.9rem;
}
</style>
