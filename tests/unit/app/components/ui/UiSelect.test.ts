import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiSelect from '../../../../../app/components/ui/UiSelect.vue'

const options = [
  { value: 'warrior', label: 'Warrior' },
  { value: 'mage', label: 'Mage' },
  { value: 'priest', label: 'Priest' },
]

describe('UiSelect', () => {
  it('renders a select element', () => {
    const wrapper = mount(UiSelect, { props: { modelValue: '', options } })
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('renders all options', () => {
    const wrapper = mount(UiSelect, { props: { modelValue: '', options } })
    // +1 for placeholder option
    const optionElements = wrapper.findAll('option')
    expect(optionElements).toHaveLength(4)
  })

  it('renders placeholder as first disabled option', () => {
    const wrapper = mount(UiSelect, {
      props: { modelValue: '', options, placeholder: 'Select class' },
    })
    const firstOption = wrapper.find('option')
    expect(firstOption.text()).toBe('Select class')
    expect(firstOption.attributes('disabled')).toBeDefined()
  })

  it('renders option labels', () => {
    const wrapper = mount(UiSelect, { props: { modelValue: '', options } })
    expect(wrapper.text()).toContain('Warrior')
    expect(wrapper.text()).toContain('Mage')
    expect(wrapper.text()).toContain('Priest')
  })

  it('emits update:modelValue on change', async () => {
    const wrapper = mount(UiSelect, { props: { modelValue: '', options } })
    await wrapper.find('select').setValue('mage')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['mage'])
  })

  it('emits numeric value as number', async () => {
    const numericOptions = [
      { value: 1, label: 'Warrior' },
      { value: 2, label: 'Paladin' },
    ]
    const wrapper = mount(UiSelect, { props: { modelValue: 0, options: numericOptions } })
    await wrapper.find('select').setValue('2')

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([2])
  })

  it('is disabled when prop set', () => {
    const wrapper = mount(UiSelect, { props: { modelValue: '', options, disabled: true } })
    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
  })

  it('is required when prop set', () => {
    const wrapper = mount(UiSelect, { props: { modelValue: '', options, required: true } })
    expect(wrapper.find('select').attributes('required')).toBeDefined()
  })

  it('renders disabled options', () => {
    const withDisabled = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
    ]
    const wrapper = mount(UiSelect, { props: { modelValue: '', options: withDisabled } })
    const opts = wrapper.findAll('option:not([value=""])')
    expect(opts[1]!.attributes('disabled')).toBeDefined()
  })

  it('has ui-select class', () => {
    const wrapper = mount(UiSelect, { props: { modelValue: '', options } })
    expect(wrapper.find('select').classes()).toContain('ui-select')
  })
})
