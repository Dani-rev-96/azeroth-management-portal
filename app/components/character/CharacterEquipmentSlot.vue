<template>
  <div
    ref="slotRef"
    class="equipment-slot"
    :class="{ empty: !item, [qualityClass]: item }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @touchstart.prevent="onTap"
  >
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
    </div>
    <div v-else class="empty-slot">
      <span class="slot-icon">{{ slot.icon }}</span>
      <span class="slot-name">{{ slot.name }}</span>
    </div>

    <UiItemTooltip
      :item="tooltipData"
      :show="showTooltip"
      mode="hover"
      :anchor-rect="anchorRect"
      @close="showTooltip = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CharacterItem } from '~/types'
import { characterItemToTooltipData } from '~/utils/item-tooltip'

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

const tooltipData = computed(() => {
  if (!props.item) return null
  return characterItemToTooltipData(props.item)
})

const slotRef = ref<HTMLElement | null>(null)
const showTooltip = ref(false)
const anchorRect = ref<DOMRect | null>(null)

function updateAnchorRect() {
  if (slotRef.value) {
    anchorRect.value = slotRef.value.getBoundingClientRect()
  }
}

function onMouseEnter() {
  if (!props.item) return
  updateAnchorRect()
  showTooltip.value = true
}

function onMouseLeave() {
  showTooltip.value = false
}

function onTap() {
  if (!props.item) return
  updateAnchorRect()
  showTooltip.value = !showTooltip.value
}

function getIconUrl(iconName: string) {
  const cleanName = iconName.replace('.blp', '').toLowerCase()
  return `https://wow.zamimg.com/images/wow/icons/large/${cleanName}.jpg`
}

function onImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<style scoped>
.equipment-slot {
  background: #0f172a;
  border: 2px solid #334155;
  border-radius: 0.5rem;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s;
  min-height: 56px;
  min-width: 56px;
  cursor: pointer;
}

@media (min-width: 480px) {
  .equipment-slot {
    padding: 0.75rem;
    min-height: 80px;
    min-width: 80px;
  }
}

.equipment-slot.empty {
  border-style: dashed;
  opacity: 0.5;
  cursor: default;
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
  width: 36px;
  height: 36px;
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@media (min-width: 480px) {
  .item-icon {
    width: 48px;
    height: 48px;
  }
}

.item-icon-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 0.375rem;
  background: rgba(59, 130, 246, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

@media (min-width: 480px) {
  .item-icon-placeholder {
    width: 48px;
    height: 48px;
    font-size: 1.5rem;
  }
}

.item-level {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: #1e293b;
  border: 1px solid #60a5fa;
  border-radius: 0.25rem;
  padding: 0.0625rem 0.25rem;
  font-size: 0.625rem;
  font-weight: 700;
  color: #fbbf24;
}

@media (min-width: 480px) {
  .item-level {
    padding: 0.125rem 0.375rem;
    font-size: 0.75rem;
  }
}

.empty-slot {
  text-align: center;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

@media (min-width: 480px) {
  .empty-slot {
    width: 48px;
    height: 48px;
  }
}

.slot-icon {
  font-size: 1.25rem;
  line-height: 1;
}

@media (min-width: 480px) {
  .slot-icon {
    font-size: 1.5rem;
  }
}

.slot-name {
  display: none;
}
</style>
