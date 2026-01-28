<script setup lang="ts">
/**
 * UiEmptyState - Empty state placeholder component
 */
export interface Props {
  icon?: string
  title?: string
  message?: string
}

withDefaults(defineProps<Props>(), {
  icon: '📭',
  title: '',
  message: 'No data found',
})
</script>

<template>
  <div class="ui-empty-state" role="status">
    <span class="ui-empty-state__icon" aria-hidden="true">{{ icon }}</span>
    <h3 v-if="title" class="ui-empty-state__title">{{ title }}</h3>
    <p class="ui-empty-state__message">{{ message }}</p>
    <div v-if="$slots.action" class="ui-empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-16 $spacing-8;
  text-align: center;

  &__icon {
    font-size: 4rem;
    margin-bottom: $spacing-4;
    opacity: 0.6;
  }

  &__title {
    margin: 0 0 $spacing-2;
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $text-primary;
  }

  &__message {
    margin: 0;
    font-size: $font-size-base;
    color: $text-secondary;
    max-width: 400px;
  }

  &__action {
    margin-top: $spacing-6;
  }
}
</style>
