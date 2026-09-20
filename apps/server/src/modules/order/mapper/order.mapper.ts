import { RELEASE_EVENT_TYPE_LABELS } from '@hobilog/shared'
import type {
  DisplayStatus,
  OrderStatus,
  PaymentSummaryStatus,
  ReleaseStatus,
  ShipmentStatus,
} from '@hobilog/shared'
import { toDateString, toIsoString, toNumber } from '../../../common/utils/serialize'
import { getDisplayStatus, getDisplayStatusHint, getDisplayStatusLabel } from '../domain/display-status'
import {
  getNextPayment,
  getNetPaidAmount,
  getPaidAmount,
  getPaymentProgress,
  getPaymentSummaryStatus,
  getPendingAmount,
  getRefundAmount,
} from '../domain/payment-summary'
import type { NextPaymentInfo } from '../domain/payment-summary'
import { getDelayMonths, getPlannedReleaseDate, getReleaseStatus } from '../domain/release'
import { countInTransit, getShipmentSummaryStatus } from '../domain/shipment'
import type { OrderWithRelations } from './order-domain.mapper'
import { toOrderDomain } from './order-domain.mapper'

export interface OrderListItemVo {
  id: string
  orderNo: string | null
  orderedAt: string
  currency: string
  totalAmount: number
  paymentMode: string
  status: OrderStatus
  archived: boolean
  platformId: string | null
  platformName: string | null
  storeId: string | null
  storeName: string | null
  itemCount: number
  productSummaries: Array<{ productId: string; name: string; coverUrl: string | null }>
  displayStatus: DisplayStatus
  displayStatusLabel: string
  displayStatusHint: string | null
  paymentSummary: {
    status: PaymentSummaryStatus
    paidAmount: number
    pendingAmount: number
    refundAmount: number
    netPaidAmount: number
    progress: number
    nextPayment: NextPaymentInfo | null
  }
  releaseSummary: {
    status: ReleaseStatus
    plannedDate: string | null
    precision: string | null
    delayMonths: number
  }
  shipmentSummary: {
    status: ShipmentStatus | null
    carrier: string | null
    trackingNo: string | null
    inTransitCount: number
    total: number
  }
  updatedAt: string
}

export interface TimelineItemVo {
  id: string
  type: string
  title: string
  description: string | null
  occurredAt: string
  source: 'ORDER' | 'PAYMENT' | 'RELEASE' | 'SHIPMENT'
}

export interface OrderDetailVo extends OrderListItemVo {
  orderUrl: string | null
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
  note: string | null
  createdAt: string
  items: Array<{
    id: string; productId: string; productName: string; coverUrl: string | null
    quantity: number; unitPrice: number; subtotal: number; note: string | null
  }>
  payments: Array<{
    id: string; type: string; name: string | null; amount: number | null; currency: string
    status: string; isOverdue: boolean; expectedAt: string | null; dueAt: string | null
    paidAt: string | null; paymentMethod: string | null; transactionNo: string | null
    note: string | null; sortOrder: number
  }>
  releaseEvents: Array<{
    id: string; type: string; label: string; oldDate: string | null; newDate: string | null
    datePrecision: string | null; occurredAt: string; source: string | null; sourceUrl: string | null; note: string | null
  }>
  shipments: Array<{
    id: string; carrier: string | null; trackingNo: string | null; status: string
    shippedAt: string | null; estimatedDeliveryAt: string | null; deliveredAt: string | null
    note: string | null; items: Array<{ orderItemId: string; productName: string; quantity: number }>
  }>
  attachments: Array<{
    id: string; type: string; fileName: string; storagePath: string; mimeType: string | null; createdAt: string
  }>
  orderEvents: Array<{ id: string; type: string; title: string; description: string | null; occurredAt: string }>
  timeline: TimelineItemVo[]
}

const REFUND_TYPE = 'REFUND'

export function toOrderListItemVo(order: OrderWithRelations, today: string): OrderListItemVo {
  const domain = toOrderDomain(order)
  const planned = getPlannedReleaseDate(domain.releaseEvents)
  const shipmentWithTracking = order.shipments.find(shipment => shipment.trackingNo !== null)

  return {
    id: order.id,
    orderNo: order.orderNo,
    orderedAt: toDateString(order.orderedAt) as string,
    currency: order.currency,
    totalAmount: toNumber(order.totalAmount) ?? 0,
    paymentMode: order.paymentMode,
    status: order.status,
    archived: order.archived,
    platformId: order.platformId,
    platformName: order.platform?.name ?? null,
    storeId: order.storeId,
    storeName: order.store?.name ?? null,
    itemCount: order.items.length,
    productSummaries: order.items.slice(0, 3).map(item => ({
      productId: item.productId,
      name: item.product.name,
      coverUrl: item.product.coverUrl,
    })),
    displayStatus: getDisplayStatus(domain, today),
    displayStatusLabel: getDisplayStatusLabel(domain, today),
    displayStatusHint: getDisplayStatusHint(domain, today),
    paymentSummary: {
      status: getPaymentSummaryStatus(domain.payments, today),
      paidAmount: getPaidAmount(domain.payments),
      pendingAmount: getPendingAmount(domain.payments),
      refundAmount: getRefundAmount(domain.payments),
      netPaidAmount: getNetPaidAmount(domain.payments),
      progress: getPaymentProgress(domain.payments, domain.totalAmount),
      nextPayment: getNextPayment(domain.payments, today),
    },
    releaseSummary: {
      status: getReleaseStatus(domain.releaseEvents),
      plannedDate: planned?.date ?? null,
      precision: planned?.precision ?? null,
      delayMonths: getDelayMonths(domain.releaseEvents),
    },
    shipmentSummary: {
      status: getShipmentSummaryStatus(domain.shipments),
      carrier: shipmentWithTracking?.carrier ?? null,
      trackingNo: shipmentWithTracking?.trackingNo ?? null,
      inTransitCount: countInTransit(domain.shipments),
      total: domain.shipments.length,
    },
    updatedAt: order.updatedAt.toISOString(),
  }
}

