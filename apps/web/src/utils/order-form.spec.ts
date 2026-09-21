import { describe, expect, it } from 'vitest'
import type { PaymentFormItem } from '@/types/forms'
import type { OrderDetail } from '@/types/models'
import {
  applyDepositChange,
  calcGoodsAmount,
  calcTotalAmount,
  defaultPaymentItemsFor,
  defaultPaymentsFor,
  toOrderFormModel,
} from './order-form'

describe('calcGoodsAmount', () => {
  it('按单价 × 数量求和并保留两位', () => {
    expect(calcGoodsAmount([{ unitPrice: 649.5, quantity: 2 }])).toBe(1299)
  })
})

describe('calcTotalAmount', () => {
  it('商品金额 - 优惠 + 运费 + 税费 + 其他', () => {
    expect(
      calcTotalAmount({ goodsAmount: 1299, discountAmount: 100, shippingAmount: 20, taxAmount: 0, extraAmount: 0 }),
    ).toBe(1219)
  })
})

describe('defaultPaymentsFor', () => {
  it('FULL → 单节点全款', () => {
    expect(defaultPaymentsFor('FULL', 1299)).toEqual([{ type: 'FULL', amount: 1299, status: 'PENDING' }])
  })

  it('DEPOSIT_BALANCE → 定金 + 尾款，尾款默认等于总额', () => {
    expect(defaultPaymentsFor('DEPOSIT_BALANCE', 1299)).toEqual([
      { type: 'DEPOSIT', amount: 0, status: 'PENDING' },
      { type: 'BALANCE', amount: 1299, status: 'PENDING' },
    ])
  })

  it('INSTALLMENT → 单个阶段款节点（后续由用户增删）', () => {
    expect(defaultPaymentsFor('INSTALLMENT', 4280)).toEqual([
      { type: 'INSTALLMENT', amount: 4280, status: 'PENDING' },
    ])
  })

  it('非法模式 → 空数组', () => {
    expect(defaultPaymentsFor('NOPE', 100)).toEqual([])
  })
})

describe('calcGoodsAmount 边界值', () => {
  it('空数组为 0', () => {
    expect(calcGoodsAmount([])).toBe(0)
  })

  it('数量为 0 或单价为 0 不产生金额', () => {
    expect(calcGoodsAmount([{ unitPrice: 649.5, quantity: 0 }])).toBe(0)
    expect(calcGoodsAmount([{ unitPrice: 0, quantity: 3 }])).toBe(0)
  })

  it('浮点累加后保留两位，避免 0.30000000000000004', () => {
    expect(calcGoodsAmount([{ unitPrice: 0.1, quantity: 3 }])).toBe(0.3)
  })

  it('负数单价（退款行）参与求和', () => {
    expect(calcGoodsAmount([{ unitPrice: 100, quantity: 1 }, { unitPrice: -20, quantity: 1 }])).toBe(80)
  })
})

describe('calcTotalAmount 边界值', () => {
  it('全零得 0', () => {
    expect(
      calcTotalAmount({ goodsAmount: 0, discountAmount: 0, shippingAmount: 0, taxAmount: 0, extraAmount: 0 }),
    ).toBe(0)
  })

  it('优惠大于商品金额时可为负', () => {
    expect(
      calcTotalAmount({ goodsAmount: 100, discountAmount: 150, shippingAmount: 0, taxAmount: 0, extraAmount: 0 }),
    ).toBe(-50)
  })
})

describe('defaultPaymentsFor 边界值', () => {
  it('CUSTOM → OTHER 类型节点', () => {
    expect(defaultPaymentsFor('CUSTOM', 888)).toEqual([{ type: 'OTHER', amount: 888, status: 'PENDING' }])
  })

  it('总额为 0 时节点金额为 0', () => {
    expect(defaultPaymentsFor('FULL', 0)).toEqual([{ type: 'FULL', amount: 0, status: 'PENDING' }])
  })

  it('空字符串模式 → 空数组', () => {
    expect(defaultPaymentsFor('', 100)).toEqual([])
  })
})

function createOrderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'o1',
    orderNo: 'A-1',
    orderedAt: '2026-01-02',
    currency: 'CNY',
    totalAmount: 1299,
    paymentMode: 'DEPOSIT_BALANCE',
    status: 'ACTIVE',
    archived: false,
    platformId: 'pf1',
    platformName: '官方',
    storeId: 'st1',
    storeName: '旗舰店',
    itemCount: 1,
    productSummaries: [{ productId: 'p1', name: '芙宁娜 1/7', coverUrl: null }],
    displayStatus: 'WAITING_RELEASE',
    displayStatusLabel: '等待出货',
    displayStatusHint: null,
    paymentSummary: {
      status: 'PARTIALLY_PAID',
      paidAmount: 300,
      pendingAmount: 999,
      refundAmount: 0,
      netPaidAmount: 300,
      progress: 23,
      nextPayment: {
        id: 'pay2',
        type: 'BALANCE',
        name: null,
        amount: 999,
        dueAt: '2027-05-01',
        isOverdue: false,
        overdueDays: 0,
      },
    },
    releaseSummary: { status: 'DELAYED', plannedDate: '2027-09-01', precision: 'MONTH', delayMonths: 4 },
    shipmentSummary: { status: null, carrier: null, trackingNo: null, inTransitCount: 0, total: 0 },
    updatedAt: '2026-02-01T00:00:00.000Z',
    orderUrl: 'https://example.com/o1',
    goodsAmount: 1299,
    discountAmount: 100,
    shippingAmount: 20,
    taxAmount: 0,
    extraAmount: 0,
    note: '备注',
    createdAt: '2026-01-02T00:00:00.000Z',
    items: [
      {
        id: 'i1',
        productId: 'p1',
        productName: '芙宁娜 1/7',
        coverUrl: null,
        quantity: 1,
        unitPrice: 1299,
        subtotal: 1299,
        note: null,
      },
    ],
    payments: [
      {
        id: 'pay1',
        type: 'DEPOSIT',
        name: '定金',
        amount: 300,
        currency: 'CNY',
        status: 'PAID',
        isOverdue: false,
        expectedAt: null,
        dueAt: '2026-01-02',
        paidAt: '2026-01-02T00:00:00.000Z',
        paymentMethod: '支付宝',
        transactionNo: null,
        note: null,
        sortOrder: 0,
      },
      {
        id: 'pay2',
        type: 'BALANCE',
        name: null,
        amount: null,
        currency: 'CNY',
        status: 'PENDING',
        isOverdue: false,
        expectedAt: null,
        dueAt: '2027-05-01',
        paidAt: null,
        paymentMethod: null,
        transactionNo: null,
        note: null,
        sortOrder: 1,
      },
    ],
    releaseEvents: [
      {
        id: 'e1',
        type: 'EXPECTED_RELEASE',
        label: '预计出货',
        oldDate: null,
        newDate: '2027-05-01',
        datePrecision: 'MONTH',
        occurredAt: '2026-01-02T00:00:00.000Z',
        source: null,
        sourceUrl: null,
        note: null,
      },
      {
        id: 'e2',
        type: 'DELAY',
        label: '延期',
        oldDate: '2027-05-01',
        newDate: '2027-09-01',
        datePrecision: 'MONTH',
        occurredAt: '2026-03-02T00:00:00.000Z',
        source: '官方',
        sourceUrl: null,
        note: null,
      },
    ],
    shipments: [],
    attachments: [],
    orderEvents: [],
    timeline: [],
    ...overrides,
  }
}

describe('defaultPaymentItemsFor', () => {
  it('FULL → 单节点全款，金额取总额', () => {
    expect(defaultPaymentItemsFor('FULL', 1299)).toEqual([{ type: 'FULL', amount: 1299, status: 'PENDING' }])
  })

  it('金额待定的节点保留 null', () => {
    expect(defaultPaymentItemsFor('FULL', 0)).toEqual([{ type: 'FULL', amount: 0, status: 'PENDING' }])
  })

  it('非法模式 → 空数组', () => {
    expect(defaultPaymentItemsFor('NOPE', 100)).toEqual([])
  })
})

