import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiInput from '../../../../../app/components/ui/UiInput.vue'

describe('UiInput', () => {
  it('renders an input element', () => {
    const wrapper = mount(UiInput, { props: { modelValue: '' } })
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('renders with text type by default', () => {
    const wrapper = mount(UiInput, { props: { modelValue: '' } })
    expect(wrapper.find('input').attributes('type')).toBe('text')
  })

  it('renders with specified type', () => {
    const wrapper = mount(UiInput, { props: { modelValue: '', type: 'password' } })
    expect(wrapper.find('input').attributes('type')).toBe('password')
  })

  it('renders with placeholder', () => {
    const wrapper = mount(UiInput, { props: { modelValue: '', placeholder: 'Enter text...' } })
    expect(wrapper.find('input').attributes('placeholder')).toBe('Enter text...')
  })

  it('displays current value', () => {
    const wrapper = mount(UiInput, { props: { modelValue: 'hello' } })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('hello')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(UiInput, { props: { modelValue: '' } })
    const input = wrapper.find('input')
    await input.setValue('new value')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['new value'])
  })

  it('emits number for type="number" input', async () => {
    const wrapper = mount(UiInput, { props: { modelValue: 0, type: 'number' } })
    const input = wrapper.find('input')
    await input.setValue('42')

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([42])
  })

  it('is disabled when prop set', () => {
    const wrapper = mount(UiInput, { props: { modelValue: '', disabled: true } })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })

  it('is readonly when prop set', () => {
    const wrapper = mount(UiInput, { props: { modelValue: '', readonly: true } })
    expect(wrapper.find('input').attributes('readonly')).toBeDefined()
  })

  it('is required when prop set', () => {
    const wrapper = mount(UiInput, { props: { modelValue: '', required: true } })
    expect(wrapper.find('input').attributes('required')).toBeDefined()
  })

  it('sets min and max attributes', () => {
    const wrapper = mount(UiInput, { props: { modelValue: 5, type: 'number', min: 0, max: 100 } })
    const input = wrapper.find('input')
    expect(input.attributes('min')).toBe('0')
    expect(input.attributes('max')).toBe('100')
  })

  it('has ui-input class', () => {
    const wrapper = mount(UiInput, { props: { modelValue: '' } })
    expect(wrapper.find('input').classes()).toContain('ui-input')
  })
})
