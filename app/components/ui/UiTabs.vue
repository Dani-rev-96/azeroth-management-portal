<script setup lang="ts">
/**
 * UiTabs - Tab navigation component with URL state support
 */
export interface Tab {
  id: string
  label: string
  icon?: string
}

export interface Props {
  tabs: Tab[]
  modelValue: string
  variant?: 'default' | 'admin'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function selectTab(tabId: string) {
  emit('update:modelValue', tabId)
}
</script>

<template>
  <nav :class="['ui-tabs', `ui-tabs--${variant}`]" role="tablist" aria-label="Page sections">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.id"
      :aria-controls="`panel-${tab.id}`"
      :class="['ui-tabs__tab', { 'ui-tabs__tab--active': modelValue === tab.id }]"
      @click="selectTab(tab.id)"
    >
      <span v-if="tab.icon" class="ui-tabs__icon" aria-hidden="true">{{ tab.icon }}</span>
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-tabs {
  display: flex;
  gap: $spacing-4;
  margin-bottom: $spacing-8;
  border-bottom: 2px solid $border-primary;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: $border-primary transparent;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: $border-primary;
    border-radius: 2px;

    &:hover {
      background: $border-secondary;
    }
  }

  &__tab {
    padding: $spacing-4 $spacing-8;
    background: none;
    border: none;
    color: $text-secondary;
    cursor: pointer;
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    transition: all $transition-base;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    white-space: nowrap;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: $spacing-2;

    &:hover {
      color: $text-primary;
    }

    &--active {
      color: $blue-light;
      border-bottom-color: $blue-light;
    }
  }

  &__icon {
    font-size: $font-size-lg;
  }

  // Admin variant uses orange accent
  &--admin .ui-tabs__tab--active {
    color: $orange-primary;
    border-bottom-color: $orange-primary;
  }
}

@media (max-width: $breakpoint-md) {
  .ui-tabs__tab {
    padding: $spacing-3 $spacing-6;
  }
}
</style>
