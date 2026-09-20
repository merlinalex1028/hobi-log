import type { OrderDomain, PaymentLike, ReleaseEventLike, ShipmentLike } from './types'
import { getDisplayStatus, getDisplayStatusHint, getDisplayStatusLabel } from './display-status'

const TODAY = '2027-03-20'

const fullPaid: PaymentLike = {
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
const depositPaid: PaymentLike = { ...fullPaid, id: 'p2', type: 'DEPOSIT', amount: 300 }
const balancePending: PaymentLike = {
  ...fullPaid,
  id: 'p3',
  type: 'BALANCE',
  amount: 999,
  status: 'PENDING',
  paidAt: null,
}
const balanceOverdue: PaymentLike = { ...balancePending, dueAt: '2027-03-01' }

const release = (type: string, newDate: string | null): ReleaseEventLike => ({
  id: `r-${type}`,
  type,
  oldDate: null,
  newDate,
  datePrecision: 'MONTH',
  occurredAt: '2026-09-18T00:00:00.000Z',
})

const shipment = (status: ShipmentLike['status']): ShipmentLike => ({
  id: `s-${status}`,
  status,
  carrier: '顺丰',
  trackingNo: 'SF1',
  shippedAt: '2027-05-18T00:00:00.000Z',
  estimatedDeliveryAt: null,
  deliveredAt: null,
})

const order = (patch: Partial<OrderDomain>): OrderDomain => ({
  id: 'o1',
  status: 'ACTIVE',
  archived: false,
  currency: 'CNY',
  totalAmount: 1299,
  payments: [fullPaid],
  releaseEvents: [],
  shipments: [],
  ...patch,
})

describe('getDisplayStatus 验收场景（docs/07 §96）', () => {
  it.each([
    ['A 全款现货：FULL PAID + DELIVERED', order({ shipments: [shipment('DELIVERED')] }), 'COMPLETED'],
    [
      'B 全款预售：FULL PAID + EXPECTED_RELEASE',
      order({ releaseEvents: [release('EXPECTED_RELEASE', '2027-05-01')] }),
      'WAITING_RELEASE',
    ],
    [
      'C 定金尾款：DEPOSIT PAID + BALANCE PENDING',
      order({ payments: [depositPaid, balancePending] }),
      'WAITING_PAYMENT',
    ],
    ['D 尾款逾期', order({ payments: [depositPaid, balanceOverdue] }), 'PAYMENT_OVERDUE'],
    [
      'F 厂商出货无物流',
      order({ releaseEvents: [release('RELEASED', '2027-05-16')] }),
      'WAITING_SHIPMENT',
    ],
    [
      'G 运输中',
      order({ releaseEvents: [release('RELEASED', '2027-05-16')], shipments: [shipment('IN_TRANSIT')] }),
      'IN_TRANSIT',
    ],
    ['H 物流异常', order({ shipments: [shipment('EXCEPTION')] }), 'SHIPMENT_EXCEPTION'],
    [
      'I 多包裹 1 DELIVERED + 1 IN_TRANSIT',
      order({ shipments: [shipment('DELIVERED'), shipment('IN_TRANSIT')] }),
      'IN_TRANSIT',
    ],
    ['J 全部签收', order({ shipments: [shipment('DELIVERED')] }), 'COMPLETED'],
    ['K 订单取消', order({ status: 'CANCELLED' }), 'CANCELLED'],
    ['L 退款结束', order({ status: 'REFUNDED' }), 'REFUNDED'],
    ['已付清未记录出货', order({}), 'WAITING_RELEASE'],
  ])('%s → %s', (_name, value, expected) => {
    expect(getDisplayStatus(value, TODAY)).toBe(expected)
  })

  it('E 延期 → WAITING_RELEASE 且标签体现延期', () => {
    const delayed = order({
      releaseEvents: [
        release('EXPECTED_RELEASE', '2027-01-01'),
        { ...release('DELAY', '2027-05-01'), oldDate: '2027-01-01' },
      ],
    })
    expect(getDisplayStatus(delayed, TODAY)).toBe('WAITING_RELEASE')
    expect(getDisplayStatusLabel(delayed, TODAY)).toBe('延期 · 等待出货')
  })

  it('付款优先于出货：已 RELEASED 但尾款次日截止 → WAITING_PAYMENT', () => {
    expect(
      getDisplayStatus(
        order({
          payments: [depositPaid, { ...balancePending, dueAt: '2027-03-21' }],
          releaseEvents: [release('RELEASED', '2027-05-16')],
        }),
        TODAY,
      ),
    ).toBe('WAITING_PAYMENT')
  })

  it('金额待定（amount = null）仍显示 WAITING_PAYMENT', () => {
    expect(
      getDisplayStatus(
        order({
          payments: [
            fullPaid,
            { ...balancePending, id: 'p4', type: 'SHIPPING', amount: null, dueAt: null },
          ],
        }),
        TODAY,
      ),
    ).toBe('WAITING_PAYMENT')
  })

  it('已被物流发出但仍有待付款 → WAITING_PAYMENT（付款优先）', () => {
    expect(
      getDisplayStatus(
        order({ payments: [depositPaid, balancePending], shipments: [shipment('IN_TRANSIT')] }),
        TODAY,
      ),
    ).toBe('WAITING_PAYMENT')
  })
})

describe('getDisplayStatusLabel', () => {
  const nextPaymentCases: Array<[string, PaymentLike[], string]> = [
    ['BALANCE', [depositPaid, balancePending], '待补尾款'],
    ['DEPOSIT', [{ ...fullPaid, type: 'DEPOSIT', status: 'PENDING', paidAt: null }], '待付定金'],
    ['SHIPPING', [fullPaid, { ...balancePending, type: 'SHIPPING', amount: null }], '待补邮'],
  ]

  it.each(nextPaymentCases)('待付款按下一节点类型细化：%s', (_type, payments, expected) => {
    expect(getDisplayStatusLabel(order({ payments }), TODAY)).toBe(expected)
  })

  it('逾期标签带“已逾期”', () => {
    expect(getDisplayStatusLabel(order({ payments: [depositPaid, balanceOverdue] }), TODAY)).toBe(
      '待补尾款 · 已逾期',
    )
  })

  it('已签收用“已签收”文案', () => {
    expect(getDisplayStatusLabel(order({ shipments: [shipment('DELIVERED')] }), TODAY)).toBe('已签收')
  })
})

describe('getDisplayStatusHint', () => {
  it('逾期提示天数', () => {
    expect(getDisplayStatusHint(order({ payments: [depositPaid, balanceOverdue] }), TODAY)).toBe(
      '已逾期 19 天',
    )
  })

  it('待付款提示截止日', () => {
    expect(getDisplayStatusHint(order({ payments: [depositPaid, balancePending] }), TODAY)).toBeNull()
    expect(
      getDisplayStatusHint(
        order({ payments: [depositPaid, { ...balancePending, dueAt: '2027-03-27' }] }),
        TODAY,
      ),
    ).toBe('2027-03-27 截止')
  })

  it('无截止日提示“暂无截止日期”', () => {
    expect(
      getDisplayStatusHint(
        order({
          payments: [
            { ...fullPaid, type: 'SHIPPING', amount: null, status: 'PENDING', paidAt: null },
          ],
        }),
        TODAY,
      ),
    ).toBe('暂无截止日期')
  })

  it('运输中提示包裹数', () => {
    expect(
      getDisplayStatusHint(order({ shipments: [shipment('IN_TRANSIT'), shipment('IN_TRANSIT')] }), TODAY),
    ).toBe('2 个包裹运输中')
  })

  it('等待出货提示预计月份', () => {
    expect(
      getDisplayStatusHint(order({ releaseEvents: [release('EXPECTED_RELEASE', '2027-05-01')] }), TODAY),
    ).toBe('预计 2027年05月')
  })
})