describe('applyDepositChange', () => {
  const payments: PaymentFormItem[] = [
    { type: 'DEPOSIT', amount: 300, status: 'PENDING' },
    { type: 'BALANCE', amount: 999, status: 'PENDING' },
  ]

  it('改定金后尾款自动 = 总额 - 定金', () => {
    const next = applyDepositChange(payments, 0, 1299)
    expect(next[0]?.amount).toBe(300)
    expect(next[1]?.amount).toBe(999)
  })

  it('定金变化后重算尾款', () => {
    const changed = [{ ...payments[0]!, amount: 500 }, payments[1]!]
    const next = applyDepositChange(changed, 0, 1299)
    expect(next[1]?.amount).toBe(799)
  })

  it('手改尾款时不重算', () => {
    const changed = [payments[0]!, { ...payments[1]!, amount: 500 }]
    expect(applyDepositChange(changed, 1, 1299)).toEqual(changed)
  })

  it('金额待定的尾款不被覆盖', () => {
    const changed = [{ ...payments[0]!, amount: 100 }, { type: 'BALANCE', amount: null, status: 'PENDING' as const }]
    expect(applyDepositChange(changed, 0, 1299)[1]?.amount).toBeNull()
  })

  it('没有尾款节点时原样返回', () => {
    const single: PaymentFormItem[] = [{ type: 'DEPOSIT', amount: 100, status: 'PENDING' }]
    expect(applyDepositChange(single, 0, 1299)).toEqual(single)
  })

  it('索引越界时原样返回', () => {
    expect(applyDepositChange(payments, 9, 1299)).toEqual(payments)
  })
})

describe('toOrderFormModel', () => {
  it('映射基础字段并截断下单日期', () => {
    const model = toOrderFormModel(createOrderDetail())
    expect(model.platformId).toBe('pf1')
    expect(model.storeId).toBe('st1')
    expect(model.orderNo).toBe('A-1')
    expect(model.orderUrl).toBe('https://example.com/o1')
    expect(model.orderedAt).toBe('2026-01-02')
    expect(model.currency).toBe('CNY')
    expect(model.note).toBe('备注')
    expect(model.items).toEqual([
      { productId: 'p1', name: '芙宁娜 1/7', coverUrl: null, quantity: 1, unitPrice: 1299 },
    ])
  })

  it('商品金额与商品行一致时判定为自动计算', () => {
    expect(toOrderFormModel(createOrderDetail()).autoCalculateGoodsAmount).toBe(true)
    expect(
      toOrderFormModel(createOrderDetail({ goodsAmount: 1000, totalAmount: 920 })).autoCalculateGoodsAmount,
    ).toBe(false)
  })

  it('付款节点保留金额待定与已付状态', () => {
    const model = toOrderFormModel(createOrderDetail())
    expect(model.paymentMode).toBe('DEPOSIT_BALANCE')
    expect(model.payments).toEqual([
      {
        type: 'DEPOSIT',
        name: '定金',
        amount: 300,
        status: 'PAID',
        expectedAt: undefined,
        dueAt: '2026-01-02',
        paidAt: '2026-01-02T00:00:00.000Z',
        paymentMethod: '支付宝',
        note: undefined,
      },
      {
        type: 'BALANCE',
        name: undefined,
        amount: null,
        status: 'PENDING',
        expectedAt: undefined,
        dueAt: '2027-05-01',
        paidAt: undefined,
        paymentMethod: undefined,
        note: undefined,
      },
    ])
  })

  it('预计出货取最近一次记录并按精度截断', () => {
    const model = toOrderFormModel(createOrderDetail())
    expect(model.useExpectedRelease).toBe(true)
    expect(model.releaseDate).toBe('2027-09')
    expect(model.releaseDatePrecision).toBe('MONTH')
  })

  it('DAY 精度保留到日', () => {
    const detail = createOrderDetail()
    const model = toOrderFormModel({
      ...detail,
      releaseEvents: [{ ...detail.releaseEvents[0]!, datePrecision: 'DAY' }],
    })
    expect(model.releaseDate).toBe('2027-05-01')
    expect(model.releaseDatePrecision).toBe('DAY')
  })

  it('没有预计出货记录时不开启开关', () => {
    const model = toOrderFormModel(createOrderDetail({ releaseEvents: [] }))
    expect(model.useExpectedRelease).toBe(false)
    expect(model.releaseDate).toBe('')
  })
})
