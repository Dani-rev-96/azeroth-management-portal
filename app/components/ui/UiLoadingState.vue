<script setup lang="ts">
/**
 * UiLoadingState - Loading indicator component
 */
export interface Props {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  message: 'Loading...',
  size: 'md',
})
</script>

<template>
  <div :class="['ui-loading', `ui-loading--${size}`]" role="status" aria-live="polite">
    <span class="ui-loading__spinner" aria-hidden="true" />
    <p v-if="message" class="ui-loading__message">{{ message }}</p>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-16 $spacing-8;
  color: $text-secondary;

  &--sm {
    padding: $spacing-8 $spacing-4;
  }

  &--lg {
    padding: $spacing-16 $spacing-8;
  }

  &__spinner {
    border: 3px solid $border-primary;
    border-top-color: $blue-primary;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  &--sm &__spinner {
    width: 20px;
    height: 20px;
    border-width: 2px;
  }

  &--md &__spinner {
    width: 32px;
    height: 32px;
  }

  &--lg &__spinner {
    width: 48px;
    height: 48px;
    border-width: 4px;
  }

  &__message {
    margin: $spacing-4 0 0;
    font-size: $font-size-base;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
