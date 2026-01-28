<script setup lang="ts">
/**
 * UiCard - Atomic card container component
 */
export interface Props {
  hoverable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  as?: string
}

withDefaults(defineProps<Props>(), {
  hoverable: false,
  padding: 'md',
  as: 'article',
})
</script>

<template>
  <component
    :is="as"
    :class="[
      'ui-card',
      `ui-card--padding-${padding}`,
      { 'ui-card--hoverable': hoverable }
    ]"
  >
    <slot />
  </component>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-card {
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-xl;
  transition: all $transition-base;

  &--padding-none {
    padding: 0;
  }

  &--padding-sm {
    padding: $spacing-4;
  }

  &--padding-md {
    padding: $spacing-6;
  }

  &--padding-lg {
    padding: $spacing-8;
  }

  &--hoverable {
    cursor: pointer;

    &:hover {
      border-color: $border-secondary;
      transform: translateY(-2px);
    }
  }
}
</style>
