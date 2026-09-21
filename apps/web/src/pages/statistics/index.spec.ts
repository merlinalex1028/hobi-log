import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StatisticsPage from './index.vue'
import { getCollectionStats } from '@/api/collection.api'
import { getDimensionStatistics, getFuturePayments, getMonthlyPayments } from '@/api/statistics.api'
import AppErrorState from '@/components/common/AppErrorState.vue'
import type { DimensionStatVo, FuturePaymentVo, MonthlyPaymentVo } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerMock.push }) }))
vi.mock('@/api/statistics.api', () => ({
  getMonthlyPayments: vi.fn(),
  getFuturePayments: vi.fn(),
  getDimensionStatistics: vi.fn(),
}))
vi.mock('@/api/collection.api', () => ({ getCollectionStats: vi.fn() }))

const mockedMonthly = vi.mocked(getMonthlyPayments)
const mockedFuture = vi.mocked(getFuturePayments)
const mockedDimension = vi.mocked(getDimensionStatistics)
const mockedCollectionStats = vi.mocked(getCollectionStats)

function monthly(overrides: Partial<MonthlyPaymentVo> = {}): MonthlyPaymentVo {
  return {
    month: '2026-09',
    currency: 'CNY',
    paidAmount: 0,
    refundAmount: 0,
    netPaidAmount: 0,
    orderAmount: 0,
    ...overrides,
  }
}

function future(overrides: Partial<FuturePaymentVo> = {}): FuturePaymentVo {
  return { month: '2026-11', byCurrency: [{ currency: 'CNY', amount: 500 }], ...overrides }
}

function dimension(overrides: Partial<DimensionStatVo> = {}): DimensionStatVo {
  return {
    key: 'pvc',
    label: 'PVC',
    amount: [{ currency: 'CNY', amount: 1000 }],
    orderCount: 1,
    itemCount: 2,
    ...overrides,
  }
}

function mountPage() {
  return mount(StatisticsPage, {
    global: {
      stubs: {
        ...elementStubs,
        AppChart: { name: 'AppChart', props: ['option', 'height'], template: '<div class="app-chart-stub" />' },
      },
      plugins: [
        createPinia(),
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
  })
}

describe('统计 Statistics', () => {
  beforeEach(() => {
    routerMock.push.mockReset()
    mockedMonthly.mockReset()
    mockedFuture.mockReset()
    mockedDimension.mockReset()
    mockedCollectionStats.mockReset()

    const year = new Date().getFullYear()
    mockedMonthly.mockImplementation(params =>
      Promise.resolve(
        params.from === '2000-01-01'
          ? [
              monthly({ month: `${year}-01`, currency: 'CNY', netPaidAmount: 1000, orderAmount: 1800 }),
              monthly({ month: `${year - 1}-12`, currency: 'CNY', netPaidAmount: 300, orderAmount: 400 }),
              monthly({ month: `${year}-02`, currency: 'JPY', netPaidAmount: 20000, orderAmount: 30000 }),
            ]
          : [],
      ),
    )
    mockedFuture.mockResolvedValue([future()])
    mockedDimension.mockResolvedValue([dimension()])
    mockedCollectionStats.mockResolvedValue({
      totalItems: 4,
      deliveredOrders: 2,
      byCurrency: [{ currency: 'CNY', amount: 1299 }],
    })
  })

  it('时间区间查询不传 currency（多币种分组返回）', async () => {
    mountPage()
    await flushPromises()
    expect(mockedMonthly).toHaveBeenCalledWith({ from: '2000-01-01', to: expect.any(String) })
    expect(mockedFuture).toHaveBeenCalledWith({ months: 12 })
    expect(mockedDimension.mock.calls.map(call => call[0])).toEqual([
      'categories',
      'platforms',
      'manufacturers',
      'ips',
    ])
  })

  it('KPI 展示累计消费 / 今年消费 / 未来待付款 / 收藏数量（多币种分行）', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('累计消费')
    expect(text).toContain('¥1,300')
    expect(text).toContain(`${new Date().getFullYear()} 年消费`)
    expect(text).toContain('¥1,000')
    expect(text).toContain('未来待付款')
    const collectionCard = wrapper.findAll('.dashboard-kpi-card')[3]
    expect(collectionCard?.text()).toContain('收藏数量')
    expect(collectionCard?.text()).toContain('4')
  })

  it('KPI 点击跳转待付款订单与收藏库', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.findAll('.dashboard-kpi-card')[2]?.trigger('click')
    await wrapper.findAll('.dashboard-kpi-card')[3]?.trigger('click')
    expect(routerMock.push.mock.calls).toEqual([['/orders?tab=WAITING_PAYMENT'], ['/collection']])
  })

  it('三个维度图表与 IP 排行都渲染', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.findAll('.app-chart-stub').length).toBeGreaterThanOrEqual(4)
    expect(wrapper.text()).toContain('付款趋势（近 12 个月）')
    expect(wrapper.find('.ip-ranking').exists()).toBe(true)
    expect(wrapper.text()).toContain('IP 排行')
  })

  it('IP 数据为空时显示空状态', async () => {
    mockedDimension.mockImplementation(dimensionKey =>
      Promise.resolve(dimensionKey === 'ips' ? [] : [dimension()]),
    )
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('区间内没有 IP 数据')
  })

  it('任一查询失败时展示错误态并可重试', async () => {
    mockedFuture.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.findComponent(AppErrorState).exists()).toBe(true)
    const before = mockedFuture.mock.calls.length
    wrapper.findComponent(AppErrorState).vm.$emit('retry')
    await flushPromises()
    expect(mockedFuture.mock.calls.length).toBeGreaterThan(before)
  })
})
