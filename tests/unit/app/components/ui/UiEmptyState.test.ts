import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiEmptyState from '../../../../../app/components/ui/UiEmptyState.vue'

describe('UiEmptyState', () => {
  it('renders with default message', () => {
    const wrapper = mount(UiEmptyState)
    expect(wrapper.text()).toContain('No data found')
  })

  it('renders custom message', () => {
    const wrapper = mount(UiEmptyState, { props: { message: 'Nothing here' } })
    expect(wrapper.text()).toContain('Nothing here')
  })

  it('renders default icon', () => {
    const wrapper = mount(UiEmptyState)
    expect(wrapper.find('.ui-empty-state__icon').text()).toBe('📭')
  })

  it('renders custom icon', () => {
    const wrapper = mount(UiEmptyState, { props: { icon: '🔍' } })
    expect(wrapper.find('.ui-empty-state__icon').text()).toBe('🔍')
  })

  it('renders title when provided', () => {
    const wrapper = mount(UiEmptyState, { props: { title: 'No Results' } })
    expect(wrapper.find('.ui-empty-state__title').text()).toBe('No Results')
  })

  it('hides title when not provided', () => {
    const wrapper = mount(UiEmptyState)
    expect(wrapper.find('.ui-empty-state__title').exists()).toBe(false)
  })

  it('renders action slot', () => {
    const wrapper = mount(UiEmptyState, {
      slots: { action: '<button>Retry</button>' },
    })
    expect(wrapper.find('.ui-empty-state__action').exists()).toBe(true)
    expect(wrapper.text()).toContain('Retry')
  })

  it('hides action area when no action slot', () => {
    const wrapper = mount(UiEmptyState)
    expect(wrapper.find('.ui-empty-state__action').exists()).toBe(false)
  })

  it('has role="status"', () => {
    const wrapper = mount(UiEmptyState)
    expect(wrapper.attributes('role')).toBe('status')
  })

  it('icon has aria-hidden', () => {
    const wrapper = mount(UiEmptyState)
    expect(wrapper.find('.ui-empty-state__icon').attributes('aria-hidden')).toBe('true')
  })
})
