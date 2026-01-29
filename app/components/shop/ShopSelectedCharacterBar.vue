<script setup lang="ts">
import type { ShopCharacter } from '~/composables/useShop'

defineProps<{
  character: ShopCharacter
  getClassIcon: (classId: number) => string
  formatMoney: (copper: number) => string
}>()

const emit = defineEmits<{
  change: []
}>()
</script>

<template>
  <div class="selected-character-bar">
    <div class="selected-char-info">
      <span class="char-avatar small" :class="`class-${character.class}`">
        {{ getClassIcon(character.class) }}
      </span>
      <span class="char-name">{{ character.name }}</span>
      <span class="char-balance">💰 {{ formatMoney(character.money) }}</span>
    </div>
    <button class="btn-change-char" @click="emit('change')">
      Change Character
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.selected-character-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: 8px;
  margin-bottom: 1.5rem;

  .selected-char-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .char-avatar.small {
      width: 32px;
      height: 32px;
      font-size: 1rem;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: $bg-tertiary;

      &.class-1 { background: rgba($class-warrior, 0.2); border: 1px solid $class-warrior; }
      &.class-2 { background: rgba($class-paladin, 0.2); border: 1px solid $class-paladin; }
      &.class-3 { background: rgba($class-hunter, 0.2); border: 1px solid $class-hunter; }
      &.class-4 { background: rgba($class-rogue, 0.2); border: 1px solid $class-rogue; }
      &.class-5 { background: rgba($class-priest, 0.2); border: 1px solid $class-priest; }
      &.class-6 { background: rgba($class-deathknight, 0.2); border: 1px solid $class-deathknight; }
      &.class-7 { background: rgba($class-shaman, 0.2); border: 1px solid $class-shaman; }
      &.class-8 { background: rgba($class-mage, 0.2); border: 1px solid $class-mage; }
      &.class-9 { background: rgba($class-warlock, 0.2); border: 1px solid $class-warlock; }
      &.class-11 { background: rgba($class-druid, 0.2); border: 1px solid $class-druid; }
    }

    .char-name {
      color: $text-primary;
      font-weight: 600;
    }

    .char-balance {
      color: $quality-legendary;
      font-size: 0.875rem;
    }
  }

  .btn-change-char {
    padding: 0.5rem 1rem;
    background: $bg-tertiary;
    border: 1px solid $border-primary;
    border-radius: 4px;
    color: $text-secondary;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: $color-accent;
      color: $text-primary;
    }
  }
}

@media (max-width: 768px) {
  .selected-character-bar {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
}
</style>
