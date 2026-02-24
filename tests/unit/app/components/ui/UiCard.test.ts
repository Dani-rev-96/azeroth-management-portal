import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiCard from '../../../../../app/components/ui/UiCard.vue'

describe('UiCard', () => {
  it('renders slot content', () => {
    const wrapper = mount(UiCard, { slots: { default: '<p>Card body</p>' } })
    expect(wrapper.text()).toContain('Card body')
  })

  it('renders as article by default', () => {
    const wrapper = mount(UiCard)
    expect(wrapper.element.tagName).toBe('ARTICLE')
  })

  it('renders with custom element via "as" prop', () => {
    const wrapper = mount(UiCard, { props: { as: 'section' } })
    expect(wrapper.element.tagName).toBe('SECTION')
  })

  it('applies default padding (md)', () => {
    const wrapper = mount(UiCard)
    expect(wrapper.classes()).toContain('ui-card--padding-md')
  })

  it('applies all padding classes', () => {
    const paddings = ['none', 'sm', 'md', 'lg'] as const
    for (const padding of paddings) {
      const wrapper = mount(UiCard, { props: { padding } })
      expect(wrapper.classes()).toContain(`ui-card--padding-${padding}`)
    }
  })

  it('is not hoverable by default', () => {
    const wrapper = mount(UiCard)
    expect(wrapper.classes()).not.toContain('ui-card--hoverable')
  })

  it('applies hoverable class', () => {
    const wrapper = mount(UiCard, { props: { hoverable: true } })
    expect(wrapper.classes()).toContain('ui-card--hoverable')
  })

  it('always has ui-card base class', () => {
    const wrapper = mount(UiCard)
    expect(wrapper.classes()).toContain('ui-card')
  })
})
