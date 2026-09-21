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
  displayStatus: string
}
