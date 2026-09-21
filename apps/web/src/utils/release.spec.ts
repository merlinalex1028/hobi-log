import { describe, expect, it } from 'vitest'
import type { OrderDetail } from '@/types/models'
import { delayMonthsBetween, diffMonths, planDateForForm, plannedReleaseOf, releaseMilestones, sortReleaseEventsAsc } from './release'

type ReleaseEvent = OrderDetail['releaseEvents'][number]

function event(partial: Partial<ReleaseEvent> & { id: string; occurredAt: string }): ReleaseEvent {
  return {
    type: 'EXPECTED_RELEASE',
    label: '预计出货',
    oldDate: null,
    newDate: null,
    datePrecision: null,
    source: null,
    sourceUrl: null,
    note: null,
    ...partial,
  }
}

describe('diffMonths', () => {
  it('跨年计算月份差', () => {
    expect(diffMonths('2027-05-01', '2027-08-01')).toBe(3)
    expect(diffMonths('2027-11-01', '2028-02-01')).toBe(3)
  })

  it('同月为 0，提前为负', () => {
    expect(diffMonths('2027-05-01', '2027-05-20')).toBe(0)
    expect(diffMonths('2027-05-01', '2027-03-01')).toBe(-2)
  })

  it('接受 YYYY-MM', () => {
    expect(diffMonths('2027-05', '2027-06')).toBe(1)
  })
})

describe('delayMonthsBetween', () => {
  it('延期 2 个月', () => {
    expect(delayMonthsBetween('2027-05-01', '2027-07-01')).toBe(2)
  })
})

describe('sortReleaseEventsAsc', () => {
  it('按 occurredAt 升序，不修改入参', () => {
    const input = [
      event({ id: 'b', occurredAt: '2026-02-01T00:00:00.000Z' }),
      event({ id: 'a', occurredAt: '2026-01-01T00:00:00.000Z' }),
    ]
    expect(sortReleaseEventsAsc(input).map(entry => entry.id)).toEqual(['a', 'b'])
    expect(input.map(entry => entry.id)).toEqual(['b', 'a'])
  })
})

describe('plannedReleaseOf', () => {
  it('没有任何预计记录时返回空计划', () => {
    expect(plannedReleaseOf([])).toEqual({ date: null, precision: 'MONTH' })
    expect(plannedReleaseOf([event({ id: 'r', occurredAt: '2026-01-01T00:00:00.000Z', type: 'RELEASED' })])).toEqual({
      date: null,
      precision: 'MONTH',
    })
  })

  it('取最近一次 EXPECTED_RELEASE / DELAY', () => {
    const planned = plannedReleaseOf([
      event({ id: 'e1', occurredAt: '2026-01-01T00:00:00.000Z', newDate: '2027-05-01', datePrecision: 'MONTH' }),
      event({
        id: 'd1',
        occurredAt: '2026-03-01T00:00:00.000Z',
        type: 'DELAY',
        oldDate: '2027-05-01',
        newDate: '2027-09-01',
        datePrecision: 'MONTH',
      }),
    ])
    expect(planned).toEqual({ date: '2027-09-01', precision: 'MONTH' })
  })

  it('newDate 为空的延期事件不参与计算', () => {
    const planned = plannedReleaseOf([
      event({ id: 'e1', occurredAt: '2026-01-01T00:00:00.000Z', newDate: '2027-05-01', datePrecision: 'DAY' }),
      event({ id: 'd1', occurredAt: '2026-03-01T00:00:00.000Z', type: 'DELAY', newDate: null }),
    ])
    expect(planned).toEqual({ date: '2027-05-01', precision: 'DAY' })
  })
})

describe('releaseMilestones', () => {
  it('只返回 RELEASED / STORE_ARRIVED', () => {
    const milestones = releaseMilestones([
      event({ id: 'e1', occurredAt: '2026-01-01T00:00:00.000Z' }),
      event({ id: 'r1', occurredAt: '2026-02-01T00:00:00.000Z', type: 'RELEASED' }),
      event({ id: 's1', occurredAt: '2026-03-01T00:00:00.000Z', type: 'STORE_ARRIVED' }),
    ])
    expect(milestones.map(entry => entry.id)).toEqual(['r1', 's1'])
  })
})

describe('planDateForForm', () => {
  it('MONTH 精度截断到月，DAY 精度截断到日', () => {
    expect(planDateForForm('2027-05-01', 'MONTH')).toBe('2027-05')
    expect(planDateForForm('2027-05-01', 'DAY')).toBe('2027-05-01')
  })

  it('空值返回空字符串', () => {
    expect(planDateForForm(null, 'MONTH')).toBe('')
  })
})
