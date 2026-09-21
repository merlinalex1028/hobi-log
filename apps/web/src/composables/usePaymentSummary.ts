import { computed, type ComputedRef, type Ref } from 'vue'
import { netPaid, nextPaymentOf, progress, sumPaid, sumPending } from '@/utils/payment'
import type { PaymentFormLike } from '@/utils/payment'

export interface PaymentSummary {
  paidAmount: number
  pendingAmount: number
  refundAmount: number
  netPaidAmount: number
  progress: number
  nextPayment: PaymentFormLike | null
}

export function usePaymentSummary(
  payments: Ref<PaymentFormLike[]> | ComputedRef<PaymentFormLike[]>,
  totalAmount: Ref<number> | ComputedRef<number>,
): ComputedRef<PaymentSummary> {
  return computed(() => ({
    paidAmount: sumPaid(payments.value),
    pendingAmount: sumPending(payments.value),
    refundAmount: sumPaid(payments.value.filter(payment => payment.type === 'REFUND')),
    netPaidAmount: netPaid(payments.value),
    progress: progress(payments.value, totalAmount.value),
    nextPayment: nextPaymentOf(payments.value),
  }))
}
