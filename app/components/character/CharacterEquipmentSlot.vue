<template>
  <div class="equipment-slot" :class="{ empty: !item, [qualityClass]: item }">
    <div v-if="item" class="item-container">
      <div class="item-icon-wrapper">
        <img
          v-if="item.icon"
          :src="getIconUrl(item.icon)"
          :alt="item.name"
          class="item-icon"
          @error="onImageError"
        />
        <div v-else class="item-icon-placeholder">
          {{ slot.icon }}
        </div>
        <div class="item-level">{{ item.itemLevel }}</div>
      </div>
      <div class="item-tooltip">
        <div class="tooltip-header" :class="qualityClass">
          <h4>{{ item.name }}</h4>
          <span class="item-level-text">Item Level {{ item.itemLevel }}</span>
        </div>
        <div class="tooltip-content">
          <div v-if="item.armor" class="stat-line">{{ item.armor }} Armor</div>

          <!-- Primary Stats -->
          <div v-for="i in item.statsCount" :key="i" class="stat-line">
            <template v-if="item[`stat_type${i}` as keyof typeof item]">
              +{{ item[`stat_value${i}` as keyof typeof item] }} {{ getStatName(item[`stat_type${i}` as keyof typeof item] as number) }}
            </template>
          </div>

          <!-- Damage for weapons -->
          <div v-if="item.dmg_min1 || item.dmg_max1" class="stat-line damage">
            {{ item.dmg_min1 }} - {{ item.dmg_max1 }} Damage
          </div>

          <!-- Enchantments -->
          <div v-if="item.enchantmentTexts && item.enchantmentTexts.length > 0" class="enchantments">
            <div v-for="(enchant, idx) in item.enchantmentTexts" :key="idx" class="enchant-line">
              <span class="enchant-icon">✨</span> {{ enchant }}
            </div>
          </div>

          <div v-if="item.requiredLevel > 1" class="required-level">
            Requires Level {{ item.requiredLevel }}
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-slot">
      <span class="slot-icon">{{ slot.icon }}</span>
      <span class="slot-name">{{ slot.name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CharacterItem } from '~/types'

interface EquipmentSlot {
  id: number
  name: string
  icon: string
}

const props = defineProps<{
  slot: EquipmentSlot
  item?: CharacterItem
}>()

const qualityColors: Record<number, string> = {
  0: 'poor',
  1: 'common',
  2: 'uncommon',
  3: 'rare',
  4: 'epic',
  5: 'legendary',
  6: 'artifact',
  7: 'heirloom'
}

const qualityClass = computed(() => {
  if (!props.item) return ''
  return `quality-${qualityColors[props.item.quality] || 'common'}`
})

function getIconUrl(iconName: string) {
  // Remove .blp extension if present and convert to lowercase
  const cleanName = iconName.replace('.blp', '').toLowerCase()
  return `https://wow.zamimg.com/images/wow/icons/large/${cleanName}.jpg`
}

function onImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

function getStatName(statType: number): string {
  const statNames: Record<number, string> = {
    0: 'Mana',
    1: 'Health',
    3: 'Agility',
    4: 'Strength',
    5: 'Intellect',
    6: 'Spirit',
    7: 'Stamina',
    12: 'Defense Rating',
    13: 'Dodge Rating',
    14: 'Parry Rating',
    15: 'Block Rating',
    16: 'Melee Hit Rating',
    17: 'Ranged Hit Rating',
    18: 'Spell Hit Rating',
    19: 'Melee Critical Strike Rating',
    20: 'Ranged Critical Strike Rating',
    21: 'Spell Critical Strike Rating',
    28: 'Melee Haste Rating',
    29: 'Ranged Haste Rating',
    30: 'Spell Haste Rating',
    31: 'Hit Rating',
    32: 'Critical Strike Rating',
    35: 'Resilience Rating',
    36: 'Haste Rating',
    37: 'Expertise Rating',
    38: 'Attack Power',
    43: 'MP5',
    44: 'Armor Penetration Rating',
    45: 'Spell Power',
  }
  return statNames[statType] || `Stat ${statType}`
}
</script>

<style scoped>
.equipment-slot {
  background: #0f172a;
  border: 2px solid #334155;
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s;
}

.equipment-slot.empty {
  border-style: dashed;
  opacity: 0.5;
}

.equipment-slot:not(.empty):hover {
  border-color: #60a5fa;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

/* Quality borders */
.equipment-slot.quality-poor { border-color: #9d9d9d; }
.equipment-slot.quality-common { border-color: #ffffff; }
.equipment-slot.quality-uncommon { border-color: #1eff00; }
.equipment-slot.quality-rare { border-color: #0070dd; }
.equipment-slot.quality-epic { border-color: #a335ee; }
.equipment-slot.quality-legendary { border-color: #ff8000; }
.equipment-slot.quality-artifact { border-color: #e6cc80; }
.equipment-slot.quality-heirloom { border-color: #00ccff; }

.item-container {
  width: 100%;
  text-align: center;
  position: relative;
}

.item-icon-wrapper {
  position: relative;
  display: inline-block;
}

.item-icon {
  width: 48px;
  height: 48px;
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.item-icon-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 0.375rem;
  background: rgba(59, 130, 246, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.item-level {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: #1e293b;
  border: 1px solid #60a5fa;
  border-radius: 0.25rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fbbf24;
}

.empty-slot {
  text-align: center;
  color: #64748b;
}

.slot-icon {
  display: block;
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.slot-name {
  font-size: 0.875rem;
}

/* Tooltip */
.item-tooltip {
  display: none;
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 0.5rem;
  background: #1e293b;
  border: 2px solid #334155;
  border-radius: 0.5rem;
  padding: 1rem;
  min-width: 250px;
  max-width: 350px;
  z-index: 1000;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.equipment-slot:hover {
  z-index: 1001;
}

.equipment-slot:hover .item-tooltip {
  display: block;
}

.tooltip-header {
  border-bottom: 1px solid #334155;
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.tooltip-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #ffffff;
}

.tooltip-header.quality-poor h4 { color: #9d9d9d; }
.tooltip-header.quality-uncommon h4 { color: #1eff00; }
.tooltip-header.quality-rare h4 { color: #0070dd; }
.tooltip-header.quality-epic h4 { color: #a335ee; }
.tooltip-header.quality-legendary h4 { color: #ff8000; }

.item-level-text {
  font-size: 0.875rem;
  color: #fbbf24;
}

.tooltip-content {
  text-align: left;
}

.stat-line {
  color: #1eff00;
  font-size: 0.875rem;
  margin: 0.25rem 0;
}

.stat-line.damage {
  color: #ffffff;
  font-weight: 600;
}

.enchantments {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #334155;
}

.enchant-line {
  color: #10b981;
  font-size: 0.875rem;
  margin: 0.25rem 0;
  font-style: italic;
}

.enchant-icon {
  margin-right: 0.25rem;
}

.required-level {
  color: #94a3b8;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #334155;
}
</style>
