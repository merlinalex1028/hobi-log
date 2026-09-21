import type { CalendarEventType } from '@/types/models'

export const CALENDAR_EVENT_CONFIG: Record<CalendarEventType, { label: string; color: string }> = {
  PAYMENT_DUE: { label: '付款到期', color: '#d14b4b' },
  DELIVERY: { label: '物流签收', color: '#3d5fd8' },
  EXPECTED_RELEASE: { label: '预计出货', color: '#8a53d1' },
  RELEASED: { label: '已出货', color: '#2f9e63' },
}

export const CALENDAR_VIEWS = [
  { value: 'dayGridMonth', label: '月' },
  { value: 'timeGridWeek', label: '周' },
  { value: 'listMonth', label: '列表' },
] as const

export type CalendarViewName = (typeof CALENDAR_VIEWS)[number]['value']

export const CALENDAR_DEFAULT_VIEW: CalendarViewName = 'dayGridMonth'
