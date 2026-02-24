import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UiModal from '../../../../../app/components/ui/UiModal.vue'

describe('UiModal', () => {
  // UiModal uses Teleport to body - we need to test with attachTo or stubs
  const mountModal = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) => {
    return mount(UiModal, {
      props: { open: true, ...props },
      slots: { default: 'Modal content', ...slots },
      global: {
        stubs: { Teleport: true },
      },
    })
  }

  it('renders content when open', () => {
    const wrapper = mountModal()
    expect(wrapper.text()).toContain('Modal content')
  })

  it('does not render content when closed', () => {
    const wrapper = mountModal({ open: false })
    expect(wrapper.text()).not.toContain('Modal content')
  })

  it('renders title when provided', () => {
    const wrapper = mountModal({ title: 'Confirm Action' })
    expect(wrapper.find('.ui-modal__title').text()).toBe('Confirm Action')
  })

  it('hides close button when not closable', () => {
    const wrapper = mountModal({ closable: false, title: 'Title' })
    expect(wrapper.find('.ui-modal__close').exists()).toBe(false)
  })

  it('shows close button by default', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.ui-modal__close').exists()).toBe(true)
  })

  it('emits close when close button clicked', async () => {
    const wrapper = mountModal()
    await wrapper.find('.ui-modal__close').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close on backdrop click', async () => {
    const wrapper = mountModal()
    await wrapper.find('.ui-modal__backdrop').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('does not emit close on backdrop click when not closable', async () => {
    const wrapper = mountModal({ closable: false })
    // Need to find and click the backdrop
    const backdrop = wrapper.find('.ui-modal__backdrop')
    if (backdrop.exists()) {
      await backdrop.trigger('click')
    }
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('applies size classes', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    for (const size of sizes) {
      const wrapper = mountModal({ size })
      expect(wrapper.find('.ui-modal').classes()).toContain(`ui-modal--${size}`)
    }
  })

  it('applies default size (md)', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.ui-modal').classes()).toContain('ui-modal--md')
  })

  it('has role="dialog"', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.ui-modal__backdrop').attributes('role')).toBe('dialog')
  })

  it('has aria-modal attribute', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.ui-modal__backdrop').attributes('aria-modal')).toBe('true')
  })

  it('renders footer slot', () => {
    const wrapper = mountModal({}, { footer: '<button>Save</button>' })
    expect(wrapper.find('.ui-modal__footer').exists()).toBe(true)
    expect(wrapper.text()).toContain('Save')
  })

  it('hides footer when no slot content', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.ui-modal__footer').exists()).toBe(false)
  })

  it('close button has aria-label', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.ui-modal__close').attributes('aria-label')).toBe('Close modal')
  })
})
