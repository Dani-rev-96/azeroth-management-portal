<script setup lang="ts">
/**
 * UiBadge - Atomic badge component for status, labels, and counts
 */
export interface Props {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'gm' | 'level' | 'online' | 'offline'
  size?: 'sm' | 'md'
  outline?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  outline: false,
})
</script>

<template>
  <span
    :class="[
      'ui-badge',
      `ui-badge--${variant}`,
      `ui-badge--${size}`,
      { 'ui-badge--outline': outline }
    ]"
  >
    <slot />
  </span>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-badge {
  display: inline-flex;
  align-items: center;
  border-radius: $radius-md;
  font-weight: $font-weight-semibold;

  &--sm {
    padding: $spacing-1 $spacing-2;
    font-size: $font-size-xs;
  }

  &--md {
    padding: $spacing-1 $spacing-3;
    font-size: $font-size-sm;
  }

  // Variants
  &--default {
    background: rgba($text-secondary, 0.2);
    color: $text-primary;
  }

  &--success,
  &--online {
    background: rgba($success, 0.2);
    color: $success;
  }

  &--error {
    background: rgba($error, 0.2);
    color: $error-light;
  }

  &--warning {
    background: rgba($warning, 0.2);
    color: $warning-light;
  }

  &--info {
    background: rgba($info, 0.2);
    color: $info-light;
  }

  &--gm {
    background: rgba($orange-primary, 0.2);
    color: $orange-primary;
  }

  &--level {
    background: rgba($purple-primary, 0.2);
    color: $purple-primary;
  }

  &--offline {
    background: rgba($text-secondary, 0.2);
    color: $text-secondary;
  }

  &--outline {
    background: transparent;
    border: 1px solid currentColor;
  }
}
</style>
