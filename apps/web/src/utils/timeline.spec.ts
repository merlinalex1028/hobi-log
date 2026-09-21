import { describe, expect, it } from 'vitest'
import type { TimelineItem } from '@/types/models'
import { sortTimelineDesc, TIMELINE_SOURCE_TONES } from './timeline'

function item(partial: Partial<TimelineItem> & { id: string; occurredAt: string }): TimelineItem {
  return {
    type: 'PAYMENT_PAID',
    title: partial.id,
    description: null,
    source: 'PAYMENT',
    ...partial,
  }
}

describe('sortTimelineDesc', () => {
  it('按 occurredAt 倒序，最新的在前', () => {
    const sorted = sortTimelineDesc([
      item({ id: 'a', occurredAt: '2026-01-01T00:00:00.000Z' }),
      item({ id: 'c', occurredAt: '2026-03-01T00:00:00.000Z' }),
      item({ id: 'b', occurredAt: '2026-02-01T00:00:00.000Z' }),
    ])
    expect(sorted.map(entry => entry.id)).toEqual(['c', 'b', 'a'])
  })

  it('时间相同时用 id 倒序，保证顺序稳定', () => {
    const sorted = sortTimelineDesc([
      item({ id: 'a', occurredAt: '2026-01-01T00:00:00.000Z' }),
      item({ id: 'b', occurredAt: '2026-01-01T00:00:00.000Z' }),
    ])
    expect(sorted.map(entry => entry.id)).toEqual(['b', 'a'])
  })

  it('不修改入参数组', () => {
    const input = [
      item({ id: 'a', occurredAt: '2026-01-01T00:00:00.000Z' }),
      item({ id: 'b', occurredAt: '2026-02-01T00:00:00.000Z' }),
    ]
    const sorted = sortTimelineDesc(input)
    expect(input.map(entry => entry.id)).toEqual(['a', 'b'])
    expect(sorted).not.toBe(input)
  })

  it('空数组返回空数组', () => {
    expect(sortTimelineDesc([])).toEqual([])
  })

  it('四种来源都有色调映射', () => {
    expect(Object.keys(TIMELINE_SOURCE_TONES).sort()).toEqual(['ORDER', 'PAYMENT', 'RELEASE', 'SHIPMENT'])
  })
})
