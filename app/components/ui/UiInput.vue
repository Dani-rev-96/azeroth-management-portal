<script setup lang="ts">
/**
 * UiInput - Form input component
 */
export interface Props {
  modelValue: string | number | null
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  min?: number
  max?: number
  step?: number
  autocomplete?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  readonly: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = props.type === 'number' ? Number(target.value) : target.value
  emit('update:modelValue', value)
}
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :min="min"
    :max="max"
    :step="step"
    :autocomplete="autocomplete"
    class="ui-input"
    @input="handleInput"
  />
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-input {
  width: 100%;
  padding: $spacing-3 $spacing-4;
  background: $bg-primary;
  border: 1px solid $border-primary;
  border-radius: $radius-lg;
  color: $text-primary;
  font-size: $font-size-base;
  font-family: inherit;
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
