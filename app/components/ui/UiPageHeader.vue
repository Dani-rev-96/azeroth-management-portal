<script setup lang="ts">
/**
 * UiPageHeader - Page header with title and optional actions
 */
export interface Props {
  title: string
  subtitle?: string
  gradient?: boolean
}

withDefaults(defineProps<Props>(), {
  gradient: true,
})
</script>

<template>
  <header class="ui-page-header">
    <div class="ui-page-header__content">
      <h1 :class="['ui-page-header__title', { 'ui-page-header__title--gradient': gradient }]">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="ui-page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="ui-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.ui-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: $spacing-4;
  margin-bottom: $spacing-8;

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: $font-size-4xl;
    font-weight: $font-weight-bold;
    margin: 0;
    color: $text-primary;
		display: inline;

    @media (max-width: $breakpoint-md) {
      font-size: $font-size-3xl;
    }

    &--gradient {
      @include gradient-text;
    }
  }

  &__subtitle {
    margin: $spacing-2 0 0;
    color: $text-secondary;
    font-size: $font-size-base;
  }

  &__actions {
    display: flex;
    gap: $spacing-4;
    align-items: center;
    flex-shrink: 0;
  }
}
</style>
