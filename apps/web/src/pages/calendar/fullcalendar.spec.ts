import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarPage from './index.vue'
import { getCalendarEvents } from '@/api/calendar.api'
import { elementStubs } from '@/test/element-stubs'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/calendar.api', () => ({ getCalendarEvents: vi.fn() }))

const mockedEvents = vi.mocked(getCalendarEvents)
const today = new Date().toISOString().slice(0, 10)

describe('日历页真实 FullCalendar 集成', () => {
  beforeEach(() => {
    mockedEvents.mockReset()
    mockedEvents.mockResolvedValue([
      {
        id: 'payment:p1',
        type: 'PAYMENT_DUE',
        date: today,
        orderId: 'o1',
        title: 'SMOKE 手办',
        amount: 500,
        currency: 'CNY',
        precision: 'DAY',
        displayStatus: 'WAITING_PAYMENT',
      },
    ])
  })

  function mountPage() {
    return mount(CalendarPage, {
      global: {
        stubs: { ...elementStubs },
        plugins: [
          createPinia(),
          [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
        ],
      },
    })
  }

  it('挂载后 datesSet 驱动查询可见区间，并把事件渲染进日历 DOM', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 50))
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 50))
    await flushPromises()

    expect(wrapper.text()).toMatch(/年\d+月/)
    const [firstCall] = mockedEvents.mock.calls
    expect(firstCall).toBeDefined()
    const params = firstCall?.[0] as { from: string; to: string }
    expect(params.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(params.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(params.from <= today && today <= params.to).toBe(true)

    expect(wrapper.text()).toContain('SMOKE 手办')
  })
})
