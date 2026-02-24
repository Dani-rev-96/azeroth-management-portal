import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiButton from '../../../../../app/components/ui/UiButton.vue'

describe('UiButton', () => {
  // ─── Rendering ────────────────────────────────────────────────────────────

  it('renders slot content', () => {
    const wrapper = mount(UiButton, { slots: { default: 'Click Me' } })
    expect(wrapper.text()).toContain('Click Me')
  })

  it('renders as a button element', () => {
    const wrapper = mount(UiButton)
    expect(wrapper.element.tagName).toBe('BUTTON')
  })

  // ─── Variants ─────────────────────────────────────────────────────────────

  it('applies default variant (primary)', () => {
    const wrapper = mount(UiButton)
    expect(wrapper.classes()).toContain('ui-button--primary')
  })

  it('applies all variant classes correctly', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'admin'] as const
    for (const variant of variants) {
      const wrapper = mount(UiButton, { props: { variant } })
      expect(wrapper.classes()).toContain(`ui-button--${variant}`)
    }
  })

  // ─── Sizes ────────────────────────────────────────────────────────────────

  it('applies default size (md)', () => {
    const wrapper = mount(UiButton)
    expect(wrapper.classes()).toContain('ui-button--md')
  })

  it('applies all size classes', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    for (const size of sizes) {
      const wrapper = mount(UiButton, { props: { size } })
      expect(wrapper.classes()).toContain(`ui-button--${size}`)
    }
  })

  // ─── Type ─────────────────────────────────────────────────────────────────

  it('defaults to type="button"', () => {
    const wrapper = mount(UiButton)
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('sets type="submit"', () => {
    const wrapper = mount(UiButton, { props: { type: 'submit' } })
    expect(wrapper.attributes('type')).toBe('submit')
  })

  // ─── Disabled ─────────────────────────────────────────────────────────────

  it('is not disabled by default', () => {
    const wrapper = mount(UiButton)
    expect(wrapper.attributes('disabled')).toBeUndefined()
  })

  it('is disabled when prop set', () => {
    const wrapper = mount(UiButton, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  // ─── Loading ──────────────────────────────────────────────────────────────

  it('applies loading class when loading', () => {
    const wrapper = mount(UiButton, { props: { loading: true } })
    expect(wrapper.classes()).toContain('ui-button--loading')
  })

  it('is disabled when loading', () => {
    const wrapper = mount(UiButton, { props: { loading: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('shows spinner when loading', () => {
    const wrapper = mount(UiButton, { props: { loading: true } })
    expect(wrapper.find('.ui-button__spinner').exists()).toBe(true)
  })

  it('hides spinner when not loading', () => {
    const wrapper = mount(UiButton, { props: { loading: false } })
    expect(wrapper.find('.ui-button__spinner').exists()).toBe(false)
  })

  // ─── Block ────────────────────────────────────────────────────────────────

  it('applies block class when block', () => {
    const wrapper = mount(UiButton, { props: { block: true } })
    expect(wrapper.classes()).toContain('ui-button--block')
  })

  it('does not apply block class by default', () => {
    const wrapper = mount(UiButton)
    expect(wrapper.classes()).not.toContain('ui-button--block')
  })

  // ─── Click Events ────────────────────────────────────────────────────────

  it('emits click event', async () => {
    const wrapper = mount(UiButton)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
