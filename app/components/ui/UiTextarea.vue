<script setup lang="ts">
/**
 * UiTextarea - Multi-line text input component
 */
export interface Props {
  modelValue: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  rows?: number
  maxlength?: number
}

withDefaults(defineProps<Props>(), {
  placeholder: '',
  disabled: false,
  readonly: false,
  required: false,
  rows: 4,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :rows="rows"
    :maxlength="maxlength"
    class="ui-textarea"
    @input="handleInput"
  />
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-textarea {
  width: 100%;
  padding: $spacing-3 $spacing-4;
  background: $bg-primary;
  border: 1px solid $border-primary;
  border-radius: $radius-lg;
  color: $text-primary;
  font-size: $font-size-base;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
  transition: border-color $transition-base;

  &::placeholder {
    color: $text-muted;
  }

  &:focus {
    outline: none;
    border-color: $blue-light;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:read-only {
    background: $bg-tertiary;
  }
}
</style>
