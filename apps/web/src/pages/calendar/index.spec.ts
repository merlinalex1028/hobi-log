import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import CalendarPage from './index.vue'
import { getCalendarEvents } from '@/api/calendar.api'
import type { CalendarEventVo } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerMock.push }) }))
vi.mock('@/api/calendar.api', () => ({ getCalendarEvents: vi.fn() }))
vi.mock('@fullcalendar/vue3', () => ({
  default: defineComponent({
    name: 'FullCalendar',
    props: { options: { type: Object, required: true } },
    template: '<div class="fullcalendar-stub" />',
  }),
}))
vi.mock('@fullcalendar/vue3/daygrid', () => ({ default: { name: 'daygrid' } }))
vi.mock('@fullcalendar/vue3/timegrid', () => ({ default: { name: 'timegrid' } }))
vi.mock('@fullcalendar/vue3/list', () => ({ default: { name: 'list' } }))
vi.mock('@fullcalendar/vue3/themes/classic', () => ({ default: { name: 'classic' } }))
vi.mock('@fullcalendar/vue3/locales/zh-cn', () => ({ default: { code: 'zh-cn' } }))

const mockedEvents = vi.mocked(getCalendarEvents)

function event(overrides: Partial<CalendarEventVo> = {}): CalendarEventVo {
  return {
    id: 'payment:p1',
    type: 'PAYMENT_DUE',
    date: '2026-11-20',
    orderId: 'o1',
    title: '芙宁娜 1/7 手办',
    amount: 500,
    currency: 'CNY',
    precision: 'DAY',
    displayStatus: 'WAITING_PAYMENT',
    ...overrides,
  }
}

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

type CalendarOptionsLike = {
  events: Array<{ title: string; backgroundColor: string; extendedProps: Record<string, unknown> }>
  datesSet: (info: {
    startStr: string
    endStr: string
    view: { type: string; title: string }
  }) => void
  eventClick: (info: { event: { extendedProps: Record<string, unknown> } }) => void
}

function optionsOf(wrapper: ReturnType<typeof mountPage>): CalendarOptionsLike {
  return wrapper.findComponent({ name: 'FullCalendar' }).props('options') as CalendarOptionsLike
}

describe('日历 Calendar', () => {
  beforeEach(() => {
    routerMock.push.mockReset()
    mockedEvents.mockReset()
    mockedEvents.mockResolvedValue([event()])
  })

  it('datesSet 决定查询区间（含首含尾）', async () => {
    const wrapper = mountPage()
    optionsOf(wrapper).datesSet({
      startStr: '2026-10-26T00:00:00+08:00',
      endStr: '2026-12-06T00:00:00+08:00',
      view: { type: 'dayGridMonth', title: '2026年11月' },
    })
    await flushPromises()
    expect(mockedEvents).toHaveBeenCalledWith({ from: '2026-10-26', to: '2026-12-06' })
    expect(wrapper.text()).toContain('2026年11月')
  })

  it('区间不变时不重复请求', async () => {
    const wrapper = mountPage()
    const info = {
      startStr: '2026-11-01T00:00:00+08:00',
      endStr: '2026-11-30T00:00:00+08:00',
      view: { type: 'dayGridMonth', title: '2026年11月' },
    }
    optionsOf(wrapper).datesSet(info)
    await flushPromises()
    optionsOf(wrapper).datesSet(info)
    await flushPromises()
    expect(mockedEvents).toHaveBeenCalledTimes(1)
  })

  it('事件按类型带色，付款到期为红', async () => {
    const wrapper = mountPage()
    await flushPromises()
    optionsOf(wrapper).datesSet({
      startStr: '2026-11-01T00:00:00+08:00',
      endStr: '2026-11-30T00:00:00+08:00',
      view: { type: 'dayGridMonth', title: '2026年11月' },
    })
    await flushPromises()
    const events = optionsOf(wrapper).events
    expect(events).toHaveLength(1)
    expect(events[0]?.title).toBe('芙宁娜 1/7 手办')
    expect(events[0]?.backgroundColor).toBe('#d14b4b')
  })

  it('点击事件打开抽屉并可跳转订单', async () => {
    const wrapper = mountPage()
    optionsOf(wrapper).datesSet({
      startStr: '2026-11-01T00:00:00+08:00',
      endStr: '2026-11-30T00:00:00+08:00',
      view: { type: 'dayGridMonth', title: '2026年11月' },
    })
    await flushPromises()

    const options = optionsOf(wrapper)
    options.eventClick({ event: { extendedProps: options.events[0]?.extendedProps ?? {} } })
    await flushPromises()

    const drawer = wrapper.find('.el-drawer')
    expect(drawer.exists()).toBe(true)
    expect(drawer.text()).toContain('芙宁娜 1/7 手办')
    expect(drawer.text()).toContain('付款到期')

    const button = drawer.findAll('button').find(item => item.text() === '查看订单')
    await button?.trigger('click')
    expect(routerMock.push).toHaveBeenCalledWith('/orders/o1')
  })

  it('extendedProps 缺少 orderId 时不打开抽屉', async () => {
    const wrapper = mountPage()
    const options = optionsOf(wrapper)
    options.eventClick({ event: { extendedProps: {} } })
    await flushPromises()
    expect(wrapper.find('.el-drawer').exists()).toBe(false)
  })
})
