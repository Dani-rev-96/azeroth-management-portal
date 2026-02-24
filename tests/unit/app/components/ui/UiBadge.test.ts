import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiBadge from '../../../../../app/components/ui/UiBadge.vue'

describe('UiBadge', () => {
  it('renders slot content', () => {
    const wrapper = mount(UiBadge, { slots: { default: 'Online' } })
    expect(wrapper.text()).toBe('Online')
  })

  it('applies default variant class', () => {
    const wrapper = mount(UiBadge)
    expect(wrapper.classes()).toContain('ui-badge--default')
  })

  it('applies specified variant class', () => {
    const wrapper = mount(UiBadge, { props: { variant: 'success' } })
    expect(wrapper.classes()).toContain('ui-badge--success')
  })

  it('applies all variant classes correctly', () => {
    const variants = ['default', 'success', 'error', 'warning', 'info', 'gm', 'level', 'online', 'offline'] as const
    for (const variant of variants) {
      const wrapper = mount(UiBadge, { props: { variant } })
      expect(wrapper.classes()).toContain(`ui-badge--${variant}`)
    }
  })

  it('applies default size class md', () => {
    const wrapper = mount(UiBadge)
    expect(wrapper.classes()).toContain('ui-badge--md')
  })

  it('applies sm size class', () => {
    const wrapper = mount(UiBadge, { props: { size: 'sm' } })
    expect(wrapper.classes()).toContain('ui-badge--sm')
  })

  it('applies outline class when enabled', () => {
    const wrapper = mount(UiBadge, { props: { outline: true } })
    expect(wrapper.classes()).toContain('ui-badge--outline')
  })

  it('does not apply outline class by default', () => {
    const wrapper = mount(UiBadge)
    expect(wrapper.classes()).not.toContain('ui-badge--outline')
  })

  it('renders as a span element', () => {
    const wrapper = mount(UiBadge)
    expect(wrapper.element.tagName).toBe('SPAN')
  })
})
