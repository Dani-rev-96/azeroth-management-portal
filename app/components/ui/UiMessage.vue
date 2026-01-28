<script setup lang="ts">
/**
 * UiMessage - Alert/message component for success, error, warning, info states
 */
export interface Props {
  variant?: 'success' | 'error' | 'warning' | 'info'
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'info',
  dismissible: false,
})

const emit = defineEmits<{
  dismiss: []
}>()

const visible = ref(true)

const icons: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

function dismiss() {
  visible.value = false
  emit('dismiss')
}
</script>

<template>
  <div
    v-if="visible"
    :class="['ui-message', `ui-message--${variant}`]"
    role="alert"
  >
    <span class="ui-message__icon" aria-hidden="true">{{ icons[variant] }}</span>
    <div class="ui-message__content">
      <slot />
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="ui-message__dismiss"
      aria-label="Dismiss message"
      @click="dismiss"
    >
      ✕
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-message {
  display: flex;
  align-items: flex-start;
  gap: $spacing-3;
  padding: $spacing-3 $spacing-4;
  border-radius: $radius-lg;
  font-size: $font-size-sm;

  &--success {
    background: $success-bg;
    color: $success-light;
  }

  &--error {
    background: $error-bg;
    color: $error-light;
  }

  &--warning {
    background: $warning-bg;
    color: $warning-light;
  }

  &--info {
    background: $info-bg;
    color: $info-light;
  }

  &__icon {
    flex-shrink: 0;
    font-weight: $font-weight-bold;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__dismiss {
    flex-shrink: 0;
    background: none;
    border: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
    padding: 0;
    font-size: $font-size-sm;

    &:hover {
      opacity: 1;
    }
  }
}
</style>