export function buildTimeline(order: OrderWithRelations): TimelineItemVo[] {
  const items: TimelineItemVo[] = []

  for (const payment of order.payments) {
    if (payment.status !== 'PAID' || !payment.paidAt) continue
    const isRefund = payment.type === REFUND_TYPE
    items.push({
      id: `payment:${payment.id}`,
      type: isRefund ? 'PAYMENT_REFUNDED' : 'PAYMENT_PAID',
      title: `${isRefund ? '退款' : '支付'}${payment.name ?? ''} ¥${Number(payment.amount ?? 0)}`,
      description: payment.note,
      occurredAt: payment.paidAt.toISOString(),
      source: 'PAYMENT',
    })
  }

  for (const event of order.releaseEvents) {
    items.push({
      id: `release:${event.id}`,
      type: event.type,
      title: RELEASE_EVENT_TYPE_LABELS[event.type as keyof typeof RELEASE_EVENT_TYPE_LABELS] ?? event.type,
      description:
        event.note ??
        (event.oldDate && event.newDate ? `${toDateString(event.oldDate)} → ${toDateString(event.newDate)}` : null),
      occurredAt: event.occurredAt.toISOString(),
      source: 'RELEASE',
    })
  }

  for (const shipment of order.shipments) {
    if (shipment.shippedAt) {
      items.push({
        id: `shipment-shipped:${shipment.id}`,
        type: 'SHIPMENT_SHIPPED',
        title: `店铺发货${shipment.carrier ? ` · ${shipment.carrier}` : ''}`,
        description: shipment.trackingNo,
        occurredAt: shipment.shippedAt.toISOString(),
        source: 'SHIPMENT',
      })
    }
    if (shipment.status === 'DELIVERED' && shipment.deliveredAt) {
      items.push({
        id: `shipment-delivered:${shipment.id}`,
        type: 'SHIPMENT_DELIVERED',
        title: '已签收',
        description: shipment.note,
        occurredAt: shipment.deliveredAt.toISOString(),
        source: 'SHIPMENT',
      })
    }
  }

  for (const event of order.orderEvents) {
    items.push({
      id: `order:${event.id}`,
      type: event.type,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt.toISOString(),
      source: 'ORDER',
    })
  }

  return items.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
}

export function toOrderDetailVo(order: OrderWithRelations, today: string): OrderDetailVo {
  const list = toOrderListItemVo(order, today)

  return {
    ...list,
    orderUrl: order.orderUrl,
    goodsAmount: toNumber(order.goodsAmount) ?? 0,
    discountAmount: toNumber(order.discountAmount) ?? 0,
    shippingAmount: toNumber(order.shippingAmount) ?? 0,
    taxAmount: toNumber(order.taxAmount) ?? 0,
    extraAmount: toNumber(order.extraAmount) ?? 0,
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      coverUrl: item.product.coverUrl,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice) ?? 0,
      subtotal: toNumber(item.subtotal) ?? 0,
      note: item.note,
    })),
    payments: [...order.payments]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(payment => ({
        id: payment.id,
        type: payment.type,
        name: payment.name,
        amount: toNumber(payment.amount),
        currency: payment.currency,
        status: payment.status,
        isOverdue: payment.status === 'PENDING' && (toDateString(payment.dueAt) ?? '9999-12-31') < today,
        expectedAt: toDateString(payment.expectedAt),
        dueAt: toDateString(payment.dueAt),
        paidAt: toIsoString(payment.paidAt),
        paymentMethod: payment.paymentMethod,
        transactionNo: payment.transactionNo,
        note: payment.note,
        sortOrder: payment.sortOrder,
      })),
    releaseEvents: order.releaseEvents.map(event => ({
      id: event.id,
      type: event.type,
      label: RELEASE_EVENT_TYPE_LABELS[event.type as keyof typeof RELEASE_EVENT_TYPE_LABELS] ?? event.type,
      oldDate: toDateString(event.oldDate),
      newDate: toDateString(event.newDate),
      datePrecision: event.datePrecision,
      occurredAt: event.occurredAt.toISOString(),
      source: event.source,
      sourceUrl: event.sourceUrl,
      note: event.note,
    })),
    shipments: order.shipments.map(shipment => ({
      id: shipment.id,
      carrier: shipment.carrier,
      trackingNo: shipment.trackingNo,
      status: shipment.status,
      shippedAt: toIsoString(shipment.shippedAt),
      estimatedDeliveryAt: toIsoString(shipment.estimatedDeliveryAt),
      deliveredAt: toIsoString(shipment.deliveredAt),
      note: shipment.note,
      items: shipment.items.map(item => ({
        orderItemId: item.orderItemId,
        productName: order.items.find(orderItem => orderItem.id === item.orderItemId)?.product.name ?? '',
        quantity: item.quantity,
      })),
    })),
    attachments: order.attachments.map(attachment => ({
      id: attachment.id,
      type: attachment.type,
      fileName: attachment.fileName,
      storagePath: attachment.storagePath,
      mimeType: attachment.mimeType,
      createdAt: attachment.createdAt.toISOString(),
    })),
    orderEvents: order.orderEvents.map(event => ({
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt.toISOString(),
    })),
    timeline: buildTimeline(order),
  }
}
