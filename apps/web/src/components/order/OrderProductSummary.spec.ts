import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OrderProductSummary from './OrderProductSummary.vue'
import type { OrderListItem } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

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
    platformId: null,
    platformName: null,
    storeId: null,
    storeName: null,
    itemCount: 2,
    productSummaries: [{ productId: 'p1', name: '芙宁娜 1/7 手办', coverUrl: 'https://example.com/a.png' }],
    displayStatus: 'PAYMENT_OVERDUE',
    displayStatusLabel: '付款逾期',
    displayStatusHint: '定金已逾期 12 天',
    paymentSummary: {
      status: 'OVERDUE',
      paidAmount: 0,
      pendingAmount: 1299,
      refundAmount: 0,
      netPaidAmount: 0,
      progress: 0,
      nextPayment: null,
    },
    releaseSummary: { status: 'UNKNOWN', plannedDate: null, precision: null, delayMonths: 0 },
    shipmentSummary: { status: null, carrier: null, trackingNo: null, inTransitCount: 0, total: 0 },
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('OrderProductSummary', () => {
  it('展示商品名、件数与行内状态标签', () => {
    const wrapper = mount(OrderProductSummary, { props: { order: createOrder() }, global: { stubs: elementStubs } })
    expect(wrapper.text()).toContain('芙宁娜 1/7 手办')
    expect(wrapper.text()).toContain('共 2 件')
    expect(wrapper.text()).toContain('付款逾期')
  })

  it('多商品时展示商品数', () => {
    const wrapper = mount(OrderProductSummary, {
      props: {
        order: createOrder({
          itemCount: 3,
          productSummaries: [
            { productId: 'p1', name: 'A', coverUrl: null },
            { productId: 'p2', name: 'B', coverUrl: null },
          ],
        }),
      },
      global: { stubs: elementStubs },
    })
    expect(wrapper.text()).toContain('2 个商品')
  })

  it('没有商品摘要时回退占位标题', () => {
    const wrapper = mount(OrderProductSummary, {
      props: { order: createOrder({ productSummaries: [], itemCount: 0 }) },
      global: { stubs: elementStubs },
    })
    expect(wrapper.text()).toContain('未命名商品')
  })
})
