<script setup lang="ts">
/**
 * Shared WoW-style item tooltip component.
 *
 * Supports two interaction modes:
 *   - "hover"   – shows on mouseenter, hides on mouseleave (character armory)
 *   - "click"   – shows on click, overlay backdrop to close (shop)
 *
 * The parent supplies an `ItemTooltipData` object (already normalised).
 * See app/utils/item-tooltip.ts for converters from CharacterItem / ShopItemDetails.
 */
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import type { ItemTooltipData } from '~/types'
import { getStatName, getQualityColor, WOW_CLASSES, WOW_RACES } from '~/utils/wow'

const props = defineProps<{
  /** Normalised tooltip data – required when visible */
  item: ItemTooltipData | null
  /** Whether the tooltip is currently shown */
  show: boolean
  /**
   * Interaction mode:
   *   "hover" = desktop hover / mobile tap (character armory style)
   *   "click" = click-to-open with backdrop overlay (shop style)
   */
  mode?: 'hover' | 'click'
  /** Bounding rect of the trigger element, used for positioning */
  anchorRect?: DOMRect | null
  /** Optional: loading state (for async-fetch tooltips) */
  loading?: boolean
  /** Optional: error message */
  error?: string
  /** Optional: sell price formatter override */
  formatSellPrice?: (copper: number) => string
}>()

const emit = defineEmits<{
  close: []
}>()

const tooltipRef = ref<HTMLElement | null>(null)
const isMobile = ref(false)

function checkMobile() {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth <= 640
}

// --- Constants ---------------------------------------------------------------

const BONDING_TEXT: Record<number, string> = {
  1: 'Binds when picked up',
  2: 'Binds when equipped',
  3: 'Binds when used',
  4: 'Quest Item',
}

const DAMAGE_TYPE_NAMES: Record<number, string> = {
  0: '',
  1: 'Holy',
  2: 'Fire',
  3: 'Nature',
  4: 'Frost',
  5: 'Shadow',
  6: 'Arcane',
}

const SOCKET_COLORS: Record<number, { name: string; color: string }> = {
  1: { name: 'Meta', color: '#7c7c7c' },
  2: { name: 'Red', color: '#ff0000' },
  4: { name: 'Yellow', color: '#ffff00' },
  8: { name: 'Blue', color: '#3399ff' },
}

// --- Computed helpers ---------------------------------------------------------

const interactionMode = computed(() => props.mode ?? 'hover')

const tooltipStyle = computed(() => {
  // Mobile – centred / bottom-sheet handled by CSS
  if (isMobile.value) return {}

  if (!props.anchorRect) return {}

  const wh = typeof window !== 'undefined' ? window.innerHeight : 800
  const ww = typeof window !== 'undefined' ? window.innerWidth : 1200

  const top = Math.max(8, Math.min(props.anchorRect.top, wh - 400))
  const left = Math.min(props.anchorRect.right + 8, ww - 340)

  return {
    top: `${top}px`,
    left: `${left}px`,
  }
})

// --- Helpers -----------------------------------------------------------------

function getWeaponSpeed(delayMs: number): string {
  return (delayMs / 1000).toFixed(2)
}

function getWeaponDps(item: ItemTooltipData): string {
  const delay = item.delay ?? 0
  if (delay <= 0) return '0.0'
  let totalMin = item.dmgMin1 ?? 0
  let totalMax = item.dmgMax1 ?? 0
  if ((item.dmgMin2 ?? 0) > 0 || (item.dmgMax2 ?? 0) > 0) {
    totalMin += item.dmgMin2 ?? 0
    totalMax += item.dmgMax2 ?? 0
  }
  return ((totalMin + totalMax) / 2 / (delay / 1000)).toFixed(1)
}

function getResistances(item: ItemTooltipData): Array<{ name: string; value: number; color: string }> {
  const res: Array<{ name: string; value: number; color: string }> = []
  if (item.holyRes && item.holyRes > 0) res.push({ name: 'Holy Resistance', value: item.holyRes, color: '#ffcc00' })
  if (item.fireRes && item.fireRes > 0) res.push({ name: 'Fire Resistance', value: item.fireRes, color: '#ff4400' })
  if (item.natureRes && item.natureRes > 0) res.push({ name: 'Nature Resistance', value: item.natureRes, color: '#00cc00' })
  if (item.frostRes && item.frostRes > 0) res.push({ name: 'Frost Resistance', value: item.frostRes, color: '#3399ff' })
  if (item.shadowRes && item.shadowRes > 0) res.push({ name: 'Shadow Resistance', value: item.shadowRes, color: '#9933cc' })
  if (item.arcaneRes && item.arcaneRes > 0) res.push({ name: 'Arcane Resistance', value: item.arcaneRes, color: '#cc99ff' })
  return res
}

