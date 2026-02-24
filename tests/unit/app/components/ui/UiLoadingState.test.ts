import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiLoadingState from '../../../../../app/components/ui/UiLoadingState.vue'

describe('UiLoadingState', () => {
  it('renders with default message', () => {
    const wrapper = mount(UiLoadingState)
    expect(wrapper.text()).toContain('Loading...')
  })

  it('renders with custom message', () => {
    const wrapper = mount(UiLoadingState, { props: { message: 'Fetching data...' } })
    expect(wrapper.text()).toContain('Fetching data...')
  })

  it('shows spinner', () => {
    const wrapper = mount(UiLoadingState)
    expect(wrapper.find('.ui-loading__spinner').exists()).toBe(true)
  })

  it('has role="status"', () => {
    const wrapper = mount(UiLoadingState)
    expect(wrapper.attributes('role')).toBe('status')
  })

  it('has aria-live="polite"', () => {
    const wrapper = mount(UiLoadingState)
    expect(wrapper.attributes('aria-live')).toBe('polite')
  })

  it('applies default size (md)', () => {
    const wrapper = mount(UiLoadingState)
    expect(wrapper.classes()).toContain('ui-loading--md')
  })

  it('applies size classes', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    for (const size of sizes) {
      const wrapper = mount(UiLoadingState, { props: { size } })
      expect(wrapper.classes()).toContain(`ui-loading--${size}`)
    }
  })

  it('spinner has aria-hidden', () => {
    const wrapper = mount(UiLoadingState)
    expect(wrapper.find('.ui-loading__spinner').attributes('aria-hidden')).toBe('true')
  })
})
