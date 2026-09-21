import type {
  AttachmentType,
  DisplayStatus,
  OrderStatus,
  PaymentMode,
  PaymentSummaryStatus,
  ProductCategory,
  ReleaseStatus,
  ShipmentStatus,
} from '@hobilog/shared'

export interface OrderPaymentSummary {
  status: PaymentSummaryStatus
  paidAmount: number
  pendingAmount: number
  refundAmount: number
  netPaidAmount: number
  progress: number
  nextPayment: {
    id: string
    type: string
    name: string | null
    amount: number | null
    dueAt: string | null
    isOverdue: boolean
    overdueDays: number
  } | null
}

export interface OrderListItem {
  id: string
  orderNo: string | null
  orderedAt: string
  currency: string
  totalAmount: number
  paymentMode: PaymentMode
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
  paymentSummary: OrderPaymentSummary
  releaseSummary: { status: ReleaseStatus; plannedDate: string | null; precision: string | null; delayMonths: number }
  shipmentSummary: {
    status: ShipmentStatus | null
    carrier: string | null
    trackingNo: string | null
    inTransitCount: number
    total: number
  }
  updatedAt: string
}

export interface TimelineItem {
  id: string
  type: string
  title: string
  description: string | null
  occurredAt: string
  source: 'ORDER' | 'PAYMENT' | 'RELEASE' | 'SHIPMENT'
}

export interface OrderDetail extends OrderListItem {
  orderUrl: string | null
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
  note: string | null
  createdAt: string
  items: Array<{
    id: string
    productId: string
    productName: string
    coverUrl: string | null
    quantity: number
    unitPrice: number
    subtotal: number
    note: string | null
  }>
  payments: Array<{
    id: string
    type: string
    name: string | null
    amount: number | null
    currency: string
    status: string
    isOverdue: boolean
    expectedAt: string | null
    dueAt: string | null
    paidAt: string | null
    paymentMethod: string | null
    transactionNo: string | null
    note: string | null
    sortOrder: number
  }>
  releaseEvents: Array<{
    id: string
    type: string
    label: string
    oldDate: string | null
    newDate: string | null
    datePrecision: string | null
    occurredAt: string
    source: string | null
    sourceUrl: string | null
    note: string | null
  }>
  shipments: Array<{
    id: string
    carrier: string | null
    trackingNo: string | null
    status: string
    shippedAt: string | null
    estimatedDeliveryAt: string | null
    deliveredAt: string | null
    note: string | null
    items: Array<{ orderItemId: string; productName: string; quantity: number }>
  }>
  attachments: Array<{
    id: string
    type: string
    fileName: string
    storagePath: string
    mimeType: string | null
    createdAt: string
  }>
  orderEvents: Array<{ id: string; type: string; title: string; description: string | null; occurredAt: string }>
  timeline: TimelineItem[]
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ProductVo {
  id: string
  name: string
  originalName: string | null
  coverUrl: string | null
  category: ProductCategory
  ipName: string | null
  characterName: string | null
  manufacturer: string | null
  seriesName: string | null
  scale: string | null
  version: string | null
  sku: string | null
  officialPrice: number | null
  officialCurrency: string | null
  announcedAt: string | null
  originalReleaseDate: string | null
  releaseDatePrecision: string | null
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
  tagIds: string[]
}

export interface PlatformVo {
  id: string
  name: string
  logoUrl: string | null
  website: string | null
  region: string | null
  defaultCurrency: string | null
  note: string | null
  createdAt: string
  storeCount: number
}

export interface StoreVo {
  id: string
  name: string
  platformId: string | null
  platformName: string | null
  url: string | null
  contact: string | null
  note: string | null
  createdAt: string
}

export interface CurrencyAmountVo {
  currency: string
  amount: number
}

export interface DashboardVo {
  kpis: {
    pendingPaymentAmount: CurrencyAmountVo[]
    upcomingPaymentAmount: CurrencyAmountVo[]
    monthReleaseCount: number
    inTransitOrderCount: number
    collectionCount: number
    totalOrderCount: number
  }
  todos: Array<{
    orderId: string
    displayStatus: DisplayStatus
    displayStatusLabel: string
    displayStatusHint: string | null
    title: string
    amount: number | null
    currency: string
    dueAt: string | null
    overdueDays: number
    priority: number
  }>
  futurePayments: Array<{ month: string; byCurrency: CurrencyAmountVo[] }>
  upcomingReleases: Array<{
    orderId: string
    title: string
    plannedDate: string | null
    precision: string | null
    delayMonths: number
  }>
  shipping: Array<{
    orderId: string
    title: string
    carrier: string | null
    trackingNo: string | null
    status: string
  }>
  recentOrders: Array<{
    id: string
    orderedAt: string
    displayStatus: DisplayStatus
    displayStatusLabel: string
    totalAmount: number
    currency: string
  }>
}

export interface MonthlyPaymentVo {
  month: string
  currency: string
  paidAmount: number
  refundAmount: number
  netPaidAmount: number
  orderAmount: number
}

export interface FuturePaymentVo {
  month: string
  byCurrency: CurrencyAmountVo[]
}

export interface DimensionStatVo {
  key: string
  label: string
  amount: CurrencyAmountVo[]
  orderCount: number
  itemCount: number
}

export type CalendarEventType = 'PAYMENT_DUE' | 'EXPECTED_RELEASE' | 'RELEASED' | 'DELIVERY'

export interface CalendarEventVo {
  id: string
  type: CalendarEventType
  date: string
  orderId: string
  title: string
  amount: number | null
  currency: string | null
  precision: string | null
  displayStatus: DisplayStatus
}

export interface CollectionItemVo {
  orderItemId: string
  orderId: string
  productId: string
  name: string
  coverUrl: string | null
  quantity: number
  purchasePrice: number
  currency: string
  purchasedAt: string
  deliveredAt: string | null
}

export interface CollectionStatsVo {
  totalItems: number
  deliveredOrders: number
  byCurrency: CurrencyAmountVo[]
}

export const REMINDER_KINDS = [
  'PAYMENT_DUE_SOON',
  'PAYMENT_OVERDUE',
  'RELEASE_THIS_MONTH',
  'RELEASE_DELAYED',
  'STALE_ORDER',
] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]

export interface ReminderVo {
  id: string
  kind: ReminderKind
  orderId: string
  title: string
  dueAt: string | null
  daysLeft: number | null
  overdueDays: number | null
  amount: number | null
  currency: string | null
  priority: number
}

export interface AttachmentVo {
  id: string
  type: AttachmentType
  fileName: string
  storagePath: string
  mimeType: string | null
  fileSize: string | null
  createdAt: string
}

export interface UploadUrlVo {
  bucket: string
  path: string
  token: string
  signedUrl: string
}
