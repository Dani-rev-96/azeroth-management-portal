<script setup lang="ts">
/**
 * UiTabPanel - Container for tab content with fade animation
 */
export interface Props {
  id: string
  active?: boolean
}

withDefaults(defineProps<Props>(), {
  active: false,
})
</script>

<template>
  <section
    v-if="active"
    :id="`panel-${id}`"
    role="tabpanel"
    :aria-labelledby="`tab-${id}`"
    class="ui-tab-panel"
  >
    <slot />
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-tab-panel {
  animation: fadeIn $transition-slow;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
