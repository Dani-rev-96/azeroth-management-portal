<template>
  <div class="talent-tree-viewer">
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-button"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.name }}
        <span class="points-badge">{{ tab.pointsSpent }}</span>
      </button>
    </div>

    <div v-if="currentTab" class="talent-tree">
      <div class="tree-grid">
        <!-- Render talent nodes in a grid -->
        <div
          v-for="tier in 11"
          :key="`tier-${tier - 1}`"
          class="tier-row"
        >
          <div
            v-for="col in 4"
            :key="`col-${col - 1}`"
            class="talent-cell"
          >
            <div
              v-if="getTalentAt(tier - 1, col - 1)"
              class="talent-node"
              :class="{
                active: getTalentRank(getTalentAt(tier - 1, col - 1)) > 0,
                disabled: !canLearnTalent(getTalentAt(tier - 1, col - 1)),
                maxed: isMaxRank(getTalentAt(tier - 1, col - 1))
              }"
              :title="getTalentTooltip(getTalentAt(tier - 1, col - 1))"
            >
              <div class="talent-icon">
                <span class="icon-placeholder">🎯</span>
              </div>
              <div class="talent-rank">
                {{ getTalentRank(getTalentAt(tier - 1, col - 1)) }}/{{ getMaxRank(getTalentAt(tier - 1, col - 1)) }}
              </div>
              <div class="talent-name">{{ getTalentName(getTalentAt(tier - 1, col - 1)) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="tree-info">
        <p>Points spent: <strong>{{ currentTab.pointsSpent }}</strong></p>
        <p>Required level: {{ Math.floor(currentTab.pointsSpent / 3) * 2 + 10 }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface TalentData {
  guid: number
  spell: number
  specMask: number
  spellName?: string
  spellRank?: string
  talentId?: number
  tabId?: number
  tier?: number
  column?: number
}

interface TalentTreeNode {
  talentId: number
  tier: number
  column: number
  spell: number
  spellName: string
  rank: number
  maxRank: number
}

interface TalentTab {
  id: number
  name: string
  pointsSpent: number
  talents: Map<string, TalentTreeNode>
}

const props = defineProps<{
  talents: TalentData[]
  characterClass: number
  activeSpec: number
}>()

const activeTab = ref(0)

// Map class to tab names (WoW 3.3.5a talent trees)
const classTabNames: Record<number, string[]> = {
  1: ['Arms', 'Fury', 'Protection'], // Warrior
  2: ['Holy', 'Protection', 'Retribution'], // Paladin
  3: ['Beast Mastery', 'Marksmanship', 'Survival'], // Hunter
  4: ['Assassination', 'Combat', 'Subtlety'], // Rogue
  5: ['Discipline', 'Holy', 'Shadow'], // Priest
  6: ['Blood', 'Frost', 'Unholy'], // Death Knight
  7: ['Elemental', 'Enhancement', 'Restoration'], // Shaman
  8: ['Arcane', 'Fire', 'Frost'], // Mage
  9: ['Affliction', 'Demonology', 'Destruction'], // Warlock
  11: ['Balance', 'Feral Combat', 'Restoration'] // Druid
}

// Build talent tabs from character talent data
const tabs = computed<TalentTab[]>(() => {
  const tabNames = classTabNames[props.characterClass] || ['Spec 1', 'Spec 2', 'Spec 3']
  const tabData: TalentTab[] = tabNames.map((name, idx) => ({
    id: idx,
    name,
    pointsSpent: 0,
    talents: new Map()
  }))

  // Class mask to tab ID mapping
  // ClassMask: 1=Warrior, 2=Paladin, 4=Hunter, 8=Rogue, 16=Priest, 32=DK, 64=Shaman, 128=Mage, 256=Warlock, 1024=Druid
  const classTabIds: Record<number, number[]> = {
    1: [161, 164, 163],     // Warrior: Arms, Fury, Protection
    2: [382, 383, 381],     // Paladin: Holy, Protection, Retribution
    3: [361, 363, 362],     // Hunter: Beast Mastery, Marksmanship, Survival
    4: [182, 181, 183],     // Rogue: Assassination, Combat, Subtlety
    5: [201, 202, 203],     // Priest: Discipline, Holy, Shadow
    6: [398, 399, 400],     // Death Knight: Blood, Frost, Unholy
    7: [261, 263, 262],     // Shaman: Elemental, Enhancement, Restoration
    8: [81, 41, 61],        // Mage: Arcane, Fire, Frost
    9: [302, 303, 301],     // Warlock: Affliction, Demonology, Destruction
    11: [283, 281, 282]     // Druid: Balance, Feral Combat, Restoration
  }

  const classTabs = classTabIds[props.characterClass] || []

  // Group talents by tab
  for (const talent of props.talents) {
    if (!talent.tabId || talent.tier === undefined || talent.column === undefined) {
      console.log('[TalentTree] Skipping talent - missing data:', {
        spell: talent.spell,
        tabId: talent.tabId,
        tier: talent.tier,
        column: talent.column
      })
      continue
    }

    // Map actual DBC tab ID to our 0-2 index based on class
    const tabIdx = classTabs.indexOf(talent.tabId)

    if (tabIdx < 0 || tabIdx >= tabData.length) {
      console.log('[TalentTree] Unknown tab ID for class:', {
        classId: props.characterClass,
        tabId: talent.tabId,
        expectedTabs: classTabs
      })
      continue
    }

    const tab = tabData[tabIdx]
    if (!tab) continue

    // Determine rank from spell name/rank
    const rankMatch = talent.spellRank?.match(/Rank (\d+)/)
    const rank = rankMatch && rankMatch[1] ? parseInt(rankMatch[1], 10) : 1

    // Get max rank by counting how many spells this talent has
    // For simplicity, assume max rank = current rank if we don't have full data
    const maxRank = rank // TODO: Could be improved with full DBC data

    const key = `${talent.tier}-${talent.column}`
    const existing = tab.talents.get(key)

    if (!existing || rank > existing.rank) {
      tab.talents.set(key, {
        talentId: talent.talentId!,
        tier: talent.tier,
        column: talent.column,
        spell: talent.spell,
        spellName: talent.spellName || `Spell ${talent.spell}`,
        rank,
        maxRank
      })
      tab.pointsSpent = Array.from(tab.talents.values()).reduce((sum, t) => sum + t.rank, 0)
    }
  }

  return tabData
})

const currentTab = computed(() => tabs.value[activeTab.value])

function getTalentAt(tier: number, col: number): TalentTreeNode | null {
  if (!currentTab.value) return null
  const key = `${tier}-${col}`
  return currentTab.value.talents.get(key) || null
}

function getTalentRank(talent: TalentTreeNode | null): number {
  return talent?.rank || 0
}

function getMaxRank(talent: TalentTreeNode | null): number {
  return talent?.maxRank || 5
}

function isMaxRank(talent: TalentTreeNode | null): boolean {
  if (!talent) return false
  return talent.rank >= talent.maxRank
}

function getTalentName(talent: TalentTreeNode | null): string {
  if (!talent) return ''
  // Remove "Rank X" from name
  return talent.spellName.replace(/\s*Rank \d+\s*$/, '')
}

function getTalentTooltip(talent: TalentTreeNode | null): string {
  if (!talent) return ''
  return `${talent.spellName}\nRank ${talent.rank}/${talent.maxRank}`
}

function canLearnTalent(talent: TalentTreeNode | null): boolean {
  if (!talent) return false
  // Simplified: In real WoW, you need enough points in tree + prerequisites
  return true
}
</script>

<style scoped>
.talent-tree-viewer {
  background: #1a1d2e;
  border-radius: 0.5rem;
  padding: 1.5rem;
  color: #e5e7eb;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #374151;
  padding-bottom: 0.5rem;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  position: relative;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tab-button:hover {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

.tab-button.active {
  color: #fff;
  border-bottom: 3px solid #60a5fa;
}

.points-badge {
  background: #3b82f6;
  color: white;
  border-radius: 9999px;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 1.5rem;
  text-align: center;
}

.talent-tree {
  margin-top: 1rem;
}

.tree-grid {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.tier-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.talent-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.talent-node {
  width: 100%;
  height: 100%;
  background: rgba(30, 41, 59, 0.8);
  border: 2px solid #475569;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
}

.talent-node:hover {
  border-color: #60a5fa;
  background: rgba(59, 130, 246, 0.2);
  transform: scale(1.05);
  z-index: 10;
}

.talent-node.active {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.2);
}

.talent-node.maxed {
  border-color: #fbbf24;
  background: rgba(251, 191, 36, 0.2);
}

.talent-node.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.talent-icon {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}

.icon-placeholder {
  filter: grayscale(100%);
}

.talent-node.active .icon-placeholder {
  filter: grayscale(0%);
}

.talent-rank {
  font-size: 0.875rem;
  font-weight: 700;
  color: #10b981;
  margin-top: 0.25rem;
}

.talent-node.maxed .talent-rank {
  color: #fbbf24;
}

.talent-name {
  font-size: 0.7rem;
  color: #9ca3af;
  margin-top: 0.25rem;
  line-height: 1.2;
  max-height: 2.4em;
  overflow: hidden;
}

.tree-info {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid #3b82f6;
  border-radius: 0.375rem;
  padding: 1rem;
  margin-top: 1rem;
}

.tree-info p {
  margin: 0.5rem 0;
  color: #e5e7eb;
}

.tree-info strong {
  color: #60a5fa;
}

@media (max-width: 768px) {
  .tabs {
    flex-direction: column;
  }

  .tab-button {
    justify-content: center;
  }
}
</style>
