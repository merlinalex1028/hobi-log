import type { ReleaseEventLike } from './types'
import {
  getDelayHistory,
  getDelayMonths,
  getPlannedReleaseDate,
  getReleaseStatus,
  isReleased,
} from './release'

const event = (patch: Partial<ReleaseEventLike>): ReleaseEventLike => ({
  id: 'e1',
  type: 'EXPECTED_RELEASE',
  oldDate: null,
  newDate: '2027-01-01',
  datePrecision: 'MONTH',
  occurredAt: '2026-09-18T00:00:00.000Z',
  ...patch,
})

const delay = (patch: Partial<ReleaseEventLike> = {}) =>
  event({
    id: 'e-delay',
    type: 'DELAY',
    oldDate: '2027-01-01',
    newDate: '2027-05-01',
    occurredAt: '2027-01-05T00:00:00.000Z',
    ...patch,
  })

describe('getReleaseStatus', () => {
  it.each([
    ['无事件', [] as ReleaseEventLike[], 'UNKNOWN'],
    ['EXPECTED_RELEASE', [event({})], 'WAITING_RELEASE'],
    ['DELAY', [event({}), delay({ newDate: '2027-03-01' })], 'DELAYED'],
    [
      'RELEASED',
      [event({}), delay(), event({ id: 'e2', type: 'RELEASED', newDate: '2027-05-16' })],
      'RELEASED',
    ],
    [
      'STORE_ARRIVED',
      [event({ type: 'RELEASED' }), event({ id: 'e2', type: 'STORE_ARRIVED' })],
      'STORE_ARRIVED',
    ],
    [
      'SHIPMENT_READY',
      [event({ type: 'STORE_ARRIVED' }), event({ id: 'e2', type: 'SHIPMENT_READY' })],
      'READY_TO_SHIP',
    ],
  ])('%s → %s', (_name, events, expected) => {
    expect(getReleaseStatus(events)).toBe(expected)
  })

  it('进度序优先于时间序：后记录的 DELAY 不回退已 RELEASED', () => {
    expect(
      getReleaseStatus([
        event({ id: 'e2', type: 'RELEASED', occurredAt: '2027-05-16T00:00:00.000Z' }),
        delay({ occurredAt: '2027-05-20T00:00:00.000Z' }),
      ]),
    ).toBe('RELEASED')
  })
})

describe('getPlannedReleaseDate', () => {
  it('取最后一次调整后的日期与精度', () => {
    expect(
      getPlannedReleaseDate([
        event({}),
        delay({ occurredAt: '2027-01-05T00:00:00.000Z' }),
        delay({
          id: 'e3',
          oldDate: '2027-05-01',
          newDate: '2027-07-18',
          datePrecision: 'DAY',
          occurredAt: '2027-03-05T00:00:00.000Z',
        }),
      ]),
    ).toEqual({ date: '2027-07-18', precision: 'DAY' })
  })

  it('无计划事件 → null', () => {
    expect(getPlannedReleaseDate([])).toBeNull()
  })
})

describe('getDelayMonths', () => {
  it('按初始预计 → 最新预计的月份差', () => {
    expect(getDelayMonths([event({}), delay()])).toBe(4)
  })

  it('多次延期不重复累加', () => {
    expect(
      getDelayMonths([
        event({}),
        delay({ newDate: '2027-03-01', occurredAt: '2027-01-05T00:00:00.000Z' }),
        delay({
          id: 'e3',
          oldDate: '2027-03-01',
          newDate: '2027-05-01',
          occurredAt: '2027-03-05T00:00:00.000Z',
        }),
      ]),
    ).toBe(4)
  })

  it('无延期 → 0', () => {
    expect(getDelayMonths([event({})])).toBe(0)
  })
})

describe('getDelayHistory', () => {
  it('按发生时间升序返回 Δ 记录', () => {
    const history = getDelayHistory([
      delay({
        id: 'late',
        oldDate: '2027-03-01',
        newDate: '2027-05-01',
        occurredAt: '2027-03-05T00:00:00.000Z',
      }),
      delay({ id: 'early', occurredAt: '2027-01-05T00:00:00.000Z' }),
    ])
    expect(history.map(item => item.oldDate)).toEqual(['2027-01-01', '2027-03-01'])
  })
})

describe('isReleased', () => {
  it.each([
    ['RELEASED', true],
    ['STORE_ARRIVED', true],
    ['SHIPMENT_READY', true],
    ['DELAY', false],
    ['EXPECTED_RELEASE', false],
  ])('%s → %s', (type, expected) => {
    expect(isReleased([event({ type })])).toBe(expected)
  })
})
