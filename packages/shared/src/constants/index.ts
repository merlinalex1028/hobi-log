import type { DisplayStatus, PaymentSummaryStatus, ShipmentStatus } from '../enums'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export const SUPPORTED_CURRENCIES = ['CNY', 'JPY', 'USD', 'HKD'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const DEFAULT_CURRENCY = 'CNY'

export const REMINDER_OFFSET_DAYS = [7, 3, 1, 0] as const

export const DISPLAY_STATUS_PRIORITY: Record<DisplayStatus, number> = {
  CANCELLED: 0,
  REFUNDED: 1,
  PAYMENT_OVERDUE: 2,
  WAITING_PAYMENT: 3,
  SHIPMENT_EXCEPTION: 4,
  IN_TRANSIT: 5,
  WAITING_SHIPMENT: 6,
  WAITING_RELEASE: 7,
  COMPLETED: 8,
  ACTIVE: 9,
}

export const SHIPMENT_SUMMARY_PRIORITY: Record<ShipmentStatus, number> = {
  EXCEPTION: 0,
  IN_TRANSIT: 1,
  SHIPPED: 2,
  WAITING: 3,
  DELIVERED: 4,
  RETURNED: 5,
}

export const PAYMENT_SUMMARY_PRIORITY: Record<PaymentSummaryStatus, number> = {
  OVERDUE: 0,
  PARTIALLY_PAID: 1,
  UNPAID: 2,
  PAID: 3,
}

export const PAYMENT_TYPE_ORDER: Record<string, number> = {
  FULL: 0,
  DEPOSIT: 1,
  INSTALLMENT: 2,
  BALANCE: 3,
  SHIPPING: 4,
  TAX: 5,
  SUPPLEMENT: 6,
  OTHER: 7,
  REFUND: 8,
}
