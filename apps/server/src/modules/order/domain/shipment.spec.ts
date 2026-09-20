import type { OrderDomain, PaymentLike, ShipmentLike } from './types'
import {
  countInTransit,
  getShipmentSummaryStatus,
  hasShippedShipment,
  isOrderCompleted,
} from './shipment'

const shipment = (patch: Partial<ShipmentLike>): ShipmentLike => ({
  id: 'sh1',
  status: 'WAITING',
  carrier: null,
  trackingNo: null,
  shippedAt: null,
  estimatedDeliveryAt: null,
  deliveredAt: null,
  ...patch,
})

const paidFull: PaymentLike = {
  id: 'p1',
  type: 'FULL',
  name: null,
  amount: 1299,
  status: 'PAID',
  expectedAt: null,
  dueAt: null,
  paidAt: '2026-09-18T00:00:00.000Z',
  sortOrder: 0,
}

const base: OrderDomain = {
  id: 'o1',
  status: 'ACTIVE',
  archived: false,
  currency: 'CNY',
  totalAmount: 1299,
  payments: [paidFull],
  releaseEvents: [],
  shipments: [],
}

describe('getShipmentSummaryStatus', () => {
  it('无物流 → null', () => {
    expect(getShipmentSummaryStatus([])).toBeNull()
  })
  it('EXCEPTION 优先于 IN_TRANSIT', () => {
    expect(
      getShipmentSummaryStatus([
        shipment({ id: 'a', status: 'IN_TRANSIT' }),
        shipment({ id: 'b', status: 'EXCEPTION' }),
      ]),
    ).toBe('EXCEPTION')
  })
  it('I 场景：1 DELIVERED + 1 IN_TRANSIT → IN_TRANSIT', () => {
    expect(
      getShipmentSummaryStatus([
        shipment({ id: 'a', status: 'DELIVERED', deliveredAt: '2027-05-21T00:00:00.000Z' }),
        shipment({ id: 'b', status: 'IN_TRANSIT' }),
      ]),
    ).toBe('IN_TRANSIT')
  })
  it('全部 DELIVERED → DELIVERED', () => {
    expect(getShipmentSummaryStatus([shipment({ status: 'DELIVERED' })])).toBe('DELIVERED')
  })
})

describe('hasShippedShipment', () => {
  it('仅 WAITING 不算已发出', () => {
    expect(hasShippedShipment([shipment({ status: 'WAITING' })])).toBe(false)
  })
  it.each(['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'] as const)('%s 算已发出', status => {
    expect(hasShippedShipment([shipment({ status })])).toBe(true)
  })
})

describe('countInTransit', () => {
  it('统计 SHIPPED + IN_TRANSIT 包裹数', () => {
    expect(
      countInTransit([
        shipment({ id: 'a', status: 'SHIPPED' }),
        shipment({ id: 'b', status: 'IN_TRANSIT' }),
        shipment({ id: 'c', status: 'DELIVERED' }),
      ]),
    ).toBe(2)
  })
})

describe('isOrderCompleted', () => {
  it('无物流 → false（线下自提需手动标记完成）', () => {
    expect(isOrderCompleted(base, '2027-01-01')).toBe(false)
  })
  it('有未付节点 → false', () => {
    expect(
      isOrderCompleted(
        {
          ...base,
          payments: [
            ...base.payments,
            {
              ...paidFull,
              id: 'p2',
              type: 'SHIPPING',
              amount: null,
              status: 'PENDING',
              paidAt: null,
            },
          ],
          shipments: [shipment({ status: 'DELIVERED' })],
        },
        '2027-01-01',
      ),
    ).toBe(false)
  })
  it('J 场景：全部签收且无待付款 → true', () => {
    expect(
      isOrderCompleted({ ...base, shipments: [shipment({ status: 'DELIVERED' })] }, '2027-01-01'),
    ).toBe(true)
  })
  it('逾期节点存在时不算完成', () => {
    expect(
      isOrderCompleted(
        {
          ...base,
          payments: [
            ...base.payments,
            {
              ...paidFull,
              id: 'p3',
              type: 'BALANCE',
              status: 'PENDING',
              dueAt: '2027-03-01',
              paidAt: null,
            },
          ],
          shipments: [shipment({ status: 'DELIVERED' })],
        },
        '2027-03-20',
      ),
    ).toBe(false)
  })
  it('CANCELLED 付款节点不影响完成判定', () => {
    expect(
      isOrderCompleted(
        {
          ...base,
          payments: [...base.payments, { ...paidFull, id: 'p4', status: 'CANCELLED', paidAt: null }],
          shipments: [shipment({ status: 'DELIVERED' })],
        },
        '2027-01-01',
      ),
    ).toBe(true)
  })
})
