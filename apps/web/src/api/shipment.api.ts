import type { ShipmentStatus } from '@hobilog/shared'
import type { OrderDetail } from '@/types/models'
import { http } from './http'

export function createShipment(
  orderId: string,
  payload: {
    carrier?: string
    trackingNo?: string
    status?: 'WAITING' | 'SHIPPED'
    shippedAt?: string
    estimatedDeliveryAt?: string
    note?: string
    items: Array<{ orderItemId: string; quantity: number }>
  },
): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/orders/${orderId}/shipments`, payload).then(res => res.data)
}

export function updateShipment(
  id: string,
  payload: {
    carrier?: string
    trackingNo?: string
    status?: ShipmentStatus
    shippedAt?: string
    estimatedDeliveryAt?: string
    note?: string
  },
): Promise<OrderDetail> {
  return http.patch<OrderDetail>(`/shipments/${id}`, payload).then(res => res.data)
}

export function deliverShipment(
  id: string,
  payload: { deliveredAt?: string; note?: string },
): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/shipments/${id}/delivered`, payload).then(res => res.data)
}
