import type { Prisma } from '../../../generated/prisma/client'
import { toDateString, toIsoString, toNumber } from '../../../common/utils/serialize'
import type { OrderDomain, PaymentLike, ReleaseEventLike, ShipmentLike } from '../domain/types'

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: true } }
    payments: true
    releaseEvents: true
    shipments: { include: { items: true } }
    orderEvents: true
    attachments: true
    platform: true
    store: true
  }
}>

export function toPaymentLike(payment: OrderWithRelations['payments'][number]): PaymentLike {
  return {
    id: payment.id,
    type: payment.type,
    name: payment.name,
    amount: toNumber(payment.amount),
    status: payment.status,
    expectedAt: toDateString(payment.expectedAt),
    dueAt: toDateString(payment.dueAt),
    paidAt: toIsoString(payment.paidAt),
    sortOrder: payment.sortOrder,
  }
}

export function toReleaseEventLike(
  event: OrderWithRelations['releaseEvents'][number],
): ReleaseEventLike {
  return {
    id: event.id,
    type: event.type,
    oldDate: toDateString(event.oldDate),
    newDate: toDateString(event.newDate),
    datePrecision: event.datePrecision,
    occurredAt: event.occurredAt.toISOString(),
  }
}

export function toShipmentLike(shipment: OrderWithRelations['shipments'][number]): ShipmentLike {
  return {
    id: shipment.id,
    status: shipment.status,
    carrier: shipment.carrier,
    trackingNo: shipment.trackingNo,
    shippedAt: toIsoString(shipment.shippedAt),
    estimatedDeliveryAt: toIsoString(shipment.estimatedDeliveryAt),
    deliveredAt: toIsoString(shipment.deliveredAt),
  }
}

export function toOrderDomain(order: OrderWithRelations): OrderDomain {
  return {
    id: order.id,
    status: order.status,
    archived: order.archived,
    currency: order.currency,
    totalAmount: toNumber(order.totalAmount) ?? 0,
    payments: order.payments.map(toPaymentLike).sort((a, b) => a.sortOrder - b.sortOrder),
    releaseEvents: order.releaseEvents.map(toReleaseEventLike),
    shipments: order.shipments.map(toShipmentLike),
  }
}