function getSocketEntries(item: ItemTooltipData): Array<{ name: string; color: string }> {
  const sockets: Array<{ name: string; color: string }> = []
  for (const colorVal of [item.socketColor1, item.socketColor2, item.socketColor3]) {
    if (colorVal && colorVal > 0 && SOCKET_COLORS[colorVal]) {
      sockets.push(SOCKET_COLORS[colorVal])
    }
  }
  return sockets
}

function getAllowedClasses(mask?: number): string[] | null {
  if (mask === undefined || mask <= 0 || mask === 0x7FFF) return null
  const classes: string[] = []
  for (const [id, name] of Object.entries(WOW_CLASSES)) {
    if (mask & (1 << (Number(id) - 1))) classes.push(name)
  }
  return classes.length > 0 ? classes : null
}

function getAllowedRaces(mask?: number): string[] | null {
  if (mask === undefined || mask <= 0 || mask === 0x7FFF) return null
  const races: string[] = []
  for (const [id, name] of Object.entries(WOW_RACES)) {
    if (mask & (1 << (Number(id) - 1))) races.push(name)
  }
  return races.length > 0 ? races : null
}

function formatDefaultSellPrice(copper: number): string {
  const gold = Math.floor(copper / 10000)
  const silver = Math.floor((copper % 10000) / 100)
  const copperRemainder = copper % 100
  const parts: string[] = []
  if (gold > 0) parts.push(`${gold}g`)
  if (silver > 0 || gold > 0) parts.push(`${silver}s`)
  parts.push(`${copperRemainder}c`)
  return parts.join(' ')
}

// --- Lifecycle & event handling ----------------------------------------------

