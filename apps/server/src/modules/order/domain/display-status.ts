import type { DisplayStatus } from '@hobilog/shared'
import { DISPLAY_STATUS_LABELS } from '@hobilog/shared'
import { getNextPayment, getNextPaymentLabel, isOverdue } from './payment-summary'
import { getDelayMonths, getPlannedReleaseDate, isReleased } from './release'
import { countInTransit, hasShippedShipment, isOrderCompleted } from './shipment'
import type { OrderDomain } from './types'

function hasOverduePayment(order: OrderDomain, today: string): boolean {
  return order.payments.some(payment => isOverdue(payment, today))
}

function hasPendingPayment(order: OrderDomain): boolean {
  return order.payments.some(payment => payment.status === 'PENDING')
}

export function getDisplayStatus(order: OrderDomain, today: string): DisplayStatus {
  if (order.status === 'CANCELLED') return 'CANCELLED'
  if (order.status === 'REFUNDED') return 'REFUNDED'
  if (hasOverduePayment(order, today)) return 'PAYMENT_OVERDUE'
  if (hasPendingPayment(order)) return 'WAITING_PAYMENT'
  if (order.shipments.some(shipment => shipment.status === 'EXCEPTION')) return 'SHIPMENT_EXCEPTION'
  if (
    order.shipments.some(
      shipment => shipment.status === 'SHIPPED' || shipment.status === 'IN_TRANSIT',
    )
  ) {
    return 'IN_TRANSIT'
  }
  if (isReleased(order.releaseEvents) && !hasShippedShipment(order.shipments)) {
    return 'WAITING_SHIPMENT'
  }
  if (isOrderCompleted(order, today)) return 'COMPLETED'
  if (!isReleased(order.releaseEvents)) return 'WAITING_RELEASE'
  return 'ACTIVE'
}

export function getDisplayStatusLabel(order: OrderDomain, today: string): string {
  const status = getDisplayStatus(order, today)

  if (status === 'WAITING_PAYMENT' || status === 'PAYMENT_OVERDUE') {
    const next = getNextPayment(order.payments, today)
    if (next) {
      return next.isOverdue
        ? `${getNextPaymentLabel(next.type)} · 已逾期`
        : getNextPaymentLabel(next.type)
    }
  }

  if (status === 'WAITING_RELEASE' && getDelayMonths(order.releaseEvents) > 0) {
    return '延期 · 等待出货'
  }

  return DISPLAY_STATUS_LABELS[status]
}

export function getDisplayStatusHint(order: OrderDomain, today: string): string | null {
  const status = getDisplayStatus(order, today)

  if (status === 'PAYMENT_OVERDUE') {
    const next = getNextPayment(order.payments, today)
    return next?.overdueDays ? `已逾期 ${next.overdueDays} 天` : null
  }

  if (status === 'WAITING_PAYMENT') {
    const next = getNextPayment(order.payments, today)
    if (!next) return null
    if (next.dueAt) return `${next.dueAt} 截止`
    return next.amount === null ? '暂无截止日期' : null
  }

  if (status === 'IN_TRANSIT') {
    const count = countInTransit(order.shipments)
    return count > 0 ? `${count} 个包裹运输中` : null
  }

  if (status === 'WAITING_RELEASE' || status === 'WAITING_SHIPMENT') {
    const planned = getPlannedReleaseDate(order.releaseEvents)
    return planned ? `预计 ${planned.date.slice(0, 7).replace('-', '年')}月` : null
  }

  return null
}
