export const PAYMENT_MODES = ['FULL', 'DEPOSIT_BALANCE', 'INSTALLMENT', 'CUSTOM'] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export const ORDER_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_TYPES = [
  'FULL',
  'DEPOSIT',
  'BALANCE',
  'INSTALLMENT',
  'SHIPPING',
  'TAX',
  'SUPPLEMENT',
  'REFUND',
  'OTHER',
] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]

export const RELEASE_EVENT_TYPES = [
  'EXPECTED_RELEASE',
  'DELAY',
  'RELEASED',
  'STORE_ARRIVED',
  'BALANCE_OPEN',
  'SHIPMENT_READY',
] as const
export type ReleaseEventType = (typeof RELEASE_EVENT_TYPES)[number]

export const SHIPMENT_STATUSES = [
  'WAITING',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'EXCEPTION',
  'RETURNED',
] as const
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

export const PRODUCT_CATEGORIES = [
  'SCALE_FIGURE',
  'PRIZE_FIGURE',
  'NENDOROID',
  'ACTION_FIGURE',
  'GK',
  'MODEL',
  'PLUSH',
  'ACRYLIC',
  'BADGE',
  'CARD',
  'BOOK',
  'OTHER',
] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const ATTACHMENT_TYPES = [
  'PRODUCT_IMAGE',
  'ORDER_SCREENSHOT',
  'PAYMENT_SCREENSHOT',
  'PAYMENT_PROOF',
  'SHIPMENT_SCREENSHOT',
  'CHAT_SCREENSHOT',
  'OTHER',
] as const
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number]

export const DISPLAY_STATUSES = [
  'CANCELLED',
  'REFUNDED',
  'PAYMENT_OVERDUE',
  'WAITING_PAYMENT',
  'SHIPMENT_EXCEPTION',
  'IN_TRANSIT',
  'WAITING_SHIPMENT',
  'WAITING_RELEASE',
  'COMPLETED',
  'ACTIVE',
] as const
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number]

export const PAYMENT_SUMMARY_STATUSES = ['OVERDUE', 'PARTIALLY_PAID', 'UNPAID', 'PAID'] as const
export type PaymentSummaryStatus = (typeof PAYMENT_SUMMARY_STATUSES)[number]

export const RELEASE_STATUSES = [
  'UNKNOWN',
  'WAITING_RELEASE',
  'DELAYED',
  'RELEASED',
  'STORE_ARRIVED',
  'READY_TO_SHIP',
] as const
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number]
