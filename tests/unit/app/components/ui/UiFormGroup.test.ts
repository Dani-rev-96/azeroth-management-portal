import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiFormGroup from '../../../../../app/components/ui/UiFormGroup.vue'

describe('UiFormGroup', () => {
  it('renders label when provided', () => {
    const wrapper = mount(UiFormGroup, { props: { label: 'Username' } })
    expect(wrapper.find('.ui-form-group__label').text()).toContain('Username')
  })

  it('hides label when not provided', () => {
    const wrapper = mount(UiFormGroup)
    expect(wrapper.find('.ui-form-group__label').exists()).toBe(false)
  })

  it('shows required indicator when required', () => {
    const wrapper = mount(UiFormGroup, { props: { label: 'Email', required: true } })
    expect(wrapper.find('.ui-form-group__required').exists()).toBe(true)
    expect(wrapper.find('.ui-form-group__required').text()).toBe('*')
  })

  it('hides required indicator when not required', () => {
    const wrapper = mount(UiFormGroup, { props: { label: 'Email' } })
    expect(wrapper.find('.ui-form-group__required').exists()).toBe(false)
  })

  it('shows hint when provided and no error', () => {
    const wrapper = mount(UiFormGroup, { props: { hint: '3-16 characters' } })
    expect(wrapper.find('.ui-form-group__hint').text()).toBe('3-16 characters')
  })

  it('shows error when provided', () => {
    const wrapper = mount(UiFormGroup, { props: { error: 'Field is required' } })
    expect(wrapper.find('.ui-form-group__error').text()).toBe('Field is required')
  })

  it('error has role="alert"', () => {
    const wrapper = mount(UiFormGroup, { props: { error: 'Error' } })
    expect(wrapper.find('.ui-form-group__error').attributes('role')).toBe('alert')
  })

  it('shows error instead of hint when both provided', () => {
    const wrapper = mount(UiFormGroup, {
      props: { hint: 'Helpful hint', error: 'Field error' },
    })
    expect(wrapper.find('.ui-form-group__error').exists()).toBe(true)
    expect(wrapper.find('.ui-form-group__hint').exists()).toBe(false)
  })

  it('renders slot content', () => {
    const wrapper = mount(UiFormGroup, {
      slots: { default: '<input type="text" />' },
    })
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('sets for attribute on label', () => {
    const wrapper = mount(UiFormGroup, { props: { label: 'Name', htmlFor: 'name-input' } })
    expect(wrapper.find('label').attributes('for')).toBe('name-input')
  })

  it('required indicator has aria-hidden', () => {
    const wrapper = mount(UiFormGroup, { props: { label: 'Test', required: true } })
    expect(wrapper.find('.ui-form-group__required').attributes('aria-hidden')).toBe('true')
  })
})
