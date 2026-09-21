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
    displayStatus: string
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
    displayStatus: string
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
