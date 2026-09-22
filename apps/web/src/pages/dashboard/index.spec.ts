import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from './index.vue'
import { getDashboard } from '@/api/statistics.api'
import AppErrorState from '@/components/common/AppErrorState.vue'
import type { DashboardVo } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerMock.push }) }))
vi.mock('@/api/statistics.api', () => ({ getDashboard: vi.fn() }))

const mockedDashboard = vi.mocked(getDashboard)

function dashboard(overrides: Partial<DashboardVo> = {}): DashboardVo {
  return {
    kpis: {
      pendingPaymentAmount: [{ currency: 'CNY', amount: 500 }],
      upcomingPaymentAmount: [{ currency: 'CNY', amount: 300 }],
      monthReleaseCount: 1,
      inTransitOrderCount: 2,
      collectionCount: 3,
      totalOrderCount: 5,
    },
    todos: [
      {
        orderId: 'o1',
        displayStatus: 'WAITING_PAYMENT',
        displayStatusLabel: '待付款',
        displayStatusHint: '尾款 500',
        title: '芙宁娜 1/7 手办',
        amount: 500,
        currency: 'CNY',
        dueAt: '2026-11-20',
        overdueDays: 0,
        priority: 3,
      },
    ],
    futurePayments: [{ month: '2026-11', byCurrency: [{ currency: 'CNY', amount: 500 }] }],
    upcomingReleases: [{ orderId: 'o2', title: '雷电将军', plannedDate: '2027-05-01', precision: 'MONTH', delayMonths: 1 }],
    shipping: [{ orderId: 'o3', title: '钟离', carrier: 'EMS', trackingNo: 'E123', status: 'IN_TRANSIT' }],
    recentOrders: [
      { id: 'o4', orderedAt: '2026-09-10', displayStatus: 'COMPLETED', displayStatusLabel: '已完成', totalAmount: 1299, currency: 'CNY' },
    ],
    ...overrides,
  }
}

function mountPage() {
  return mount(DashboardPage, {
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

describe('首页 Dashboard', () => {
  beforeEach(() => {
    routerMock.push.mockReset()
    mockedDashboard.mockReset()
    mockedDashboard.mockResolvedValue(dashboard())
  })

  it('加载 dashboard 数据', async () => {
    mountPage()
    await flushPromises()
    expect(mockedDashboard).toHaveBeenCalledTimes(1)
  })

  it('渲染 KPI、待办与各面板', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('待付款')
    expect(wrapper.text()).toContain('¥500')
    expect(wrapper.text()).toContain('芙宁娜 1/7 手办')
    expect(wrapper.text()).toContain('尾款 500')
    expect(wrapper.text()).toContain('雷电将军')
    expect(wrapper.text()).toContain('延期 1 个月')
    expect(wrapper.text()).toContain('EMS')
    expect(wrapper.text()).toContain('E123')
    expect(wrapper.text()).toContain('2026-09-10')
  })

  it('待办点击跳转订单详情', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.find('.todo-panel__item').trigger('click')
    expect(routerMock.push).toHaveBeenCalledWith('/orders/o1')
  })

  it('未来付款图表拿到按月数据', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('.app-chart-stub').exists()).toBe(true)
  })

  it('接口失败时显示错误态并可重试', async () => {
    mockedDashboard.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.findComponent(AppErrorState).exists()).toBe(true)
    const before = mockedDashboard.mock.calls.length
    wrapper.findComponent(AppErrorState).vm.$emit('retry')
    await flushPromises()
    expect(mockedDashboard.mock.calls.length).toBeGreaterThan(before)
  })
})
