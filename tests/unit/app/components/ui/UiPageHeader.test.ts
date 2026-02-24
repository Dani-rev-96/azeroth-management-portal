import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiPageHeader from '../../../../../app/components/ui/UiPageHeader.vue'

describe('UiPageHeader', () => {
  it('renders title', () => {
    const wrapper = mount(UiPageHeader, { props: { title: 'Dashboard' } })
    expect(wrapper.find('.ui-page-header__title').text()).toBe('Dashboard')
  })

  it('renders as h1', () => {
    const wrapper = mount(UiPageHeader, { props: { title: 'Test' } })
    expect(wrapper.find('h1').exists()).toBe(true)
  })

  it('shows subtitle when provided', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Title', subtitle: 'Description text' },
    })
    expect(wrapper.find('.ui-page-header__subtitle').text()).toBe('Description text')
  })

  it('hides subtitle when not provided', () => {
    const wrapper = mount(UiPageHeader, { props: { title: 'Title' } })
    expect(wrapper.find('.ui-page-header__subtitle').exists()).toBe(false)
  })

  it('applies gradient class by default', () => {
    const wrapper = mount(UiPageHeader, { props: { title: 'Title' } })
    expect(wrapper.find('.ui-page-header__title').classes()).toContain('ui-page-header__title--gradient')
  })

  it('removes gradient class when disabled', () => {
    const wrapper = mount(UiPageHeader, { props: { title: 'Title', gradient: false } })
    expect(wrapper.find('.ui-page-header__title').classes()).not.toContain('ui-page-header__title--gradient')
  })

  it('renders actions slot', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Title' },
      slots: { actions: '<button>Action</button>' },
    })
    expect(wrapper.find('.ui-page-header__actions').exists()).toBe(true)
    expect(wrapper.text()).toContain('Action')
  })

  it('hides actions when no slot content', () => {
    const wrapper = mount(UiPageHeader, { props: { title: 'Title' } })
    expect(wrapper.find('.ui-page-header__actions').exists()).toBe(false)
  })

  it('renders as header element', () => {
    const wrapper = mount(UiPageHeader, { props: { title: 'Title' } })
    expect(wrapper.element.tagName).toBe('HEADER')
  })
})
