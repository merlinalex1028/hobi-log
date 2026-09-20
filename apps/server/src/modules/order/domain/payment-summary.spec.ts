import type { PaymentLike } from './types'
import {
  getNetPaidAmount,
  getNextPayment,
  getNextPaymentLabel,
  getPaidAmount,
  getPaymentProgress,
  getPaymentSummaryStatus,
  getPendingAmount,
  getRefundAmount,
  isOverdue,
} from './payment-summary'

const TODAY = '2027-03-20'

const payment = (patch: Partial<PaymentLike>): PaymentLike => ({
  id: 'pay',
  type: 'BALANCE',
  name: null,
  amount: 999,
  status: 'PENDING',
  expectedAt: null,
  dueAt: null,
  paidAt: null,
  sortOrder: 0,
  ...patch,
})

describe('isOverdue', () => {
  it('PENDING 且 dueAt 早于今天 → true', () => {
    expect(isOverdue(payment({ dueAt: '2027-03-19' }), TODAY)).toBe(true)
  })
  it('当天不算逾期', () => {
    expect(isOverdue(payment({ dueAt: TODAY }), TODAY)).toBe(false)
  })
  it('无 dueAt 不算逾期', () => {
    expect(isOverdue(payment({ dueAt: null }), TODAY)).toBe(false)
  })
  it('已付款不算逾期', () => {
    expect(isOverdue(payment({ status: 'PAID', dueAt: '2020-01-01' }), TODAY)).toBe(false)
  })
})

describe('金额汇总', () => {
  const payments = [
    payment({ id: 'd', type: 'DEPOSIT', amount: 300, status: 'PAID' }),
    payment({ id: 'b', amount: 999, dueAt: '2027-03-27' }),
    payment({ id: 's', type: 'SHIPPING', amount: null }),
    payment({ id: 'r', type: 'REFUND', amount: 300, status: 'PAID' }),
    payment({ id: 'c', amount: 100, status: 'CANCELLED' }),
  ]

  it('已支付 = PAID 且非 REFUND', () => {
    expect(getPaidAmount(payments)).toBe(300)
  })
  it('退款金额 = PAID 且 REFUND', () => {
    expect(getRefundAmount(payments)).toBe(300)
  })
  it('净支出 = 已支付 - 退款', () => {
    expect(getNetPaidAmount(payments)).toBe(0)
  })
  it('待付款只累加有金额的待付节点', () => {
    expect(getPendingAmount(payments)).toBe(999)
  })
  it('进度 = 已支付 / 总额（四舍五入）', () => {
    expect(getPaymentProgress(payments, 1299)).toBe(23)
  })
  it('总额为 0 时进度为 0', () => {
    expect(getPaymentProgress(payments, 0)).toBe(0)
  })
})

describe('getPaymentSummaryStatus', () => {
  it('存在逾期待付款 → OVERDUE', () => {
    expect(
      getPaymentSummaryStatus(
        [payment({ type: 'DEPOSIT', status: 'PAID', amount: 300 }), payment({ dueAt: '2027-03-01' })],
        TODAY,
      ),
    ).toBe('OVERDUE')
  })
  it('已付 + 待付 → PARTIALLY_PAID', () => {
    expect(
      getPaymentSummaryStatus(
        [payment({ type: 'DEPOSIT', status: 'PAID', amount: 300 }), payment({ dueAt: null })],
        TODAY,
      ),
    ).toBe('PARTIALLY_PAID')
  })
  it('全部已付 → PAID', () => {
    expect(
      getPaymentSummaryStatus([payment({ status: 'PAID', paidAt: '2027-03-18T00:00:00.000Z' })], TODAY),
    ).toBe('PAID')
  })
  it('只有待付且从未付过 → UNPAID', () => {
    expect(getPaymentSummaryStatus([payment({ dueAt: null })], TODAY)).toBe('UNPAID')
  })
  it('金额待定（amount = null）仍算存在待付款', () => {
    expect(getPaymentSummaryStatus([payment({ type: 'SHIPPING', amount: null })], TODAY)).toBe('UNPAID')
  })
  it('没有任何付款节点 → UNPAID', () => {
    expect(getPaymentSummaryStatus([], TODAY)).toBe('UNPAID')
  })
})

describe('getNextPayment', () => {
  it('取最早 dueAt', () => {
    const next = getNextPayment(
      [
        payment({ id: 'b', dueAt: '2027-04-01', sortOrder: 1 }),
        payment({ id: 'a', dueAt: '2027-03-25', sortOrder: 2 }),
      ],
      TODAY,
    )
    expect(next?.id).toBe('a')
  })
  it('无 dueAt 的排在最后', () => {
    const next = getNextPayment(
      [
        payment({ id: 'none', dueAt: null, sortOrder: 0 }),
        payment({ id: 'dated', dueAt: '2027-05-01', sortOrder: 9 }),
      ],
      TODAY,
    )
    expect(next?.id).toBe('dated')
  })
  it('都没有 dueAt 时取 sortOrder 最小', () => {
    expect(
      getNextPayment(
        [payment({ id: 'second', sortOrder: 2 }), payment({ id: 'first', sortOrder: 1 })],
        TODAY,
      )?.id,
    ).toBe('first')
  })
  it('逾期节点带逾期天数', () => {
    const next = getNextPayment(
      [
        payment({ id: 'later', dueAt: '2027-04-01' }),
        payment({ id: 'overdue', dueAt: '2027-03-15' }),
      ],
      TODAY,
    )
    expect(next?.id).toBe('overdue')
    expect(next?.isOverdue).toBe(true)
    expect(next?.overdueDays).toBe(5)
  })
  it('已付款节点不参与', () => {
    expect(getNextPayment([payment({ status: 'PAID', dueAt: '2027-03-01' })], TODAY)).toBeNull()
  })
  it('CANCELLED / REFUNDED 节点不参与', () => {
    expect(
      getNextPayment([payment({ status: 'CANCELLED' }), payment({ status: 'REFUNDED' })], TODAY),
    ).toBeNull()
  })
})

describe('getNextPaymentLabel', () => {
  it.each([
    ['DEPOSIT', '待付定金'],
    ['BALANCE', '待补尾款'],
    ['SHIPPING', '待补邮'],
    ['TAX', '待补税'],
    ['INSTALLMENT', '待阶段付款'],
    ['SUPPLEMENT', '待补差价'],
    ['FULL', '待付款'],
    ['OTHER', '待付款'],
  ])('%s → %s', (type, label) => {
    expect(getNextPaymentLabel(type)).toBe(label)
  })
})
