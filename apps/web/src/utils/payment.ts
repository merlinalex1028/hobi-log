export interface PaymentFormLike {
  type: string
  amount: number | null
  status: string
  dueAt?: string | null
  paidAt?: string | null
  sortOrder: number
}

const isPending = (payment: PaymentFormLike) => payment.status === 'PENDING' || payment.status === 'OVERDUE'

export function sumPaid(payments: PaymentFormLike[]): number {
  return payments
    .filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND')
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function sumRefund(payments: PaymentFormLike[]): number {
  return payments
    .filter(payment => payment.status === 'PAID' && payment.type === 'REFUND')
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function netPaid(payments: PaymentFormLike[]): number {
  return sumPaid(payments) - sumRefund(payments)
}

export function sumPending(payments: PaymentFormLike[]): number {
  return payments
    .filter(payment => isPending(payment) && payment.amount !== null)
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function progress(payments: PaymentFormLike[], totalAmount: number): number {
  if (totalAmount <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((sumPaid(payments) / totalAmount) * 100)))
}

export function nextPaymentOf(payments: PaymentFormLike[]): PaymentFormLike | null {
  const candidates = payments.filter(isPending)
  if (candidates.length === 0) return null
  return (
    [...candidates].sort((a, b) => {
      const aDue = a.dueAt ?? '9999-12-31'
      const bDue = b.dueAt ?? '9999-12-31'
      return aDue === bDue ? a.sortOrder - b.sortOrder : aDue < bDue ? -1 : 1
    })[0] ?? null
  )
}
