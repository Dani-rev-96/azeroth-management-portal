<script setup lang="ts">
import { getClassName } from '~/utils/wow'
import type { ShopCharacter } from '~/composables/useShop'

defineProps<{
  characters: ShopCharacter[]
  loading: boolean
  error: string
  getClassIcon: (classId: number) => string
  formatMoney: (copper: number) => string
}>()

const emit = defineEmits<{
  select: [character: ShopCharacter]
}>()
</script>

<template>
  <section class="character-select-section">
    <UiSectionHeader
      title="Select a Character"
      subtitle="Choose which character will receive your purchases"
    />

    <UiLoadingState v-if="loading" message="Loading your characters..." />

    <UiEmptyState
      v-else-if="error"
      icon="❌"
      :message="error"
    />

    <UiEmptyState
      v-else-if="characters.length === 0"
      icon="🎮"
      message="No characters found. Create a character in-game first."
    />

    <div v-else class="character-grid">
      <button
        v-for="char in characters"
        :key="`${char.realmId}-${char.guid}`"
        class="character-card"
        @click="emit('select', char)"
      >
        <div class="char-avatar" :class="`class-${char.class}`">
          {{ getClassIcon(char.class) }}
        </div>
        <div class="char-info">
          <h3>{{ char.name }}</h3>
          <p class="char-details">
            Level {{ char.level }} {{ getClassName(char.class) }}
          </p>
          <p class="char-realm">{{ char.realmName }}</p>
          <p class="char-gold">💰 {{ formatMoney(char.money) }}</p>
        </div>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.character-select-section {
  margin-bottom: 1.5rem;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.character-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    border-color: $color-accent;
    transform: translateY(-2px);
  }

  .char-avatar {
    width: 50px;
    height: 50px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    background: $bg-tertiary;

    &.class-1 { background: rgba($class-warrior, 0.2); border: 2px solid $class-warrior; }
    &.class-2 { background: rgba($class-paladin, 0.2); border: 2px solid $class-paladin; }
    &.class-3 { background: rgba($class-hunter, 0.2); border: 2px solid $class-hunter; }
    &.class-4 { background: rgba($class-rogue, 0.2); border: 2px solid $class-rogue; }
    &.class-5 { background: rgba($class-priest, 0.2); border: 2px solid $class-priest; }
    &.class-6 { background: rgba($class-deathknight, 0.2); border: 2px solid $class-deathknight; }
    &.class-7 { background: rgba($class-shaman, 0.2); border: 2px solid $class-shaman; }
    &.class-8 { background: rgba($class-mage, 0.2); border: 2px solid $class-mage; }
    &.class-9 { background: rgba($class-warlock, 0.2); border: 2px solid $class-warlock; }
    &.class-11 { background: rgba($class-druid, 0.2); border: 2px solid $class-druid; }
  }

  .char-info {
    flex: 1;

    h3 {
      color: $text-primary;
      margin: 0 0 0.25rem 0;
      font-size: 1rem;
    }

    .char-details {
      color: $text-secondary;
      margin: 0 0 0.25rem 0;
      font-size: 0.875rem;
    }

    .char-realm {
      color: $text-muted;
      font-size: 0.75rem;
      margin: 0 0 0.25rem 0;
    }

    .char-gold {
      color: $quality-legendary;
      font-size: 0.875rem;
      margin: 0;
    }
  }
}
</style>
