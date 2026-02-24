import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiTabPanel from '../../../../../app/components/ui/UiTabPanel.vue'

describe('UiTabPanel', () => {
  it('renders content when active', () => {
    const wrapper = mount(UiTabPanel, {
      props: { id: 'tab1', active: true },
      slots: { default: '<p>Tab content</p>' },
    })
    expect(wrapper.text()).toContain('Tab content')
  })

  it('does not render when not active', () => {
    const wrapper = mount(UiTabPanel, {
      props: { id: 'tab1', active: false },
      slots: { default: '<p>Tab content</p>' },
    })
    expect(wrapper.text()).not.toContain('Tab content')
  })

  it('does not render by default (active defaults to false)', () => {
    const wrapper = mount(UiTabPanel, {
      props: { id: 'tab1' },
      slots: { default: 'Content' },
    })
    expect(wrapper.text()).not.toContain('Content')
  })

  it('sets correct id attribute', () => {
    const wrapper = mount(UiTabPanel, {
      props: { id: 'settings', active: true },
    })
    expect(wrapper.find('section').attributes('id')).toBe('panel-settings')
  })

  it('has role="tabpanel"', () => {
    const wrapper = mount(UiTabPanel, {
      props: { id: 'settings', active: true },
    })
    expect(wrapper.find('section').attributes('role')).toBe('tabpanel')
  })

  it('has aria-labelledby attribute', () => {
    const wrapper = mount(UiTabPanel, {
      props: { id: 'settings', active: true },
    })
    expect(wrapper.find('section').attributes('aria-labelledby')).toBe('tab-settings')
  })
})
