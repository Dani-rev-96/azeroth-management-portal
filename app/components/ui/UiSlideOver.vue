<script setup lang="ts">
/**
 * UiSlideOver — Right-edge drawer panel
 *
 * Non-modal: no backdrop dim, page behind remains scrollable and interactive
 * so users can reference data while editing. Closes via ESC, close button, or
 * the consumer setting `open` to false. Does NOT lock body scroll.
 */
export interface Props {
  open: boolean
  title?: string
  width?: string
  closable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  closable: true,
  width: '560px',
})

const emit = defineEmits<{
  close: []
}>()

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open && props.closable) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="slideover">
      <aside
        v-if="open"
        class="ui-slideover"
        :style="{ '--slideover-width': width }"
        role="dialog"
        aria-modal="false"
        :aria-labelledby="title ? 'slideover-title' : undefined"
      >
        <header class="ui-slideover__header">
          <h2 v-if="title" id="slideover-title" class="ui-slideover__title">{{ title }}</h2>
          <button
            v-if="closable"
            type="button"
            class="ui-slideover__close"
            aria-label="Close panel"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>

        <div class="ui-slideover__body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="ui-slideover__footer">
          <slot name="footer" />
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-slideover {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: var(--slideover-width, 560px);
  display: flex;
  flex-direction: column;
  background: $bg-secondary;
  border-left: 1px solid $border-primary;
  box-shadow: $shadow-xl;
  z-index: $z-modal;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-4 $spacing-6;
    border-bottom: 1px solid $border-primary;
    background: $bg-secondary;
    flex-shrink: 0;
  }

  &__title {
    margin: 0;
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $text-primary;
  }

  &__close {
    background: none;
    border: none;
    color: $text-secondary;
    font-size: $font-size-lg;
    cursor: pointer;
    padding: $spacing-2;
    line-height: 1;
    border-radius: $radius-md;
    transition: all $transition-base;

    &:hover {
      background: rgba($text-secondary, 0.1);
      color: $text-primary;
    }
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: $spacing-6;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: $spacing-2;
    padding: $spacing-4 $spacing-6;
    border-top: 1px solid $border-primary;
    background: $bg-secondary;
    flex-shrink: 0;
  }
}

.slideover-enter-active,
.slideover-leave-active {
  transition: transform $transition-slow, opacity $transition-slow;
}

.slideover-enter-from,
.slideover-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