function onOverlayClick() {
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.show,
  async (visible) => {
    if (visible) {
      checkMobile()
      document.addEventListener('keydown', onKeydown)
      await nextTick()
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <!-- Click mode: full overlay backdrop -->
    <div
      v-if="show && interactionMode === 'click'"
      class="tooltip-overlay"
      @click.self="onOverlayClick"
    >
      <div
        ref="tooltipRef"
        class="wow-tooltip"
        :class="{ 'is-mobile': isMobile }"
        :style="!isMobile && anchorRect ? tooltipStyle : {}"
      >
        <div v-if="loading" class="tooltip-loading">Loading...</div>
        <div v-else-if="error" class="tooltip-error">{{ error }}</div>
        <template v-else-if="item">
          <!-- Item name -->
          <div class="tooltip-name" :style="{ color: getQualityColor(item.quality) }">
            {{ item.name }}
          </div>

          <!-- Item Level -->
          <div class="tooltip-ilvl">Item Level {{ item.itemLevel }}</div>

          <!-- Bonding -->
          <div v-if="item.bonding && item.bonding > 0 && BONDING_TEXT[item.bonding]" class="tooltip-bonding">
            {{ BONDING_TEXT[item.bonding] }}
          </div>

          <!-- Unique -->
          <div v-if="item.maxCount === 1" class="tooltip-unique">Unique</div>
          <div v-else-if="item.maxCount && item.maxCount > 1" class="tooltip-unique">Unique ({{ item.maxCount }})</div>

          <!-- Slot & Type -->
          <div v-if="item.inventoryTypeName || item.subclassName" class="tooltip-slot-row">
            <span>{{ item.inventoryTypeName }}</span>
            <span>{{ item.subclassName }}</span>
          </div>

          <!-- Armor -->
          <div v-if="item.armor && item.armor > 0" class="tooltip-armor">{{ item.armor }} Armor</div>

          <!-- Block -->
          <div v-if="item.block && item.block > 0" class="tooltip-block">{{ item.block }} Block</div>

          <!-- Weapon damage (primary) -->
          <div v-if="(item.dmgMin1 ?? 0) > 0 || (item.dmgMax1 ?? 0) > 0" class="tooltip-damage-row">
            <span>
              {{ item.dmgMin1 }} - {{ item.dmgMax1 }}
              {{ DAMAGE_TYPE_NAMES[item.dmgType1 ?? 0] ? DAMAGE_TYPE_NAMES[item.dmgType1 ?? 0] + ' ' : '' }}Damage
            </span>
            <span v-if="item.delay" class="tooltip-speed">Speed {{ getWeaponSpeed(item.delay) }}</span>
          </div>

          <!-- Weapon damage (secondary) -->
          <div v-if="(item.dmgMin2 ?? 0) > 0 || (item.dmgMax2 ?? 0) > 0" class="tooltip-damage-secondary">
            +{{ item.dmgMin2 }} - {{ item.dmgMax2 }}
            {{ DAMAGE_TYPE_NAMES[item.dmgType2 ?? 0] || '' }} Damage
          </div>

          <!-- DPS -->
          <div v-if="(item.dmgMin1 ?? 0) > 0 && (item.delay ?? 0) > 0" class="tooltip-dps">
            ({{ getWeaponDps(item) }} damage per second)
          </div>

          <!-- Stats -->
          <div v-for="stat in item.stats" :key="stat.type" class="tooltip-stat">
            +{{ stat.value }} {{ getStatName(stat.type) }}
          </div>

          <!-- Resistances -->
          <div
            v-for="res in getResistances(item)"
            :key="res.name"
            class="tooltip-resistance"
            :style="{ color: res.color }"
          >
            +{{ res.value }} {{ res.name }}
          </div>

          <!-- Enchantments (equipped items only) -->
          <div v-if="item.enchantmentTexts?.length" class="tooltip-enchantments">
            <div v-for="(enchant, idx) in item.enchantmentTexts" :key="idx" class="tooltip-enchant">
              {{ enchant }}
            </div>
          </div>

          <!-- Sockets -->
          <div v-for="(socket, idx) in getSocketEntries(item)" :key="idx" class="tooltip-socket">
            <span class="socket-icon" :style="{ borderColor: socket.color }" />
            {{ socket.name }} Socket
          </div>

          <!-- Socket Bonus -->
          <div v-if="item.socketBonusName" class="tooltip-socket-bonus">
            Socket Bonus: {{ item.socketBonusName }}
          </div>

          <!-- Equip spell effects -->
          <div v-for="(effect, idx) in item.equipEffects" :key="`equip-${idx}`" class="tooltip-equip-effect">
            {{ effect }}
          </div>

          <!-- Durability -->
          <div v-if="item.maxDurability && item.maxDurability > 0" class="tooltip-durability">
            Durability {{ item.currentDurability ?? item.maxDurability }} / {{ item.maxDurability }}
          </div>

          <!-- Class restriction -->
          <div v-if="getAllowedClasses(item.allowableClass)" class="tooltip-restriction">
            Classes: {{ getAllowedClasses(item.allowableClass)!.join(', ') }}
          </div>

          <!-- Race restriction -->
          <div v-if="getAllowedRaces(item.allowableRace)" class="tooltip-restriction">
            Races: {{ getAllowedRaces(item.allowableRace)!.join(', ') }}
          </div>

          <!-- Required level -->
          <div v-if="item.requiredLevel > 1" class="tooltip-req-level">
            Requires Level {{ item.requiredLevel }}
          </div>

          <!-- Flavor text -->
          <div v-if="item.description" class="tooltip-flavor">"{{ item.description }}"</div>

          <!-- Sell price -->
          <div v-if="item.sellPrice && item.sellPrice > 0" class="tooltip-sell-price">
            Sell Price: {{ formatSellPrice ? formatSellPrice(item.sellPrice) : formatDefaultSellPrice(item.sellPrice) }}
          </div>
        </template>
      </div>
    </div>

    <!-- Hover mode: no backdrop, just the tooltip panel -->
    <div
      v-else-if="show && interactionMode === 'hover'"
      ref="tooltipRef"
      class="wow-tooltip wow-tooltip--hover"
      :class="{ 'is-mobile': isMobile }"
      :style="!isMobile && anchorRect ? tooltipStyle : {}"
      @click.stop
    >
      <!-- Mobile close button -->
      <button v-if="isMobile" class="tooltip-close" @click="emit('close')">×</button>

      <div v-if="loading" class="tooltip-loading">Loading...</div>
      <div v-else-if="error" class="tooltip-error">{{ error }}</div>
      <template v-else-if="item">
        <div class="tooltip-name" :style="{ color: getQualityColor(item.quality) }">{{ item.name }}</div>
        <div class="tooltip-ilvl">Item Level {{ item.itemLevel }}</div>

        <div v-if="item.bonding && item.bonding > 0 && BONDING_TEXT[item.bonding]" class="tooltip-bonding">
          {{ BONDING_TEXT[item.bonding] }}
        </div>

        <div v-if="item.maxCount === 1" class="tooltip-unique">Unique</div>
        <div v-else-if="item.maxCount && item.maxCount > 1" class="tooltip-unique">Unique ({{ item.maxCount }})</div>

        <div v-if="item.inventoryTypeName || item.subclassName" class="tooltip-slot-row">
          <span>{{ item.inventoryTypeName }}</span>
          <span>{{ item.subclassName }}</span>
        </div>

        <div v-if="item.armor && item.armor > 0" class="tooltip-armor">{{ item.armor }} Armor</div>
        <div v-if="item.block && item.block > 0" class="tooltip-block">{{ item.block }} Block</div>

        <div v-if="(item.dmgMin1 ?? 0) > 0 || (item.dmgMax1 ?? 0) > 0" class="tooltip-damage-row">
          <span>
            {{ item.dmgMin1 }} - {{ item.dmgMax1 }}
            {{ DAMAGE_TYPE_NAMES[item.dmgType1 ?? 0] ? DAMAGE_TYPE_NAMES[item.dmgType1 ?? 0] + ' ' : '' }}Damage
          </span>
          <span v-if="item.delay" class="tooltip-speed">Speed {{ getWeaponSpeed(item.delay) }}</span>
        </div>

        <div v-if="(item.dmgMin2 ?? 0) > 0 || (item.dmgMax2 ?? 0) > 0" class="tooltip-damage-secondary">
          +{{ item.dmgMin2 }} - {{ item.dmgMax2 }}
          {{ DAMAGE_TYPE_NAMES[item.dmgType2 ?? 0] || '' }} Damage
        </div>

        <div v-if="(item.dmgMin1 ?? 0) > 0 && (item.delay ?? 0) > 0" class="tooltip-dps">
          ({{ getWeaponDps(item) }} damage per second)
        </div>

        <div v-for="stat in item.stats" :key="stat.type" class="tooltip-stat">
          +{{ stat.value }} {{ getStatName(stat.type) }}
        </div>

        <div
          v-for="res in getResistances(item)"
          :key="res.name"
          class="tooltip-resistance"
          :style="{ color: res.color }"
        >
          +{{ res.value }} {{ res.name }}
        </div>

        <div v-if="item.enchantmentTexts?.length" class="tooltip-enchantments">
          <div v-for="(enchant, idx) in item.enchantmentTexts" :key="idx" class="tooltip-enchant">
            {{ enchant }}
          </div>
        </div>

        <div v-for="(socket, idx) in getSocketEntries(item)" :key="idx" class="tooltip-socket">
          <span class="socket-icon" :style="{ borderColor: socket.color }" />
          {{ socket.name }} Socket
        </div>

        <div v-if="item.socketBonusName" class="tooltip-socket-bonus">
          Socket Bonus: {{ item.socketBonusName }}
        </div>

        <div v-for="(effect, idx) in item.equipEffects" :key="`equip-${idx}`" class="tooltip-equip-effect">
          {{ effect }}
        </div>

        <div v-if="item.maxDurability && item.maxDurability > 0" class="tooltip-durability">
          Durability {{ item.currentDurability ?? item.maxDurability }} / {{ item.maxDurability }}
        </div>

        <div v-if="getAllowedClasses(item.allowableClass)" class="tooltip-restriction">
          Classes: {{ getAllowedClasses(item.allowableClass)!.join(', ') }}
        </div>

        <div v-if="getAllowedRaces(item.allowableRace)" class="tooltip-restriction">
          Races: {{ getAllowedRaces(item.allowableRace)!.join(', ') }}
        </div>

        <div v-if="item.requiredLevel > 1" class="tooltip-req-level">
          Requires Level {{ item.requiredLevel }}
        </div>

        <div v-if="item.description" class="tooltip-flavor">"{{ item.description }}"</div>

        <div v-if="item.sellPrice && item.sellPrice > 0" class="tooltip-sell-price">
          Sell Price: {{ formatSellPrice ? formatSellPrice(item.sellPrice) : formatDefaultSellPrice(item.sellPrice) }}
        </div>
      </template>
    </div>

    <!-- Hover mode: mobile backdrop (tap-to-close) -->
    <div
      v-if="show && interactionMode === 'hover' && isMobile"
      class="tooltip-mobile-backdrop"
      @click="emit('close')"
    />
  </Teleport>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

// ---------------------------------------------------------------------------
// Overlay (click mode only)
// ---------------------------------------------------------------------------
.tooltip-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

// ---------------------------------------------------------------------------
// Mobile backdrop (hover mode only on mobile)
// ---------------------------------------------------------------------------
.tooltip-mobile-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.5);
}

// ---------------------------------------------------------------------------
// Tooltip panel (shared between modes)
// ---------------------------------------------------------------------------
.wow-tooltip {
  position: fixed;
  width: 320px;
  max-width: calc(100vw - 2rem);
  max-height: 80vh;
  overflow-y: auto;
  background: linear-gradient(180deg, #1a0a2e 0%, #0d0d1a 100%);
  border: 1px solid #6040a0;
  border-radius: 4px;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: #ffd100;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
  z-index: 10000;
  scrollbar-width: thin;
  scrollbar-color: #6040a0 transparent;

  // When in hover mode on desktop, don't capture pointer events so the user
  // can naturally move the mouse away to close.
  &.wow-tooltip--hover:not(.is-mobile) {
    pointer-events: none;
  }

  // Mobile: centre / bottom-sheet
  &.is-mobile {
    position: fixed;
    top: auto !important;
    left: 1rem !important;
    right: 1rem;
    bottom: 1rem;
    width: auto;
    max-height: 60vh;
    border-radius: 12px 12px 12px 12px;
  }
}

// ---------------------------------------------------------------------------
// Close button (hover mode on mobile)
// ---------------------------------------------------------------------------
.tooltip-close {
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  background: none;
  border: none;
  color: #999;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;

  &:hover {
    color: #fff;
  }
}

// ---------------------------------------------------------------------------
// Loading / Error
// ---------------------------------------------------------------------------
.tooltip-loading,
.tooltip-error {
  text-align: center;
  padding: 1rem 0;
  color: $text-muted;
}

.tooltip-error {
  color: $error;
}

// ---------------------------------------------------------------------------
// Content rows
// ---------------------------------------------------------------------------
.tooltip-name {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 2px;
}

.tooltip-ilvl {
  color: #ffd100;
  margin-bottom: 2px;
}

.tooltip-bonding,
.tooltip-unique {
  color: #ffffff;
  margin-bottom: 2px;
}

.tooltip-slot-row {
  display: flex;
  justify-content: space-between;
  color: #ffffff;
  margin-bottom: 2px;
}

.tooltip-armor,
.tooltip-block {
  color: #ffffff;
  margin-bottom: 2px;
}

.tooltip-damage-row {
  display: flex;
  justify-content: space-between;
  color: #ffffff;
  margin-bottom: 2px;
}

.tooltip-speed {
  color: #ffffff;
}

.tooltip-damage-secondary {
  color: #ffffff;
  margin-bottom: 2px;
}

.tooltip-dps {
  color: #ffffff;
  margin-bottom: 4px;
}

.tooltip-stat {
  color: #ffffff;
  margin-bottom: 1px;
}

.tooltip-resistance {
  margin-bottom: 1px;
}

// Enchantments (equipped item enchants – green italic)
.tooltip-enchantments {
  margin-top: 4px;
}

.tooltip-enchant {
  color: #1eff00;
  font-style: italic;
  margin-bottom: 2px;
}

.tooltip-socket {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #808080;
  margin-bottom: 2px;

  .socket-icon {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid;
    border-radius: 2px;
    background: transparent;
  }
}

.tooltip-socket-bonus {
  color: #808080;
  margin-bottom: 2px;
}

.tooltip-equip-effect {
  color: #1eff00;
  margin-bottom: 2px;
}

.tooltip-durability {
  color: #ffffff;
  margin-top: 4px;
  margin-bottom: 2px;
}

.tooltip-restriction {
  color: #ffffff;
  margin-bottom: 2px;
}

.tooltip-req-level {
  color: #ffffff;
  margin-bottom: 4px;
}

.tooltip-flavor {
  color: #1eff00;
  font-style: italic;
  margin-top: 6px;
  margin-bottom: 4px;
}

.tooltip-sell-price {
  color: #ffffff;
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
