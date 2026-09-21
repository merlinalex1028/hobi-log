import type { TagTone } from '@/constants/status'
import type { TimelineItem } from '@/types/models'

export type TimelineSource = TimelineItem['source']

export const TIMELINE_SOURCE_LABELS: Record<TimelineSource, string> = {
  PAYMENT: '付款',
  RELEASE: '出货',
  SHIPMENT: '物流',
  ORDER: '订单',
}

export const TIMELINE_SOURCE_TONES: Record<TimelineSource, TagTone> = {
  PAYMENT: 'success',
  RELEASE: 'primary',
  SHIPMENT: 'info',
  ORDER: 'warning',
}

export function sortTimelineDesc(items: TimelineItem[]): TimelineItem[] {
  return [...items].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.id < b.id ? 1 : -1
    return a.occurredAt < b.occurredAt ? 1 : -1
  })
}
