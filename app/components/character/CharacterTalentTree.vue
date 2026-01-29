<template>
  <div class="talent-tree-viewer">
    <!-- Loading state -->
    <div v-if="treePending" class="loading-state">
      <span class="loading-spinner">⏳</span>
      <p>Loading talent tree...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="treeError" class="error-state">
      <p>Failed to load talent tree</p>
    </div>

    <!-- Talent tree content -->
    <template v-else-if="talentTree">
      <!-- Spec tabs -->
      <div class="spec-tabs">
        <button
          v-for="(tab, index) in talentTree.tabs"
          :key="tab.id"
          class="spec-tab"
          :class="{ active: activeTabIndex === index }"
          @click="activeTabIndex = index"
        >
          <img
            v-if="tab.iconTexture"
            :src="getIconUrl(tab.iconTexture)"
            :alt="tab.name"
            class="spec-icon"
            @error="onIconError"
          />
          <div class="spec-info">
            <span class="spec-name">{{ tab.name || getDefaultTabName(index) }}</span>
            <span class="spec-points">{{ getTabPointsSpent(tab) }} points</span>
          </div>
        </button>
      </div>

      <!-- Talent grid -->
      <div v-if="currentTab" class="talent-grid-container">
        <div class="talent-grid">
          <div
            v-for="tierIndex in maxTiers"
            :key="`tier-${tierIndex}`"
            class="talent-row"
          >
            <div
              v-for="colIndex in 4"
              :key="`col-${colIndex}`"
              class="talent-cell"
            >
              <div
                v-if="getTalentNode(tierIndex - 1, colIndex - 1)"
                class="talent-node"
                :class="getTalentNodeClasses(getTalentNode(tierIndex - 1, colIndex - 1)!)"
                @mouseenter="handleMouseEnter($event, getTalentNode(tierIndex - 1, colIndex - 1)!)"
                @mouseleave="handleMouseLeave"
                @touchstart="handleTouchStart($event, getTalentNode(tierIndex - 1, colIndex - 1)!)"
              >
                <div class="talent-icon-container">
                  <img
                    :src="getIconUrl(getTalentNode(tierIndex - 1, colIndex - 1)!.iconTexture)"
                    :alt="getTalentName(getTalentNode(tierIndex - 1, colIndex - 1)!)"
                    class="talent-icon"
                    @error="onIconError"
                  />
                  <div class="talent-rank-badge">
                    {{ getCurrentRank(getTalentNode(tierIndex - 1, colIndex - 1)!) }}/{{ getTalentNode(tierIndex - 1, colIndex - 1)!.maxRank }}
                  </div>
                </div>
              </div>
              <div v-else class="talent-empty"></div>
            </div>
          </div>
        </div>

        <!-- Tree summary -->
        <div class="tree-summary">
          <div class="summary-stat">
            <span class="summary-label">Points Spent</span>
            <span class="summary-value">{{ getTabPointsSpent(currentTab) }}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-label">Required Level</span>
            <span class="summary-value">{{ getRequiredLevel(currentTab) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Tooltip -->
    <Teleport to="body">
      <!-- Mobile backdrop -->
      <div
        v-if="tooltipVisible && isMobileTooltip"
        class="tooltip-backdrop"
        @click="onTooltipBackdropClick"
      ></div>
      <div
        v-if="tooltipVisible && tooltipTalent"
        class="talent-tooltip"
        :class="{ 'mobile-tooltip': isMobileTooltip }"
        :style="tooltipStyle"
        @click.stop
      >
        <button v-if="isMobileTooltip" class="tooltip-close" @click="hideTooltip">×</button>
        <div class="tooltip-header">
          <h4 class="tooltip-name">{{ getTalentName(tooltipTalent) }}</h4>
          <span class="tooltip-rank">
            Rank {{ getCurrentRank(tooltipTalent) }}/{{ tooltipTalent.maxRank }}
          </span>
        </div>
        <div class="tooltip-tier">
          Tier {{ tooltipTalent.tier + 1 }} Talent
        </div>
        <div v-if="getCurrentRankInfo(tooltipTalent)" class="tooltip-description">
          {{ formatDescription(getCurrentRankInfo(tooltipTalent)!.description, getCurrentRankInfo(tooltipTalent)) }}
        </div>
        <div v-if="getNextRankInfo(tooltipTalent)" class="tooltip-next-rank">
          <div class="next-rank-header">Next Rank:</div>
          <div class="next-rank-description">
            {{ formatDescription(getNextRankInfo(tooltipTalent)!.description, getNextRankInfo(tooltipTalent)) }}
          </div>
        </div>
        <div v-if="tooltipTalent.prereqTalent" class="tooltip-prereq">
          Requires {{ tooltipTalent.prereqRank }} points in {{ getPrereqTalentName(tooltipTalent) }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TalentTreeResponse, TalentTreeTab, TalentTreeNode, TalentRankInfo, CharacterTalent, SpellEffectValues } from '~/types'

const props = defineProps<{
  talents: CharacterTalent[]
  characterClass: number
  activeSpec: number
}>()

// Fetch complete talent tree for the class
const { data: talentTree, pending: treePending, error: treeError } = await useFetch<TalentTreeResponse>(
  () => `/api/characters/talent-tree/${props.characterClass}`,
  { key: `talent-tree-${props.characterClass}` }
)

// Active tab state
const activeTabIndex = ref(0)

// Get the current tab
const currentTab = computed(() => {
  if (!talentTree.value?.tabs) return null
  return talentTree.value.tabs[activeTabIndex.value]
})

// Calculate max tiers for the grid
const maxTiers = computed(() => {
  if (!currentTab.value) return 7
  let maxTier = 0
  for (const talent of currentTab.value.talents) {
    if (talent.tier > maxTier) maxTier = talent.tier
  }
  return Math.max(maxTier + 1, 7)
})

// Create a map of character's learned talents for quick lookup
const learnedTalents = computed(() => {
  const map = new Map<number, number>() // talentId -> currentRank
  for (const talent of props.talents) {
    if (talent.talentId !== undefined) {
      map.set(talent.talentId, talent.currentRank)
    }
  }
  return map
})

// Get talent at specific position
function getTalentNode(tier: number, col: number): TalentTreeNode | null {
  if (!currentTab.value) return null
  return currentTab.value.talents.find(t => t.tier === tier && t.column === col) || null
}

// Get current rank of a talent (0 if not learned)
function getCurrentRank(talent: TalentTreeNode): number {
  return learnedTalents.value.get(talent.talentId) || 0
}

// Get talent name (from first rank spell)
function getTalentName(talent: TalentTreeNode): string {
  if (!talent.ranks || talent.ranks.length === 0) return 'Unknown'
  const firstRank = talent.ranks[0]
  if (!firstRank) return 'Unknown'
  return firstRank.spellName.replace(/\s*Rank \d+\s*$/, '')
}

// Get current rank info
function getCurrentRankInfo(talent: TalentTreeNode): TalentRankInfo | null {
  const rank = getCurrentRank(talent)
  if (rank === 0) {
    // Show first rank for unlearned talents
    return talent.ranks[0] || null
  }
  return talent.ranks[rank - 1] || null
}

// Get next rank info
function getNextRankInfo(talent: TalentTreeNode): TalentRankInfo | null {
  const rank = getCurrentRank(talent)
  if (rank >= talent.maxRank) return null
  return talent.ranks[rank] || null
}

/**
 * Format duration from milliseconds to human-readable string
 * Examples: "10 sec", "1 min", "2 min", "1 hour"
 */
function formatDuration(ms: number): string {
  if (ms <= 0) return ''

  const seconds = Math.round(ms / 1000)

  if (seconds < 60) {
    return `${seconds} sec`
  }

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.round(minutes / 60)
  if (hours === 1) {
    return `1 hour`
  }
  return `${hours} hours`
}

/**
 * Parse and format WoW spell description, replacing placeholders with actual values
 * Handles patterns like:
 * - $s1, $s2, $s3 - Spell effect values (base points + 1)
 * - $m1, $m2, $m3 - Misc values
 * - $t1, $t2, $t3 - Duration/period in seconds
 * - $a1, $a2, $a3 - Amplitude values
 * - $n - Chain targets
 * - $h - Proc chance
 * - $d - Duration in milliseconds (formatted to sec/min/hour)
 * - ${expression} - Lua-like expressions
 */
function formatDescription(desc: string, rankInfo?: TalentRankInfo | null): string {
  if (!desc) return ''

  const effectValues = rankInfo?.effectValues

  let result = desc

  if (effectValues) {
    // Replace simple placeholders with their values
    // $s1, $s2, $s3 - spell effect values
    result = result.replace(/\$s1/gi, String(effectValues.s1))
    result = result.replace(/\$s2/gi, String(effectValues.s2))
    result = result.replace(/\$s3/gi, String(effectValues.s3))

    // $m1, $m2, $m3 - misc values (often used for percentages)
    result = result.replace(/\$m1/gi, String(Math.abs(effectValues.m1)))
    result = result.replace(/\$m2/gi, String(Math.abs(effectValues.m2)))
    result = result.replace(/\$m3/gi, String(Math.abs(effectValues.m3)))

    // $t1, $t2, $t3 - period/tick time in seconds
    result = result.replace(/\$t1/gi, String(effectValues.t1))
    result = result.replace(/\$t2/gi, String(effectValues.t2))
    result = result.replace(/\$t3/gi, String(effectValues.t3))

    // $a1, $a2, $a3 - amplitude/multiple values
    result = result.replace(/\$a1/gi, String(effectValues.a1))
    result = result.replace(/\$a2/gi, String(effectValues.a2))
    result = result.replace(/\$a3/gi, String(effectValues.a3))

    // $n - chain targets
    result = result.replace(/\$n/gi, String(effectValues.n))

    // $h - proc chance
    result = result.replace(/\$h/gi, String(effectValues.h))

    // $q - proc charges
    result = result.replace(/\$q/gi, String(effectValues.q))

    // $x1, $x2, $x3 - chain targets per effect
    result = result.replace(/\$x1/gi, String(effectValues.x1))
    result = result.replace(/\$x2/gi, String(effectValues.x2))
    result = result.replace(/\$x3/gi, String(effectValues.x3))

    // Handle ${$m2/-1000}.1 type expressions (division with formatting)
    result = result.replace(/\$\{\s*\$([a-z])(\d)\s*\/\s*(-?\d+)\s*\}\.?(\d)?/gi, (match, varType, varNum, divisor, decimals) => {
      const key = `${varType.toLowerCase()}${varNum}` as keyof SpellEffectValues
      const value = effectValues[key] as number || 0
      const divValue = parseFloat(divisor)
      const calculated = Math.abs(value / divValue)
      const decimalPlaces = decimals ? parseInt(decimals) : 0
      return calculated.toFixed(decimalPlaces)
    })

    // Handle ${$s1*X} type expressions (multiplication)
    result = result.replace(/\$\{\s*\$([a-z])(\d)\s*\*\s*(-?\d+(?:\.\d+)?)\s*\}/gi, (match, varType, varNum, multiplier) => {
      const key = `${varType.toLowerCase()}${varNum}` as keyof SpellEffectValues
      const value = effectValues[key] as number || 0
      const multValue = parseFloat(multiplier)
      return String(Math.round(Math.abs(value * multValue)))
    })

    // Handle simple ${$s1} expressions
    result = result.replace(/\$\{\s*\$([a-z])(\d)\s*\}/gi, (match, varType, varNum) => {
      const key = `${varType.toLowerCase()}${varNum}` as keyof SpellEffectValues
      const value = effectValues[key] as number || 0
      return String(Math.abs(value))
    })

    // Handle $/1000;s1 type patterns (division with semicolon: value/divisor;variable)
    result = result.replace(/\$\/(-?\d+);([a-z])(\d)/gi, (match, divisor, varType, varNum) => {
      const key = `${varType.toLowerCase()}${varNum}` as keyof SpellEffectValues
      const value = effectValues[key] as number || 0
      const divValue = parseFloat(divisor)
      if (divValue === 0) return String(value)
      const calculated = Math.abs(value / divValue)
      // Return as integer if whole number, otherwise with 1 decimal
      return calculated % 1 === 0 ? String(calculated) : calculated.toFixed(1)
    })

    // Handle $*1000;s1 type patterns (multiplication with semicolon)
    result = result.replace(/\$\*(-?\d+);([a-z])(\d)/gi, (match, multiplier, varType, varNum) => {
      const key = `${varType.toLowerCase()}${varNum}` as keyof SpellEffectValues
      const value = effectValues[key] as number || 0
      const multValue = parseFloat(multiplier)
      return String(Math.round(Math.abs(value * multValue)))
    })

    // $d - duration (format from milliseconds to human readable)
    result = result.replace(/\$d/gi, () => {
      const durationMs = effectValues.d || 0
      if (durationMs <= 0) return ''
      return formatDuration(durationMs)
    })
  }

  // Handle $XXd patterns (reference to another spell's duration) - replace with generic duration text
  // $67d means "duration of spell 67"
  result = result.replace(/\$\d+d/gi, '[duration]')

  // Handle $XXdsY patterns (spell duration combined with effect) - clean these up
  result = result.replace(/\$\d+d[a-z]\d/gi, '[duration]')

  // Handle $XXsY patterns (reference to another spell's effect value) - we can't resolve cross-spell refs
  result = result.replace(/\$\d+s\d/gi, '[value]')

  // Handle $XXmY patterns (reference to another spell's misc value)
  result = result.replace(/\$\d+m\d/gi, '[value]')

  // Handle $XXo patterns (reference to another spell's periodic effect)
  result = result.replace(/\$\d+o\d?/gi, '[periodic]')

  // Clean up any remaining unresolved placeholders
  // Remove ${...} expressions that weren't handled
  result = result.replace(/\$\{[^}]+\}/g, '')

  // Remove $/X;Y or $*X;Y patterns that weren't handled
  result = result.replace(/\$[/*]-?\d+;[a-z]\d/gi, '')

  // Remove any remaining $XXX patterns (spell references like $67d)
  result = result.replace(/\$\d+[a-z]+\d*/gi, '')

  // Remove any remaining $X patterns that weren't substituted
  result = result.replace(/\$[a-z]\d*/gi, '')

  // Remove any remaining $ followed by numbers
  result = result.replace(/\$\d+/g, '')

  // Clean up multiple spaces and trim
  result = result.replace(/\s+/g, ' ').trim()

  // Remove orphaned % signs with nothing before them
  result = result.replace(/^\s*%\s*/g, '')

  return result
}

// Get CSS classes for talent node
function getTalentNodeClasses(talent: TalentTreeNode) {
  const rank = getCurrentRank(talent)
  return {
    learned: rank > 0,
    maxed: rank >= talent.maxRank,
    unlearned: rank === 0
  }
}

// Get default tab name if DBC name is empty
function getDefaultTabName(index: number): string {
  const classTabNames: Record<number, string[]> = {
    1: ['Arms', 'Fury', 'Protection'],
    2: ['Holy', 'Protection', 'Retribution'],
    3: ['Beast Mastery', 'Marksmanship', 'Survival'],
    4: ['Assassination', 'Combat', 'Subtlety'],
    5: ['Discipline', 'Holy', 'Shadow'],
    6: ['Blood', 'Frost', 'Unholy'],
    7: ['Elemental', 'Enhancement', 'Restoration'],
    8: ['Arcane', 'Fire', 'Frost'],
    9: ['Affliction', 'Demonology', 'Destruction'],
    11: ['Balance', 'Feral Combat', 'Restoration']
  }
  return classTabNames[props.characterClass]?.[index] || `Spec ${index + 1}`
}

// Calculate points spent in a tab
function getTabPointsSpent(tab: TalentTreeTab): number {
  let points = 0
  for (const talent of tab.talents) {
    points += getCurrentRank(talent)
  }
  return points
}

// Calculate required level for spent points
function getRequiredLevel(tab: TalentTreeTab): number {
  const points = getTabPointsSpent(tab)
  if (points === 0) return 10
  return Math.floor(points / 5) * 2 + 10
}

// Get icon URL from texture path
function getIconUrl(texture: string): string {
  if (!texture) return 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'

  // Extract just the icon filename from path like "Interface\\Icons\\Ability_BackStab"
  const parts = texture.split('\\')
  const filename = parts[parts.length - 1]
  if (!filename) return 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'

  return `https://wow.zamimg.com/images/wow/icons/large/${filename.toLowerCase()}.jpg`
}

function onIconError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'
}

// Get prerequisite talent name
function getPrereqTalentName(talent: TalentTreeNode): string {
  if (!talent.prereqTalent || !currentTab.value) return 'Unknown'
  const prereq = currentTab.value.talents.find(t => t.talentId === talent.prereqTalent)
  if (prereq) return getTalentName(prereq)
  return 'Unknown'
}

// Tooltip state
const tooltipVisible = ref(false)
const tooltipTalent = ref<TalentTreeNode | null>(null)
const tooltipStyle = ref<Record<string, string>>({})
const isMobileTooltip = ref(false)
const isTouch = ref(false)

// Detect if device supports touch or is a small screen
function isMobileDevice(): boolean {
  return window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

function handleTouchStart(event: TouchEvent, talent: TalentTreeNode) {
  event.preventDefault()
  isTouch.value = true

  // Toggle tooltip if tapping same talent
  if (tooltipVisible.value && tooltipTalent.value?.talentId === talent.talentId) {
    hideTooltip()
    return
  }

  showTooltip(event, talent)
}

function handleMouseEnter(event: MouseEvent, talent: TalentTreeNode) {
  // Skip if this was triggered by a touch
  if (isTouch.value) return
  showTooltip(event, talent)
}

function handleMouseLeave() {
  // Skip if this was triggered by a touch
  if (isTouch.value) return
  hideTooltip()
}

function showTooltip(event: MouseEvent | TouchEvent, talent: TalentTreeNode) {
  tooltipTalent.value = talent
  tooltipVisible.value = true

  const mobile = isMobileDevice()
  isMobileTooltip.value = mobile

  if (mobile) {
    // On mobile, show as fixed bottom panel - no positioning needed
    tooltipStyle.value = {}
    return
  }

  // Desktop: Position tooltip near the element
  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()
  const tooltipWidth = 320
  const tooltipHeight = 300

  let left = rect.right + 12
  let top = rect.top

  // Flip to left if not enough space on right
  if (left + tooltipWidth > window.innerWidth) {
    left = rect.left - tooltipWidth - 12
  }

  // Adjust if too low
  if (top + tooltipHeight > window.innerHeight) {
    top = window.innerHeight - tooltipHeight - 12
  }

  // Ensure not off screen top
  if (top < 12) top = 12

  tooltipStyle.value = {
    left: `${left}px`,
    top: `${top}px`
  }
}

function hideTooltip() {
  tooltipVisible.value = false
  tooltipTalent.value = null
  isMobileTooltip.value = false
  // Reset touch flag after a short delay to allow for next interaction
  setTimeout(() => {
    isTouch.value = false
  }, 300)
}

// Handle click outside to close mobile tooltip
function onTooltipBackdropClick() {
  if (isMobileTooltip.value) {
    hideTooltip()
  }
}
</script>

<style scoped>
.talent-tree-viewer {
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border-primary, #334155);
  border-radius: 0.75rem;
  padding: 1.5rem;
  color: var(--text-primary, #e2e8f0);
}

/* Loading & Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-secondary, #94a3b8);
}

.loading-spinner {
  font-size: 2rem;
  margin-bottom: 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Spec Tabs */
.spec-tabs {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #334155);
  padding-bottom: 1rem;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--blue-primary, #3b82f6) var(--bg-primary, #0f172a);
	flex-wrap: wrap;
}

.spec-tabs::-webkit-scrollbar {
  height: 6px;
}

.spec-tabs::-webkit-scrollbar-track {
  background: var(--bg-primary, #0f172a);
  border-radius: 3px;
}

.spec-tabs::-webkit-scrollbar-thumb {
  background: var(--blue-primary, #3b82f6);
  border-radius: 3px;
}

.spec-tab {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-primary, #0f172a);
  border: 1px solid var(--border-primary, #334155);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.spec-tab:hover {
  border-color: var(--border-secondary, #475569);
  background: rgba(59, 130, 246, 0.05);
}

.spec-tab.active {
  border-color: var(--blue-primary, #3b82f6);
  background: rgba(59, 130, 246, 0.1);
}

.spec-icon {
  width: 32px;
  height: 32px;
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.spec-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.spec-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-primary, #e2e8f0);
}

.spec-tab.active .spec-name {
  color: var(--blue-light, #60a5fa);
}

.spec-points {
  font-size: 0.8125rem;
  color: var(--text-secondary, #94a3b8);
  font-weight: 500;
}

/* Talent Grid Container */
.talent-grid-container {
  background: var(--bg-primary, #0f172a);
  border: 1px solid var(--border-primary, #334155);
  border-radius: 0.5rem;
  padding: 1rem;
}

.talent-grid {
  display: grid;
  gap: 0.5rem;
}

.talent-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.talent-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.talent-empty {
  width: 100%;
  height: 100%;
}

/* Talent Node */
.talent-node {
  width: 100%;
  height: 100%;
  max-width: 64px;
  max-height: 64px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 0.5rem;
  border: 2px solid var(--border-primary, #334155);
  background: var(--bg-secondary, #1e293b);
  overflow: hidden;
}

.talent-node:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.talent-node.unlearned {
  opacity: 0.5;
  filter: grayscale(60%);
}

.talent-node.unlearned:hover {
  opacity: 0.8;
  filter: grayscale(30%);
}

.talent-node.learned {
  border-color: var(--success, #22c55e);
  opacity: 1;
  filter: none;
}

.talent-node.maxed {
  border-color: var(--orange-primary, #f59e0b);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.3);
}

.talent-icon-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.talent-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s;
}

.talent-node:hover .talent-icon {
  transform: scale(1.05);
}

.talent-rank-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.85);
  color: var(--success, #22c55e);
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.125rem 0.3rem;
  border-radius: 0.25rem;
  line-height: 1;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.talent-node.maxed .talent-rank-badge {
  color: var(--orange-primary, #f59e0b);
  border-color: rgba(245, 158, 11, 0.3);
}

.talent-node.unlearned .talent-rank-badge {
  color: var(--text-muted, #64748b);
  border-color: rgba(100, 116, 139, 0.3);
}

/* Tree Summary */
.tree-summary {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary, #334155);
}

.summary-stat {
  display: flex;
  flex-direction: column;
}

.summary-label {
  font-size: 0.8125rem;
  color: var(--text-secondary, #94a3b8);
}

.summary-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--blue-light, #60a5fa);
}

/* Tooltip */
.talent-tooltip {
  position: fixed;
  z-index: 9999;
  width: 320px;
  max-width: calc(100vw - 24px);
  background: var(--bg-secondary, #1e293b);
  border: 2px solid var(--border-secondary, #475569);
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-primary, #334155);
}

.tooltip-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #e2e8f0);
}

.tooltip-rank {
  font-size: 0.8125rem;
  color: var(--success, #22c55e);
  font-weight: 600;
  white-space: nowrap;
}

.tooltip-tier {
  font-size: 0.8125rem;
  color: var(--text-muted, #64748b);
  margin-bottom: 0.75rem;
}

.tooltip-description {
  font-size: 0.875rem;
  color: var(--orange-light, #fbbf24);
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.tooltip-next-rank {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.next-rank-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--blue-light, #60a5fa);
  margin-bottom: 0.375rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.next-rank-description {
  font-size: 0.8125rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.5;
}

.tooltip-prereq {
  font-size: 0.8125rem;
  color: var(--error, #ef4444);
  font-style: italic;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-primary, #334155);
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .talent-tree-viewer {
    padding: 1rem;
  }

  .spec-tabs {
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
  }

  .spec-tab {
    padding: 0.5rem 0.75rem;
  }

  .spec-icon {
    width: 28px;
    height: 28px;
  }

  .spec-name {
    font-size: 0.8125rem;
  }

  .spec-points {
    font-size: 0.75rem;
  }

  .talent-grid-container {
    padding: 0.75rem;
  }

  .talent-row {
    gap: 0.375rem;
  }

  .talent-node {
    max-width: 56px;
    max-height: 56px;
  }

  .talent-rank-badge {
    font-size: 0.5625rem;
    padding: 0.0625rem 0.1875rem;
  }

  .tree-summary {
    gap: 1rem;
  }

  .summary-label {
    font-size: 0.75rem;
  }

  .summary-value {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .talent-tree-viewer {
    padding: 0.75rem;
  }

  .spec-tab {
    padding: 0.375rem 0.5rem;
    gap: 0.5rem;
  }

  .spec-icon {
    width: 24px;
    height: 24px;
  }

  .spec-name {
    font-size: 0.75rem;
  }

  .spec-points {
    font-size: 0.6875rem;
  }

  .talent-grid-container {
    padding: 0.5rem;
  }

  .talent-row {
    gap: 0.25rem;
  }

  .talent-node {
    max-width: 48px;
    max-height: 48px;
    border-width: 1.5px;
  }

  .talent-rank-badge {
    font-size: 0.5rem;
    padding: 0.03125rem 0.125rem;
    bottom: 1px;
    right: 1px;
  }

  .tree-summary {
    flex-direction: column;
    gap: 0.5rem;
  }

  .summary-stat {
    flex-direction: row;
    justify-content: space-between;
  }

  .talent-tooltip {
    width: 280px;
    padding: 0.75rem;
  }

  .tooltip-name {
    font-size: 0.9375rem;
  }

  .tooltip-description,
  .next-rank-description {
    font-size: 0.8125rem;
  }
}

/* Touch devices - show tooltip on tap */
@media (hover: none) {
  .talent-node {
    -webkit-tap-highlight-color: transparent;
  }
}

/* Mobile Tooltip Backdrop */
.tooltip-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 9998;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Mobile Tooltip Styles */
.talent-tooltip.mobile-tooltip {
  position: fixed;
  left: 50% !important;
  top: auto !important;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 100%;
  border-radius: 1rem 1rem 0 0;
  max-height: 70vh;
  overflow-y: auto;
  animation: slideUp 0.25s ease-out;
  pointer-events: auto;
  padding-top: 2.5rem;
}

@keyframes slideUp {
  from {
    transform: translateX(-50%) translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
}

.tooltip-close {
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  background: none;
  border: none;
  color: var(--text-secondary, #94a3b8);
  font-size: 1.75rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.25rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.tooltip-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #e2e8f0);
}

/* Ensure mobile tooltip has proper safe area padding */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .talent-tooltip.mobile-tooltip {
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
}
</style>
