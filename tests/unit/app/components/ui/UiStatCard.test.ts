import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiStatCard from '../../../../../app/components/ui/UiStatCard.vue'

describe('UiStatCard', () => {
  const requiredProps = { value: '42', label: 'Players Online' }

  it('renders value and label', () => {
    const wrapper = mount(UiStatCard, { props: requiredProps })
    expect(wrapper.find('.ui-stat-card__value').text()).toBe('42')
    expect(wrapper.find('.ui-stat-card__label').text()).toBe('Players Online')
  })

  it('renders numeric value', () => {
    const wrapper = mount(UiStatCard, { props: { value: 1337, label: 'Score' } })
    expect(wrapper.find('.ui-stat-card__value').text()).toBe('1337')
  })

  it('renders icon when provided', () => {
    const wrapper = mount(UiStatCard, { props: { ...requiredProps, icon: '🎮' } })
    expect(wrapper.find('.ui-stat-card__icon').text()).toBe('🎮')
  })

  it('hides icon when not provided', () => {
    const wrapper = mount(UiStatCard, { props: requiredProps })
    expect(wrapper.find('.ui-stat-card__icon').exists()).toBe(false)
  })

  it('icon has aria-hidden', () => {
    const wrapper = mount(UiStatCard, { props: { ...requiredProps, icon: '⚔️' } })
    expect(wrapper.find('.ui-stat-card__icon').attributes('aria-hidden')).toBe('true')
  })

  it('applies default size (md)', () => {
    const wrapper = mount(UiStatCard, { props: requiredProps })
    expect(wrapper.classes()).toContain('ui-stat-card--md')
  })

  it('applies size classes', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    for (const size of sizes) {
      const wrapper = mount(UiStatCard, { props: { ...requiredProps, size } })
      expect(wrapper.classes()).toContain(`ui-stat-card--${size}`)
    }
  })

  it('applies default variant', () => {
    const wrapper = mount(UiStatCard, { props: requiredProps })
    expect(wrapper.classes()).toContain('ui-stat-card--default')
  })

  it('applies variant classes', () => {
    const variants = ['default', 'highlight', 'muted'] as const
    for (const variant of variants) {
      const wrapper = mount(UiStatCard, { props: { ...requiredProps, variant } })
      expect(wrapper.classes()).toContain(`ui-stat-card--${variant}`)
    }
  })

  it('renders as article element', () => {
    const wrapper = mount(UiStatCard, { props: requiredProps })
    expect(wrapper.element.tagName).toBe('ARTICLE')
  })
})
