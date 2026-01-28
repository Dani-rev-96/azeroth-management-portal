<script setup lang="ts">
/**
 * UiStatCard - Statistics display card component
 */
export interface Props {
  icon?: string
  value: string | number
  label: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'highlight' | 'muted'
}

withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'default',
})
</script>

<template>
  <article
    :class="[
      'ui-stat-card',
      `ui-stat-card--${size}`,
      `ui-stat-card--${variant}`
    ]"
  >
    <span v-if="icon" class="ui-stat-card__icon" aria-hidden="true">{{ icon }}</span>
    <div class="ui-stat-card__content">
      <span class="ui-stat-card__value">{{ value }}</span>
      <span class="ui-stat-card__label">{{ label }}</span>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-stat-card {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-xl;
  padding: $spacing-6;

  &--sm {
    padding: $spacing-4;
    gap: $spacing-3;
  }

  &--lg {
    padding: $spacing-8;
  }

  &--highlight {
    border-color: $blue-primary;
    background: rgba($blue-primary, 0.05);
  }

  &--muted {
    opacity: 0.7;
  }

  &__icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  &--sm &__icon {
    font-size: 1.5rem;
  }

  &--lg &__icon {
    font-size: 2.5rem;
  }

  &__content {
    display: flex;
    flex-direction: column;
  }

  &__value {
    font-size: $font-size-3xl;
    font-weight: $font-weight-bold;
    color: $text-primary;
    line-height: $line-height-tight;
  }

  &--sm &__value {
    font-size: $font-size-xl;
  }

  &--lg &__value {
    font-size: $font-size-4xl;
  }

  &__label {
    font-size: $font-size-sm;
    color: $text-secondary;
    margin-top: $spacing-1;
  }
}
</style>
