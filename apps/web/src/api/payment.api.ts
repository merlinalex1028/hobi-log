import type { OrderDetail } from '@/types/models'
import { http } from './http'
import type { OrderPaymentPayload } from './order.api'

export function createPayment(orderId: string, payload: OrderPaymentPayload): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/orders/${orderId}/payments`, payload).then(res => res.data)
}

export function updatePayment(
  id: string,
  payload: Partial<OrderPaymentPayload> & { sortOrder?: number },
): Promise<OrderDetail> {
  return http.patch<OrderDetail>(`/payments/${id}`, payload).then(res => res.data)
}

export function markPaymentPaid(
  id: string,
  payload: {
    paidAmount: number
    paidAt?: string
    paymentMethod?: string
    transactionNo?: string
    note?: string
    createSupplement?: boolean
  },
): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/payments/${id}/paid`, payload).then(res => res.data)
}

export function refundPayment(
  id: string,
  payload: { amount: number; paidAt?: string; paymentMethod?: string; note?: string; markOriginal?: boolean },
): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/payments/${id}/refund`, payload).then(res => res.data)
}
