import type { CalendarEventVo } from '@/types/models'
import { http } from './http'

export interface CalendarRangeParams {
  from: string
  to: string
}

export function getCalendarEvents(params: CalendarRangeParams): Promise<CalendarEventVo[]> {
  return http.get<CalendarEventVo[]>('/calendar/events', { params }).then(res => res.data)
}
