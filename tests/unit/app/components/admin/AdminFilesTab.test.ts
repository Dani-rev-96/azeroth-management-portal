import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminFilesTab from '../../../../../app/components/admin/AdminFilesTab.vue'

const FILES = [{ name: 'client.7z', size: 2048, modified: '2025-01-01T00:00:00.000Z' }]

describe('AdminFilesTab', () => {
  it('shows speed, ETA and a cancel button while uploading', async () => {
    const wrapper = mount(AdminFilesTab, {
      props: {
        files: FILES,
        uploading: true,
        uploadProgress: 40,
        uploadBytesPerSecond: 2 * 1024 * 1024,
        uploadEtaSeconds: 125,
      },
    })

    expect(wrapper.find('.upload-progress__stats').text()).toBe('2.0 MB/s · 2m 05s remaining')

    const cancel = wrapper.findAll('button').find(button => button.text().includes('Cancel'))
    expect(cancel).toBeDefined()
    await cancel!.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('shows a starting state before the first speed sample', () => {
    const wrapper = mount(AdminFilesTab, {
      props: { files: FILES, uploading: true, uploadProgress: 0 },
    })
    expect(wrapper.find('.upload-progress__stats').text()).toBe('Starting…')
  })

  it('formats long ETAs in hours', () => {
    const wrapper = mount(AdminFilesTab, {
      props: { files: FILES, uploading: true, uploadBytesPerSecond: 1024, uploadEtaSeconds: 3 * 3600 + 5 * 60 },
    })
    expect(wrapper.find('.upload-progress__stats').text()).toBe('1.0 KB/s · 3h 05m remaining')
  })

  it('hides the progress block when idle and links downloads by encoded name', () => {
    const wrapper = mount(AdminFilesTab, {
      props: { files: [{ name: 'Wörld 1.zip', size: 1, modified: '2025-01-01T00:00:00.000Z' }] },
    })
    expect(wrapper.find('.upload-progress').exists()).toBe(false)
    expect(wrapper.find('a.download-link').attributes('href')).toBe('/api/downloads/W%C3%B6rld%201.zip')
  })
})
