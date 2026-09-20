import type { OrderStatus, PaymentStatus, ShipmentStatus } from '@hobilog/shared'

export interface PaymentLike {
  id: string
  type: string
  name: string | null
  amount: number | null
  status: PaymentStatus
  expectedAt: string | null
  dueAt: string | null
  paidAt: string | null
  sortOrder: number
}

export interface ReleaseEventLike {
  id: string
  type: string
  oldDate: string | null
  newDate: string | null
  datePrecision: string | null
  occurredAt: string
}

export interface ShipmentLike {
  id: string
  status: ShipmentStatus
  carrier: string | null
  trackingNo: string | null
  shippedAt: string | null
  estimatedDeliveryAt: string | null
  deliveredAt: string | null
}

export interface OrderDomain {
  id: string
  status: OrderStatus
  archived: boolean
  currency: string
  totalAmount: number
  payments: PaymentLike[]
  releaseEvents: ReleaseEventLike[]
  shipments: ShipmentLike[]
}
