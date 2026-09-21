import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AppChart from './AppChart.vue'

const chartMock = vi.hoisted(() => {
  const instance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
  return { instance, init: vi.fn(() => instance) }
})

vi.mock('echarts', () => ({ init: chartMock.init }))

class ResizeObserverStub {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('AppChart', () => {
  beforeEach(() => {
    chartMock.init.mockClear()
    chartMock.instance.setOption.mockClear()
    chartMock.instance.resize.mockClear()
    chartMock.instance.dispose.mockClear()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  it('挂载时 init + setOption', async () => {
    const option = { series: [] }
    const wrapper = mount(AppChart, { props: { option } })
    await flushPromises()
    expect(chartMock.init).toHaveBeenCalledTimes(1)
    expect(chartMock.instance.setOption).toHaveBeenCalledWith(option)
    expect(wrapper.find('.app-chart').attributes('style')).toContain('height: 280px')
  })

  it('height prop 生效', () => {
    const wrapper = mount(AppChart, { props: { option: {}, height: '320px' } })
    expect(wrapper.find('.app-chart').attributes('style')).toContain('height: 320px')
  })

  it('option 变化时重新 setOption（merge=false）', async () => {
    const wrapper = mount(AppChart, { props: { option: { series: [] } } })
    await flushPromises()
    await wrapper.setProps({ option: { series: [{ type: 'bar', data: [1] }] } })
    await nextTick()
    expect(chartMock.instance.setOption).toHaveBeenCalledTimes(2)
    expect(chartMock.instance.setOption.mock.calls[1]?.[1]).toBe(true)
  })

  it('卸载时 dispose', async () => {
    const wrapper = mount(AppChart, { props: { option: {} } })
    await flushPromises()
    wrapper.unmount()
    expect(chartMock.instance.dispose).toHaveBeenCalled()
  })
})
