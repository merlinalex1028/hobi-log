import type { ShipmentStatus } from '@hobilog/shared'
import { SHIPMENT_SUMMARY_PRIORITY } from '@hobilog/shared'
import { isOverdue } from './payment-summary'
import type { OrderDomain, ShipmentLike } from './types'

const SHIPPED_STATUSES: ShipmentStatus[] = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED']
const IN_TRANSIT_STATUSES: ShipmentStatus[] = ['SHIPPED', 'IN_TRANSIT']

export function getShipmentSummaryStatus(shipments: ShipmentLike[]): ShipmentStatus | null {
  if (shipments.length === 0) return null
  return shipments.reduce<ShipmentStatus>(
    (best, shipment) =>
      SHIPMENT_SUMMARY_PRIORITY[shipment.status] < SHIPMENT_SUMMARY_PRIORITY[best]
        ? shipment.status
        : best,
    shipments[0]?.status ?? 'WAITING',
  )
}

export function hasShippedShipment(shipments: ShipmentLike[]): boolean {
  return shipments.some(shipment => SHIPPED_STATUSES.includes(shipment.status))
}

export function countInTransit(shipments: ShipmentLike[]): number {
  return shipments.filter(shipment => IN_TRANSIT_STATUSES.includes(shipment.status)).length
}

export function isOrderCompleted(order: OrderDomain, today: string): boolean {
  const hasPending = order.payments.some(
    payment => payment.status === 'PENDING' || isOverdue(payment, today),
  )
  if (hasPending) return false
  if (order.shipments.length === 0) return false
  return order.shipments.every(shipment => shipment.status === 'DELIVERED')
}
