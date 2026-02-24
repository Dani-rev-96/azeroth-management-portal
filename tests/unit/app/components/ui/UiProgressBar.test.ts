import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiProgressBar from '../../../../../app/components/ui/UiProgressBar.vue'

describe('UiProgressBar', () => {
  it('renders with required value prop', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 50 } })
    expect(wrapper.find('.ui-progress').exists()).toBe(true)
  })

  it('calculates percentage correctly', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 75, showLabel: true } })
    expect(wrapper.find('.ui-progress__label').text()).toBe('75%')
  })

  it('calculates percentage with custom max', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 50, max: 200, showLabel: true } })
    expect(wrapper.find('.ui-progress__label').text()).toBe('25%')
  })

  it('clamps percentage at 100', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 150, max: 100, showLabel: true } })
    expect(wrapper.find('.ui-progress__label').text()).toBe('100%')
  })

  it('clamps percentage at 0', () => {
    const wrapper = mount(UiProgressBar, { props: { value: -10, max: 100, showLabel: true } })
    expect(wrapper.find('.ui-progress__label').text()).toBe('0%')
  })

  it('sets fill width style', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 60 } })
    const fill = wrapper.find('.ui-progress__fill')
    expect(fill.attributes('style')).toContain('width: 60%')
  })

  it('shows label by default', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 50 } })
    expect(wrapper.find('.ui-progress__label').exists()).toBe(true)
  })

  it('hides label when showLabel is false', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 50, showLabel: false } })
    expect(wrapper.find('.ui-progress__label').exists()).toBe(false)
  })

  it('applies default size (md)', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 50 } })
    expect(wrapper.classes()).toContain('ui-progress--md')
  })

  it('applies size classes', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    for (const size of sizes) {
      const wrapper = mount(UiProgressBar, { props: { value: 50, size } })
      expect(wrapper.classes()).toContain(`ui-progress--${size}`)
    }
  })

  it('applies variant classes', () => {
    const variants = ['default', 'success', 'warning', 'error'] as const
    for (const variant of variants) {
      const wrapper = mount(UiProgressBar, { props: { value: 50, variant } })
      expect(wrapper.classes()).toContain(`ui-progress--${variant}`)
    }
  })

  it('has correct ARIA attributes', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 30, max: 100 } })
    expect(wrapper.attributes('role')).toBe('progressbar')
    expect(wrapper.attributes('aria-valuenow')).toBe('30')
    expect(wrapper.attributes('aria-valuemin')).toBe('0')
    expect(wrapper.attributes('aria-valuemax')).toBe('100')
  })

  it('rounds percentage in label', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 33, max: 100, showLabel: true } })
    expect(wrapper.find('.ui-progress__label').text()).toBe('33%')
  })
})
