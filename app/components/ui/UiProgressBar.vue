<script setup lang="ts">
/**
 * UiProgressBar - Progress bar component
 */
export interface Props {
  value: number
  max?: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'error'
}

const props = withDefaults(defineProps<Props>(), {
  max: 100,
  showLabel: true,
  size: 'md',
  variant: 'default',
})

const percentage = computed(() => Math.min(100, Math.max(0, (props.value / props.max) * 100)))
</script>

<template>
  <div
    :class="['ui-progress', `ui-progress--${size}`, `ui-progress--${variant}`]"
    role="progressbar"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="max"
  >
    <div class="ui-progress__track">
      <div class="ui-progress__fill" :style="{ width: `${percentage}%` }" />
    </div>
    <span v-if="showLabel" class="ui-progress__label">{{ Math.round(percentage) }}%</span>
  </div>
</template>

<style scoped lang="scss">
@use 'sass:color';
@use '~/styles/variables' as *;

.ui-progress {
  position: relative;
  width: 100%;

  &__track {
    width: 100%;
    background: $bg-primary;
    border: 1px solid $border-primary;
    border-radius: $radius-lg;
    overflow: hidden;
  }

  &--sm &__track {
    height: 1rem;
  }

  &--md &__track {
    height: 1.5rem;
  }

  &--lg &__track {
    height: 2rem;
  }

  &__fill {
    height: 100%;
    transition: width $transition-slow;
  }

  &--default &__fill {
    background: $gradient-blue;
  }

  &--success &__fill {
    background: linear-gradient(135deg, $success 0%, color.adjust($success, $lightness: -10%) 100%);
  }

  &--warning &__fill {
    background: linear-gradient(135deg, $warning 0%, color.adjust($warning, $lightness: -10%) 100%);
  }

  &--error &__fill {
    background: linear-gradient(135deg, $error 0%, color.adjust($error, $lightness: -10%) 100%);
  }

  &__label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: $text-primary;
    font-weight: $font-weight-semibold;
    font-size: $font-size-sm;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  &--sm &__label {
    font-size: $font-size-xs;
  }
}
</style>
