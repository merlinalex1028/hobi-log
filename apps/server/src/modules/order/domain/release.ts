import type { ReleaseStatus } from '@hobilog/shared'
import type { ReleaseEventLike } from './types'

const PROGRESS_RANK: Record<string, number> = {
  EXPECTED_RELEASE: 0,
  DELAY: 1,
  RELEASED: 2,
  STORE_ARRIVED: 3,
  SHIPMENT_READY: 4,
}

const RANK_TO_STATUS: Record<number, ReleaseStatus> = {
  0: 'WAITING_RELEASE',
  1: 'DELAYED',
  2: 'RELEASED',
  3: 'STORE_ARRIVED',
  4: 'READY_TO_SHIP',
}

const RELEASED_STATUSES: ReleaseStatus[] = ['RELEASED', 'STORE_ARRIVED', 'READY_TO_SHIP']

function byOccurredAtAsc(a: ReleaseEventLike, b: ReleaseEventLike): number {
  return a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0
}

export function getReleaseStatus(events: ReleaseEventLike[]): ReleaseStatus {
  if (events.length === 0) return 'UNKNOWN'
  const maxRank = events.reduce((max, event) => Math.max(max, PROGRESS_RANK[event.type] ?? -1), -1)
  if (maxRank < 0) return 'UNKNOWN'
  return RANK_TO_STATUS[maxRank] ?? 'UNKNOWN'
}

export function isReleased(events: ReleaseEventLike[]): boolean {
  return RELEASED_STATUSES.includes(getReleaseStatus(events))
}

export function getPlannedReleaseDate(
  events: ReleaseEventLike[],
): { date: string; precision: string } | null {
  const planned = events
    .filter(event => event.type === 'EXPECTED_RELEASE' || event.type === 'DELAY')
    .filter(event => event.newDate !== null)
    .sort(byOccurredAtAsc)
  const latest = planned[planned.length - 1]
  if (!latest?.newDate) return null
  return { date: latest.newDate, precision: latest.datePrecision ?? 'MONTH' }
}

function monthDiff(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear ?? 0) * 12 + (toMonth ?? 0) - ((fromYear ?? 0) * 12 + (fromMonth ?? 0))
}

export function getDelayMonths(events: ReleaseEventLike[]): number {
  const initial = events
    .filter(event => event.type === 'EXPECTED_RELEASE' && event.newDate !== null)
    .sort(byOccurredAtAsc)[0]
  const planned = getPlannedReleaseDate(events)
  if (!initial?.newDate || !planned) return 0
  return Math.max(0, monthDiff(initial.newDate, planned.date))
}

export function getDelayHistory(
  events: ReleaseEventLike[],
): Array<{ oldDate: string | null; newDate: string | null; occurredAt: string }> {
  return events
    .filter(event => event.type === 'DELAY')
    .sort(byOccurredAtAsc)
    .map(event => ({ oldDate: event.oldDate, newDate: event.newDate, occurredAt: event.occurredAt }))
}
