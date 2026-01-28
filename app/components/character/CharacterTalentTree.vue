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
              <div class="talent-icon-wrapper">
                <img
                  :src="getSpellIconUrl(getTalentAt(tier - 1, col - 1))"
                  :alt="getTalentName(getTalentAt(tier - 1, col - 1))"
                  class="talent-icon"
                  @error="onImageError"
                />
                <div class="talent-rank-overlay">
                  {{ getTalentRank(getTalentAt(tier - 1, col - 1)) }}/{{ getMaxRank(getTalentAt(tier - 1, col - 1)) }}
                </div>
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
  currentRank: number
  maxRank: number
  spellIconTexture?: string
}

interface TalentTreeNode {
  talentId: number
  tier: number
  column: number
  spell: number
  spellName: string
  spellIconTexture: string
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

    const key = `${talent.tier}-${talent.column}`
    const existing = tab.talents.get(key)

    // Always use the highest rank spell for each talent position
    if (!existing || talent.currentRank > existing.rank) {
      tab.talents.set(key, {
        talentId: talent.talentId!,
        tier: talent.tier,
        column: talent.column,
        spell: talent.spell,
        spellName: talent.spellName || `Spell ${talent.spell}`,
        spellIconTexture: talent.spellIconTexture || '',
        rank: talent.currentRank,
        maxRank: talent.maxRank
      })
    }

    // Recalculate points spent
    tab.pointsSpent = Array.from(tab.talents.values()).reduce((sum, t) => sum + t.rank, 0)
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

function getSpellIconUrl(talent: TalentTreeNode | null): string {
  if (!talent?.spellIconTexture) return 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'

  // Extract just the icon filename from the path
  // Format: "Interface\\Icons\\Ability_BackStab" -> "ability_backstab"
  const parts = talent.spellIconTexture.split('\\')
  const filename = parts[parts.length - 1]
  if (!filename) return 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'

  return `https://wow.zamimg.com/images/wow/icons/large/${filename.toLowerCase()}.jpg`
}

function onImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'
}
</script>

<style scoped>
.talent-tree-viewer {
  background: #1a1d2e;
  border-radius: 0.5rem;
  padding: 1rem;
  color: #e5e7eb;
  width: 100%;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid #374151;
  padding-bottom: 0.5rem;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: #3b82f6 #1e293b;
}

.tabs::-webkit-scrollbar {
  height: 6px;
}

.tabs::-webkit-scrollbar-track {
  background: #1e293b;
  border-radius: 3px;
}

.tabs::-webkit-scrollbar-thumb {
  background: #3b82f6;
  border-radius: 3px;
}

.tab-button {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  position: relative;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.tab-button:hover {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
  border-radius: 0.25rem;
}

.tab-button.active {
  color: #fff;
  border-bottom: 3px solid #60a5fa;
}

.points-badge {
  background: #3b82f6;
  color: white;
  border-radius: 9999px;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  min-width: 1.25rem;
  text-align: center;
}

.talent-tree {
  margin-top: 0.5rem;
}

.tree-grid {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 1rem;
  max-width: 100%;
  overflow-x: auto;
}

.tier-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.375rem;
  min-width: 280px;
}

.talent-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.talent-node {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
  border: 2px solid #475569;
  border-radius: 0.5rem;
  padding: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.talent-node::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0), rgba(59, 130, 246, 0.1));
  opacity: 0;
  transition: opacity 0.2s;
}

.talent-node:hover::before {
  opacity: 1;
}

.talent-node:hover {
  border-color: #60a5fa;
  transform: scale(1.05);
  z-index: 10;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.talent-node.active {
  border-color: #10b981;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1));
}

.talent-node.maxed {
  border-color: #fbbf24;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1));
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
}

.talent-node.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(60%);
}

.talent-icon-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0.375rem;
  overflow: hidden;
  margin-bottom: 0.25rem;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.talent-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s;
}

.talent-node:hover .talent-icon {
  transform: scale(1.1);
}

