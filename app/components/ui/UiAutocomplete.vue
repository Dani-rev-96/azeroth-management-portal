<script setup lang="ts">
/**
 * UiAutocomplete - Text input with dropdown suggestions
 * Emits the selected item or allows free-text input.
 */
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

export interface AutocompleteItem {
  /** Primary display value */
  label: string
  /** Optional secondary text (subtitle) */
  description?: string
  /** Arbitrary data payload returned on selection */
  value: any
}

export interface Props {
  modelValue: string
  items?: AutocompleteItem[]
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  /** Minimum characters before showing dropdown */
  minChars?: number
  /** Show "no results" message when items is empty and query >= minChars */
  noResultsText?: string
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  placeholder: '',
  disabled: false,
  loading: false,
  minChars: 1,
  noResultsText: 'No results found',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'select': [item: AutocompleteItem]
  'search': [query: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const isOpen = ref(false)
const highlightIndex = ref(-1)

const showDropdown = computed(() => {
  if (!isOpen.value) return false
  if (props.modelValue.length < props.minChars) return false
  return props.items.length > 0 || props.loading || props.modelValue.length >= props.minChars
})

function handleInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
  emit('search', value)
  isOpen.value = true
  highlightIndex.value = -1
}

function handleFocus() {
  if (props.modelValue.length >= props.minChars) {
    isOpen.value = true
  }
}

function handleClickOutside(event: MouseEvent) {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

function selectItem(item: AutocompleteItem) {
  emit('update:modelValue', item.label)
  emit('select', item)
  isOpen.value = false
  highlightIndex.value = -1
}

function handleKeydown(event: KeyboardEvent) {
  if (!showDropdown.value) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightIndex.value = Math.min(highlightIndex.value + 1, props.items.length - 1)
      scrollToHighlighted()
      break
    case 'ArrowUp':
      event.preventDefault()
      highlightIndex.value = Math.max(highlightIndex.value - 1, -1)
      scrollToHighlighted()
      break
    case 'Enter':
      event.preventDefault()
      if (highlightIndex.value >= 0 && highlightIndex.value < props.items.length) {
        const item = props.items[highlightIndex.value]
        if (item) selectItem(item)
      }
      break
    case 'Escape':
      isOpen.value = false
      highlightIndex.value = -1
      break
  }
}

function scrollToHighlighted() {
  nextTick(() => {
    const el = wrapperRef.value?.querySelector('.autocomplete__item--highlighted')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="wrapperRef" class="autocomplete">
    <div class="autocomplete__input-wrapper">
      <input
        ref="inputRef"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="autocomplete__input"
        type="text"
        autocomplete="off"
        @input="handleInput"
        @focus="handleFocus"
        @keydown="handleKeydown"
      />
      <span v-if="loading" class="autocomplete__spinner">⏳</span>
    </div>

    <Transition name="dropdown">
      <div v-if="showDropdown" class="autocomplete__dropdown">
        <div v-if="loading && items.length === 0" class="autocomplete__loading">
          Searching...
        </div>
        <template v-else-if="items.length > 0">
          <button
            v-for="(item, index) in items"
            :key="index"
            class="autocomplete__item"
            :class="{ 'autocomplete__item--highlighted': index === highlightIndex }"
            type="button"
            @mousedown.prevent="selectItem(item)"
            @mouseenter="highlightIndex = index"
          >
            <span class="autocomplete__item-label">{{ item.label }}</span>
            <span v-if="item.description" class="autocomplete__item-desc">{{ item.description }}</span>
          </button>
        </template>
        <div v-else-if="!loading && modelValue.length >= minChars" class="autocomplete__empty">
          {{ noResultsText }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.autocomplete {
  position: relative;
  width: 100%;

  &__input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  &__input {
    width: 100%;
    padding: $spacing-2 $spacing-3;
    background: $bg-tertiary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    color: $text-primary;
    font-size: $font-size-sm;
    font-family: inherit;
    transition: border-color 0.2s;

    &::placeholder {
      color: $text-muted;
    }

    &:focus {
      outline: none;
      border-color: $orange-primary;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__spinner {
    position: absolute;
    right: $spacing-2;
    font-size: $font-size-sm;
    animation: spin 1s linear infinite;
  }

  &__dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: $z-dropdown;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    box-shadow: $shadow-lg;
    max-height: 240px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: $border-secondary transparent;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: $spacing-2 $spacing-3;
    background: none;
    border: none;
    border-bottom: 1px solid $border-primary;
    color: $text-primary;
    font-size: $font-size-sm;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s;

    &:last-child {
      border-bottom: none;
    }

    &:hover,
    &--highlighted {
      background: rgba($orange-primary, 0.1);
    }

    &-label {
      font-weight: $font-weight-medium;
    }

    &-desc {
      font-size: $font-size-xs;
      color: $text-muted;
    }
  }

  &__loading,
  &__empty {
    padding: $spacing-3;
    text-align: center;
    font-size: $font-size-sm;
    color: $text-muted;
  }
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
