import type { OrderStatus } from '@hobilog/shared'
import type { OrderDetail, OrderListItem, PaginatedResult } from '@/types/models'
import { http } from './http'

export interface OrderListParams {
  tab?: string
  keyword?: string
  status?: OrderStatus
  paymentSummaryStatus?: string
  platformId?: string
  storeId?: string
  manufacturer?: string
  ipName?: string
  characterName?: string
  category?: string
  year?: number
  priceMin?: number
  priceMax?: number
  delayed?: boolean
  page?: number
  pageSize?: number
}

export interface OrderItemPayload {
  productId: string
  quantity: number
  unitPrice: number
  note?: string
}

export interface OrderPaymentPayload {
  type: string
  name?: string
  amount?: number | null
  expectedAt?: string
  dueAt?: string
  paidAt?: string
  status?: 'PENDING' | 'PAID'
  paymentMethod?: string
  transactionNo?: string
  note?: string
}

export interface CreateOrderPayload {
  items: OrderItemPayload[]
  platformId?: string
  storeId?: string
  orderNo?: string
  orderUrl?: string
  orderedAt: string
  currency: string
  autoCalculateGoodsAmount: boolean
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
  paymentMode: string
  payments: OrderPaymentPayload[]
  expectedRelease?: { date: string; precision: 'DAY' | 'MONTH' }
  note?: string
}

export type UpdateOrderPayload = Partial<Omit<CreateOrderPayload, 'items' | 'payments'>>

export function getOrderList(params: OrderListParams): Promise<PaginatedResult<OrderListItem>> {
  return http.get<PaginatedResult<OrderListItem>>('/orders', { params }).then(res => res.data)
}

export function getOrderDetail(id: string): Promise<OrderDetail> {
  return http.get<OrderDetail>(`/orders/${id}`).then(res => res.data)
}

export function createOrder(payload: CreateOrderPayload): Promise<OrderDetail> {
  return http.post<OrderDetail>('/orders', payload).then(res => res.data)
}

export function updateOrder(id: string, payload: UpdateOrderPayload): Promise<OrderDetail> {
  return http.patch<OrderDetail>(`/orders/${id}`, payload).then(res => res.data)
}

export function cancelOrder(id: string, payload: { refund: boolean; note?: string }): Promise<OrderDetail> {
  return http.post<OrderDetail>(`/orders/${id}/cancel`, payload).then(res => res.data)
}
