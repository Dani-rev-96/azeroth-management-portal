import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiTabs from '../../../../../app/components/ui/UiTabs.vue'

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'advanced', label: 'Advanced' },
]

describe('UiTabs', () => {
  it('renders all tab buttons', () => {
    const wrapper = mount(UiTabs, { props: { tabs, modelValue: 'general' } })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
  })

  it('shows tab labels', () => {
    const wrapper = mount(UiTabs, { props: { tabs, modelValue: 'general' } })
    expect(wrapper.text()).toContain('General')
    expect(wrapper.text()).toContain('Security')
    expect(wrapper.text()).toContain('Advanced')
  })

  it('marks active tab', () => {
    const wrapper = mount(UiTabs, { props: { tabs, modelValue: 'security' } })
    const buttons = wrapper.findAll('button')
    const activeButton = buttons.find(b => b.classes().includes('ui-tabs__tab--active'))
    expect(activeButton?.text()).toContain('Security')
  })

  it('emits update:modelValue on tab click', async () => {
    const wrapper = mount(UiTabs, { props: { tabs, modelValue: 'general' } })
    const buttons = wrapper.findAll('button')
    await buttons[2]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['advanced']])
  })

  it('shows icon for tabs with icon', () => {
    const wrapper = mount(UiTabs, { props: { tabs, modelValue: 'general' } })
    const icons = wrapper.findAll('.ui-tabs__icon')
    expect(icons).toHaveLength(1)
    expect(icons[0]!.text()).toBe('🔒')
  })

  it('has correct ARIA roles', () => {
    const wrapper = mount(UiTabs, { props: { tabs, modelValue: 'general' } })
    expect(wrapper.find('nav').attributes('role')).toBe('tablist')

    const buttons = wrapper.findAll('button')
    for (const button of buttons) {
      expect(button.attributes('role')).toBe('tab')
    }
  })

  it('sets aria-selected correctly', () => {
    const wrapper = mount(UiTabs, { props: { tabs, modelValue: 'security' } })
    const buttons = wrapper.findAll('button')

    expect(buttons[0]!.attributes('aria-selected')).toBe('false')
    expect(buttons[1]!.attributes('aria-selected')).toBe('true')
    expect(buttons[2]!.attributes('aria-selected')).toBe('false')
  })

  it('applies default variant', () => {
    const wrapper = mount(UiTabs, { props: { tabs, modelValue: 'general' } })
    expect(wrapper.find('nav').classes()).toContain('ui-tabs--default')
  })

  it('applies admin variant', () => {
    const wrapper = mount(UiTabs, { props: { tabs, modelValue: 'general', variant: 'admin' } })
    expect(wrapper.find('nav').classes()).toContain('ui-tabs--admin')
  })
})
