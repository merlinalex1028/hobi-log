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