.talent-node.disabled .talent-icon {
  filter: grayscale(100%) brightness(0.6);
}

.talent-rank-overlay {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.8);
  color: #10b981;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  line-height: 1;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.talent-node.maxed .talent-rank-overlay {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.3);
}

.talent-name {
  font-size: 0.625rem;
  color: #cbd5e1;
  line-height: 1.2;
  max-height: 2.4em;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  font-weight: 500;
}

.talent-node.active .talent-name {
  color: #f0fdf4;
  font-weight: 600;
}

.tree-info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1));
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin-top: 1rem;
  font-size: 0.875rem;
}

.tree-info p {
  margin: 0.25rem 0;
  color: #e5e7eb;
}

.tree-info strong {
  color: #60a5fa;
  font-weight: 700;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .talent-tree-viewer {
    padding: 0.5rem;
  }

  .tabs {
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
  }

  .tab-button {
    padding: 0.375rem 0.625rem;
    font-size: 0.6875rem;
  }

  .points-badge {
    font-size: 0.5625rem;
    padding: 0.0625rem 0.25rem;
    min-width: 1rem;
  }

  .tier-row {
    gap: 0.25rem;
    min-width: 220px;
  }

  .talent-node {
    padding: 0.125rem;
    border-width: 1.5px;
  }

  .talent-rank-overlay {
    font-size: 0.5rem;
    padding: 0.0625rem 0.125rem;
    bottom: 1px;
    right: 1px;
  }

  .talent-name {
    font-size: 0.5rem;
    line-height: 1.1;
  }

  .tree-info {
    padding: 0.5rem;
    font-size: 0.75rem;
    margin-top: 0.75rem;
  }
}

@media (max-width: 640px) {
  .talent-tree-viewer {
    padding: 0.375rem;
  }

  .tab-button {
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    gap: 0.25rem;
  }

  .points-badge {
    font-size: 0.5rem;
    padding: 0.0625rem 0.1875rem;
  }

  .tier-row {
    min-width: 200px;
    gap: 0.1875rem;
  }

  .talent-icon-wrapper {
    margin-bottom: 0.0625rem;
  }

  .talent-name {
    font-size: 0.4375rem;
  }

  .tree-info {
    padding: 0.375rem;
    font-size: 0.6875rem;
  }
}

@media (max-width: 480px) {
  .talent-tree-viewer {
    padding: 0.25rem;
  }

  .tabs {
    padding-bottom: 0.1875rem;
    margin-bottom: 0.375rem;
  }

  .tab-button {
    padding: 0.1875rem 0.375rem;
    font-size: 0.5625rem;
  }

  .tier-row {
    min-width: 180px;
    gap: 0.125rem;
  }

  .talent-node {
    padding: 0.0625rem;
    border-radius: 0.375rem;
  }

  .talent-rank-overlay {
    font-size: 0.4375rem;
    padding: 0.03125rem 0.09375rem;
  }

  .talent-name {
    font-size: 0.375rem;
    max-height: 1.8em;
  }

  .tree-info {
    margin-top: 0.5rem;
    padding: 0.25rem;
    font-size: 0.625rem;
  }

  .tree-info p {
    margin: 0.1875rem 0;
  }
}

/* Ultra-small screens */
@media (max-width: 360px) {
  .tier-row {
    min-width: 160px;
    gap: 0.09375rem;
  }

  .talent-node {
    border-width: 1px;
  }

  .talent-name {
    display: none; /* Hide names on very small screens */
  }

  .talent-rank-overlay {
    font-size: 0.375rem;
  }
}

/* Smooth scrolling for tree grid on mobile */
@media (max-width: 640px) {
  .tree-grid {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #3b82f6 #1e293b;
  }

  .tree-grid::-webkit-scrollbar {
    height: 6px;
  }

  .tree-grid::-webkit-scrollbar-track {
    background: #1e293b;
    border-radius: 3px;
  }

  .tree-grid::-webkit-scrollbar-thumb {
    background: #3b82f6;
    border-radius: 3px;
  }
}
</style>
