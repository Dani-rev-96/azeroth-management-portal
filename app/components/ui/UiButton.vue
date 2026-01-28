<script setup lang="ts">
/**
 * UiButton - Atomic button component
 * Provides consistent button styling across the application
 */
export interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'admin'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  block?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
  block: false,
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'ui-button',
      `ui-button--${variant}`,
      `ui-button--${size}`,
      { 'ui-button--block': block, 'ui-button--loading': loading }
    ]"
  >
    <span v-if="loading" class="ui-button__spinner" aria-hidden="true" />
    <span :class="{ 'ui-button__content--hidden': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-2;
  border-radius: $radius-lg;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: all $transition-base;
  position: relative;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  // Sizes
  &--sm {
    padding: $spacing-2 $spacing-4;
    font-size: $font-size-sm;
    border-radius: $radius-md;
  }

  &--md {
    padding: $spacing-4 $spacing-8;
    font-size: $font-size-base;
  }

  &--lg {
    padding: $spacing-5 $spacing-10;
    font-size: $font-size-lg;
  }

  // Variants
  &--primary {
    background: $gradient-blue;
    color: white;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: $glow-blue;
    }
  }

  &--secondary {
    background: rgba($text-secondary, 0.1);
    color: $text-secondary;
    border: 1px solid $border-primary;

    &:hover:not(:disabled) {
      background: rgba($text-secondary, 0.2);
      border-color: $border-secondary;
    }
  }

  &--ghost {
    background: transparent;
    color: $blue-light;
    border: 1px solid $blue-primary;

    &:hover:not(:disabled) {
      background: rgba($blue-primary, 0.1);
    }
  }

  &--danger {
    background: rgba($error, 0.1);
    color: $error-light;
    border: 1px solid $error;

    &:hover:not(:disabled) {
      background: rgba($error, 0.2);
    }
  }

  &--admin {
    background: $gradient-orange;
    color: white;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: $glow-orange;
    }
  }

  &--block {
    width: 100%;
  }

  &--loading {
    pointer-events: none;
  }

  &__spinner {
    position: absolute;
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  &__content--hidden {
    visibility: hidden;
  }
}
</style>
