import type { OrderDetail } from '@/types/models'

export type ReleaseEvent = OrderDetail['releaseEvents'][number]

export interface ReleasePlan {
  date: string | null
  precision: 'DAY' | 'MONTH'
}

function monthIndex(value: string): number {
  const [year, month] = value.slice(0, 7).split('-').map(Number)
  return (year ?? 0) * 12 + ((month ?? 1) - 1)
}

export function diffMonths(from: string, to: string): number {
  return monthIndex(to) - monthIndex(from)
}

export function delayMonthsBetween(oldDate: string, newDate: string): number {
  return diffMonths(oldDate, newDate)
}

export function sortReleaseEventsAsc(events: ReleaseEvent[]): ReleaseEvent[] {
  return [...events].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.id < b.id ? -1 : 1
    return a.occurredAt < b.occurredAt ? -1 : 1
  })
}

export function plannedReleaseOf(events: ReleaseEvent[]): ReleasePlan {
  const planned = sortReleaseEventsAsc(
    events.filter(event => (event.type === 'EXPECTED_RELEASE' || event.type === 'DELAY') && event.newDate !== null),
  )
  const latest = planned[planned.length - 1]
  if (!latest?.newDate) return { date: null, precision: 'MONTH' }
  return { date: latest.newDate, precision: latest.datePrecision === 'DAY' ? 'DAY' : 'MONTH' }
}

export function releaseMilestones(events: ReleaseEvent[]): ReleaseEvent[] {
  return sortReleaseEventsAsc(
    events.filter(event => event.type === 'RELEASED' || event.type === 'STORE_ARRIVED'),
  )
}

export function planDateForForm(value: string | null, precision: 'DAY' | 'MONTH'): string {
  if (!value) return ''
  return precision === 'MONTH' ? value.slice(0, 7) : value.slice(0, 10)
}
