import type { CalendarEventVo } from '@/types/models'
import { CALENDAR_EVENT_CONFIG } from '@/constants/calendar'

export interface CalendarEventExtendedProps extends Record<string, unknown> {
  orderId: string
  type: CalendarEventVo['type']
  title: string
  date: string
  amount: number | null
  currency: string | null
  precision: string | null
  displayStatus: string
}

export interface CalendarEventInput {
  id: string
  title: string
  start: string
  allDay: boolean
  backgroundColor: string
  borderColor: string
  extendedProps: CalendarEventExtendedProps
}

export function toCalendarEventInputs(events: CalendarEventVo[]): CalendarEventInput[] {
  return events.map(event => {
    const color = CALENDAR_EVENT_CONFIG[event.type].color
    return {
      id: event.id,
      title: event.title,
      start: event.date,
      allDay: true,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        orderId: event.orderId,
        type: event.type,
        title: event.title,
        date: event.date,
        amount: event.amount,
        currency: event.currency,
        precision: event.precision,
        displayStatus: event.displayStatus,
      },
    }
  })
}

export function readEventProps(
  extendedProps: Record<string, unknown>,
): CalendarEventExtendedProps | null {
  const orderId = extendedProps.orderId
  const type = extendedProps.type
  if (typeof orderId !== 'string' || typeof type !== 'string') return null
  return extendedProps as CalendarEventExtendedProps
}
