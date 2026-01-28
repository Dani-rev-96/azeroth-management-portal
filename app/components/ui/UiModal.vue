<script setup lang="ts">
/**
 * UiModal - Modal dialog component
 */
export interface Props {
  open: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg'
  closable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closable: true,
})

const emit = defineEmits<{
  close: []
}>()

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget && props.closable) {
    emit('close')
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closable) {
    emit('close')
  }
}

// Focus trap and escape key handling
onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})

// Prevent body scroll when modal is open
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="ui-modal__backdrop"
        @click="handleBackdropClick"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'modal-title' : undefined"
      >
        <article :class="['ui-modal', `ui-modal--${size}`]">
          <header v-if="title || closable" class="ui-modal__header">
            <h2 v-if="title" id="modal-title" class="ui-modal__title">{{ title }}</h2>
            <button
              v-if="closable"
              type="button"
              class="ui-modal__close"
              aria-label="Close modal"
              @click="emit('close')"
            >
              ✕
            </button>
          </header>

          <div class="ui-modal__body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="ui-modal__footer">
            <slot name="footer" />
          </footer>
        </article>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-modal {
  &__backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-4;
    background: rgba(0, 0, 0, 0.7);
    z-index: $z-modal-backdrop;
    backdrop-filter: blur(4px);
  }

  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-xl;
  max-height: calc(100vh - 2rem);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: $z-modal;

  &--sm {
    width: 100%;
    max-width: 400px;
  }

  &--md {
    width: 100%;
    max-width: 600px;
  }

  &--lg {
    width: 100%;
    max-width: 800px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-6;
    border-bottom: 1px solid $border-primary;
  }

  &__title {
    margin: 0;
    font-size: $font-size-xl;
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
    padding: $spacing-6;
    overflow-y: auto;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: $spacing-4;
    padding: $spacing-6;
    border-top: 1px solid $border-primary;
  }
}

// Transition styles
.modal-enter-active,
.modal-leave-active {
  transition: opacity $transition-base;

  .ui-modal {
    transition: transform $transition-base, opacity $transition-base;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .ui-modal {
    transform: scale(0.95);
    opacity: 0;
  }
}
</style>
