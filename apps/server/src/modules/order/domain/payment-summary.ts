import type { PaymentSummaryStatus } from '@hobilog/shared'
import type { PaymentLike } from './types'

const REFUND_TYPE = 'REFUND'

export interface NextPaymentInfo {
  id: string
  type: string
  name: string | null
  amount: number | null
  dueAt: string | null
  isOverdue: boolean
  overdueDays: number
}

function diffDays(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`)
  const toTime = Date.parse(`${to}T00:00:00.000Z`)
  return Math.round((toTime - fromTime) / 86_400_000)
}

export function isOverdue(payment: PaymentLike, today: string): boolean {
  if (payment.status !== 'PENDING') return false
  if (!payment.dueAt) return false
  return payment.dueAt < today
}

function isPending(payment: PaymentLike): boolean {
  return payment.status === 'PENDING'
}

export function getPaidAmount(payments: PaymentLike[]): number {
  return payments
    .filter(payment => payment.status === 'PAID' && payment.type !== REFUND_TYPE)
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function getRefundAmount(payments: PaymentLike[]): number {
  return payments
    .filter(payment => payment.status === 'PAID' && payment.type === REFUND_TYPE)
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function getNetPaidAmount(payments: PaymentLike[]): number {
  return getPaidAmount(payments) - getRefundAmount(payments)
}

export function getPendingAmount(payments: PaymentLike[]): number {
  return payments
    .filter(payment => isPending(payment) && payment.amount !== null)
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function getPaymentProgress(payments: PaymentLike[], totalAmount: number): number {
  if (totalAmount <= 0) return 0
  const progress = Math.round((getPaidAmount(payments) / totalAmount) * 100)
  return Math.min(100, Math.max(0, progress))
}

export function getPaymentSummaryStatus(
  payments: PaymentLike[],
  today: string,
): PaymentSummaryStatus {
  const pending = payments.filter(isPending)
  if (pending.some(payment => isOverdue(payment, today))) return 'OVERDUE'
  if (pending.length > 0) {
    return getPaidAmount(payments) > 0 ? 'PARTIALLY_PAID' : 'UNPAID'
  }
  const hasRealPayment = payments.some(
    payment =>
      payment.status !== 'CANCELLED' &&
      payment.status !== 'REFUNDED' &&
      payment.type !== REFUND_TYPE,
  )
  return hasRealPayment ? 'PAID' : 'UNPAID'
}

export function getNextPayment(payments: PaymentLike[], today: string): NextPaymentInfo | null {
  const candidates = payments.filter(isPending)
  if (candidates.length === 0) return null

  const sorted = [...candidates].sort((a, b) => {
    const aDue = a.dueAt ?? '9999-12-31'
    const bDue = b.dueAt ?? '9999-12-31'
    if (aDue !== bDue) return aDue < bDue ? -1 : 1
    return a.sortOrder - b.sortOrder
  })

  const target = sorted[0]
  if (!target) return null

  const overdue = isOverdue(target, today)
  return {
    id: target.id,
    type: target.type,
    name: target.name,
    amount: target.amount,
    dueAt: target.dueAt,
    isOverdue: overdue,
    overdueDays: overdue && target.dueAt ? diffDays(target.dueAt, today) : 0,
  }
}

const NEXT_PAYMENT_LABELS: Record<string, string> = {
  DEPOSIT: '待付定金',
  BALANCE: '待补尾款',
  SHIPPING: '待补邮',
  TAX: '待补税',
  INSTALLMENT: '待阶段付款',
  SUPPLEMENT: '待补差价',
}

export function getNextPaymentLabel(type: string): string {
  return NEXT_PAYMENT_LABELS[type] ?? '待付款'
}
