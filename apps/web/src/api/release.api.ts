import type { OrderDetail } from '@/types/models'
import { http } from './http'

export function delayRelease(
  orderId: string,
  payload: {
    newDate: string
    precision?: 'DAY' | 'MONTH'
    oldDate?: string
    source?: string
    sourceUrl?: string
    note?: string
  },
): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/orders/${orderId}/release/delay`, payload).then(res => res.data)
}

export function markReleased(
  orderId: string,
  payload: { date?: string; source?: string; sourceUrl?: string; note?: string },
): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/orders/${orderId}/release/released`, payload).then(res => res.data)
}

export function markStoreArrived(
  orderId: string,
  payload: { date?: string; source?: string; sourceUrl?: string; note?: string },
): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/orders/${orderId}/release/store-arrived`, payload).then(res => res.data)
}

export function openBalance(
  orderId: string,
  payload: { paymentId?: string; paymentType?: string; expectedAt?: string; dueAt?: string; note?: string },
): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/orders/${orderId}/release/balance-open`, payload).then(res => res.data)
}
