import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrdersPage from './index.vue'
import { getOrderList } from '@/api/order.api'
import { getPlatformList } from '@/api/platform.api'
import { getStoreList } from '@/api/store.api'
import type { OrderListItem } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

const routerMock = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routerMock.query, params: {} }),
  useRouter: () => ({ push: routerMock.push, replace: routerMock.replace, back: routerMock.back }),
}))
vi.mock('@/api/order.api', () => ({ getOrderList: vi.fn() }))
vi.mock('@/api/platform.api', () => ({ getPlatformList: vi.fn() }))
vi.mock('@/api/store.api', () => ({ getStoreList: vi.fn(), createStore: vi.fn() }))

const mockedList = vi.mocked(getOrderList)
const mockedPlatforms = vi.mocked(getPlatformList)
const mockedStores = vi.mocked(getStoreList)

function createOrder(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'o1',
    orderNo: 'A-1',
    orderedAt: '2026-01-02',
    currency: 'CNY',
    totalAmount: 1299,
    paymentMode: 'FULL',
    status: 'ACTIVE',
    archived: false,
    platformId: 'pf1',
    platformName: '官方',
    storeId: 'st1',
    storeName: '旗舰店',
    itemCount: 1,
    productSummaries: [{ productId: 'p1', name: '芙宁娜 1/7 手办', coverUrl: null }],
    displayStatus: 'WAITING_RELEASE',
    displayStatusLabel: '等待出货',
    displayStatusHint: null,
    paymentSummary: {
      status: 'UNPAID',
      paidAmount: 0,
      pendingAmount: 1299,
      refundAmount: 0,
      netPaidAmount: 0,
      progress: 0,
      nextPayment: null,
    },
    releaseSummary: { status: 'WAITING_RELEASE', plannedDate: '2027-05-01', precision: 'MONTH', delayMonths: 0 },
    shipmentSummary: { status: null, carrier: null, trackingNo: null, inTransitCount: 0, total: 0 },
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

function mountPage() {
  return mount(OrdersPage, {
    global: {
      stubs: {
        ...elementStubs,
        OrderTable: {
          name: 'OrderTable',
          props: ['items'],
          template: '<div class="order-table-stub">{{ items.length }}</div>',
        },
        OrderGrid: {
          name: 'OrderGrid',
          props: ['items'],
          template: '<div class="order-grid-stub">{{ items.length }}</div>',
        },
      },
      plugins: [
        createPinia(),
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
  })
}

describe('订单列表页', () => {
  beforeEach(() => {
    routerMock.query = {}
    routerMock.push.mockReset()
    routerMock.replace.mockReset()
    mockedList.mockReset()
    mockedList.mockResolvedValue({ items: [createOrder()], total: 1, page: 1, pageSize: 20 })
    mockedPlatforms.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 })
    mockedStores.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 })
  })

  it('按默认筛选（全部 / 第 1 页）请求订单列表', async () => {
    mountPage()
    await flushPromises()
    expect(mockedList).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'ALL', page: 1, pageSize: 20, keyword: undefined }),
    )
  })

  it('URL 上的筛选条件会映射成请求参数', async () => {
    routerMock.query = {
      tab: 'WAITING_PAYMENT',
      paymentSummaryStatus: 'UNPAID',
      platformId: 'pf1',
      storeId: 'st1',
      year: '2026',
      delayed: 'true',
      page: '2',
      pageSize: '10',
    }
    mountPage()
    await flushPromises()
    expect(mockedList).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: 'WAITING_PAYMENT',
        paymentSummaryStatus: 'UNPAID',
        platformId: 'pf1',
        storeId: 'st1',
        year: 2026,
        delayed: true,
        page: 2,
        pageSize: 10,
      }),
    )
  })

  it('展示总数，空数据时显示空状态', async () => {
    mockedList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('共 0 条')
    expect(wrapper.text()).toContain('还没有任何订单')
  })

  it('有数据时把 items 交给表格视图渲染', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('共 1 条')
    expect(wrapper.find('.order-table-stub').text()).toBe('1')
    expect(wrapper.find('.order-grid-stub').exists()).toBe(false)
  })
})
