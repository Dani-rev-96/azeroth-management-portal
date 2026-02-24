import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UiMessage from '../../../../../app/components/ui/UiMessage.vue'

describe('UiMessage', () => {
  it('renders slot content', () => {
    const wrapper = mount(UiMessage, { slots: { default: 'Operation successful' } })
    expect(wrapper.text()).toContain('Operation successful')
  })

  it('applies default variant (info)', () => {
    const wrapper = mount(UiMessage)
    expect(wrapper.classes()).toContain('ui-message--info')
  })

  it('applies all variant classes', () => {
    const variants = ['success', 'error', 'warning', 'info'] as const
    for (const variant of variants) {
      const wrapper = mount(UiMessage, { props: { variant } })
      expect(wrapper.classes()).toContain(`ui-message--${variant}`)
    }
  })

  it('shows correct icon per variant', () => {
    const iconMap: Record<string, string> = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    }
    for (const [variant, icon] of Object.entries(iconMap)) {
      const wrapper = mount(UiMessage, { props: { variant: variant as any } })
      expect(wrapper.find('.ui-message__icon').text()).toBe(icon)
    }
  })

  it('has role="alert"', () => {
    const wrapper = mount(UiMessage)
    expect(wrapper.attributes('role')).toBe('alert')
  })

  it('does not show dismiss button by default', () => {
    const wrapper = mount(UiMessage)
    expect(wrapper.find('.ui-message__dismiss').exists()).toBe(false)
  })

  it('shows dismiss button when dismissible', () => {
    const wrapper = mount(UiMessage, { props: { dismissible: true } })
    expect(wrapper.find('.ui-message__dismiss').exists()).toBe(true)
  })

  it('emits dismiss and hides on dismiss click', async () => {
    const wrapper = mount(UiMessage, { props: { dismissible: true } })

    await wrapper.find('.ui-message__dismiss').trigger('click')

    expect(wrapper.emitted('dismiss')).toBeTruthy()
    // After dismiss, the element should be hidden (v-if="visible")
    expect(wrapper.find('.ui-message').exists()).toBe(false)
  })

  it('dismiss button has aria-label', () => {
    const wrapper = mount(UiMessage, { props: { dismissible: true } })
    expect(wrapper.find('.ui-message__dismiss').attributes('aria-label')).toBe('Dismiss message')
  })
})
