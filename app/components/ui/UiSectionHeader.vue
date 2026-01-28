<script setup lang="ts">
/**
 * UiSectionHeader - Section header with title, subtitle, and optional actions
 */
export interface Props {
  title: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <header class="ui-section-header">
    <div class="ui-section-header__content">
      <h2 class="ui-section-header__title">{{ title }}</h2>
      <p v-if="subtitle" class="ui-section-header__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="ui-section-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: $spacing-4;
  margin-bottom: $spacing-6;

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: $font-size-2xl;
    font-weight: $font-weight-bold;
    margin: 0;
    color: $text-primary;
  }

  &__subtitle {
    margin: $spacing-1 0 0;
    color: $text-secondary;
    font-size: $font-size-sm;
  }

  &__actions {
    display: flex;
    gap: $spacing-3;
    align-items: center;
    flex-shrink: 0;
  }
}
</style>
