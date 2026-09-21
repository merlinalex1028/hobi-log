import { describe, expect, it } from 'vitest'
import { netPaid, nextPaymentOf, progress, sumPaid, sumPending } from './payment'

const payments = [
  { type: 'DEPOSIT', amount: 300, status: 'PAID', sortOrder: 0 },
  { type: 'BALANCE', amount: 999, status: 'PENDING', dueAt: '2027-03-20', sortOrder: 1 },
  { type: 'SHIPPING', amount: null, status: 'PENDING', dueAt: null, sortOrder: 2 },
  { type: 'REFUND', amount: 300, status: 'PAID', sortOrder: 3 },
]

describe('付款汇总（与后端同口径，用于表单预览）', () => {
  it('已支付不含退款', () => {
    expect(sumPaid(payments)).toBe(300)
  })
  it('净支出 = 已支付 - 退款', () => {
    expect(netPaid(payments)).toBe(0)
  })
  it('待付款忽略金额待定节点', () => {
    expect(sumPending(payments)).toBe(999)
  })
  it('进度 = 已支付 / 总额', () => {
    expect(progress(payments, 1299)).toBe(23)
  })
  it('下一付款取最早截止，无截止排最后', () => {
    expect(nextPaymentOf(payments)?.type).toBe('BALANCE')
  })
  it('无待付节点时返回 null', () => {
    expect(nextPaymentOf([{ type: 'FULL', amount: 100, status: 'PAID', sortOrder: 0 }])).toBeNull()
  })
})

describe('付款汇总边界值', () => {
  it('空数组全部归零', () => {
    expect(sumPaid([])).toBe(0)
    expect(sumPending([])).toBe(0)
    expect(netPaid([])).toBe(0)
    expect(progress([], 1299)).toBe(0)
    expect(nextPaymentOf([])).toBeNull()
  })

  it('总额为 0 或负数时进度为 0', () => {
    expect(progress(payments, 0)).toBe(0)
    expect(progress(payments, -100)).toBe(0)
  })

  it('已支付金额全部为 null 时按 0 计', () => {
    const nullable = [{ type: 'FULL', amount: null, status: 'PAID', sortOrder: 0 }]
    expect(sumPaid(nullable)).toBe(0)
    expect(netPaid(nullable)).toBe(0)
  })

  it('OVERDUE 计入待付款', () => {
    expect(sumPending([{ type: 'BALANCE', amount: 500, status: 'OVERDUE', sortOrder: 0 }])).toBe(500)
  })

  it('无截止日的待付节点排在最后，按 sortOrder 取首个', () => {
    const unordered = [
      { type: 'BALANCE', amount: 100, status: 'PENDING', dueAt: null, sortOrder: 0 },
      { type: 'SHIPPING', amount: 20, status: 'PENDING', dueAt: null, sortOrder: 1 },
      { type: 'TAX', amount: 30, status: 'PENDING', dueAt: '2027-01-01', sortOrder: 2 },
    ]
    expect(nextPaymentOf(unordered)?.type).toBe('TAX')
    expect(nextPaymentOf(unordered.slice(0, 2))?.type).toBe('BALANCE')
  })

  it('进度封顶 100', () => {
    expect(progress([{ type: 'FULL', amount: 2000, status: 'PAID', sortOrder: 0 }], 1000)).toBe(100)
  })
})
