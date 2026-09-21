import type { DimensionStatVo, MonthlyPaymentVo } from '@/types/models'
import { describe, expect, it } from 'vitest'
import {
  amountFor,
  filterByMonths,
  mergeCurrencyAmounts,
  recentMonths,
  sortDimensionStats,
  sumMonthlyNetPaid,
  uniqueCurrencies,
} from './statistics'

function monthly(overrides: Partial<MonthlyPaymentVo> = {}): MonthlyPaymentVo {
  return {
    month: '2026-09',
    currency: 'CNY',
    paidAmount: 0,
    refundAmount: 0,
    netPaidAmount: 0,
    orderAmount: 0,
    ...overrides,
  }
}

function dimension(overrides: Partial<DimensionStatVo> = {}): DimensionStatVo {
  return { key: 'k', label: 'k', amount: [], orderCount: 0, itemCount: 0, ...overrides }
}

describe('utils/statistics', () => {
  it('uniqueCurrencies 去重并排序', () => {
    expect(
      uniqueCurrencies([
        [{ currency: 'JPY', amount: 1 }, { currency: 'CNY', amount: 2 }],
        [{ currency: 'CNY', amount: 3 }],
      ]),
    ).toEqual(['CNY', 'JPY'])
  })

  it('amountFor 找不到币种返回 0', () => {
    expect(amountFor([{ currency: 'JPY', amount: 100 }], 'CNY')).toBe(0)
    expect(amountFor([{ currency: 'CNY', amount: 100 }], 'CNY')).toBe(100)
  })

  it('mergeCurrencyAmounts 按币种相加，不跨币种合并', () => {
    expect(
      mergeCurrencyAmounts([
        [{ currency: 'CNY', amount: 100 }, { currency: 'JPY', amount: 5000 }],
        [{ currency: 'CNY', amount: 50 }],
      ]),
    ).toEqual([
      { currency: 'CNY', amount: 150 },
      { currency: 'JPY', amount: 5000 },
    ])
  })

  it('sumMonthlyNetPaid 只统计实付净额，可按年份前缀过滤', () => {
    const rows = [
      monthly({ month: '2025-12', currency: 'CNY', netPaidAmount: 300, paidAmount: 400 }),
      monthly({ month: '2026-01', currency: 'CNY', netPaidAmount: 100 }),
      monthly({ month: '2026-02', currency: 'JPY', netPaidAmount: 20000 }),
    ]
    expect(sumMonthlyNetPaid(rows)).toEqual([
      { currency: 'CNY', amount: 400 },
      { currency: 'JPY', amount: 20000 },
    ])
    expect(sumMonthlyNetPaid(rows, '2026')).toEqual([
      { currency: 'CNY', amount: 100 },
      { currency: 'JPY', amount: 20000 },
    ])
  })

  it('recentMonths 返回按时间升序的 N 个月', () => {
    expect(recentMonths(3, new Date('2026-01-15T00:00:00Z'))).toEqual(['2025-11', '2025-12', '2026-01'])
    expect(recentMonths(2, new Date('2026-03-31T00:00:00Z'))).toEqual(['2026-02', '2026-03'])
  })

  it('filterByMonths 只保留指定月份', () => {
    const rows = [monthly({ month: '2026-01' }), monthly({ month: '2026-02' }), monthly({ month: '2026-03' })]
    expect(filterByMonths(rows, ['2026-02', '2026-03']).map(row => row.month)).toEqual(['2026-02', '2026-03'])
  })

  it('sortDimensionStats 按指定币种金额倒序，缺失币种视为 0', () => {
    const rows = [
      dimension({ key: 'b', label: 'B', amount: [{ currency: 'CNY', amount: 100 }] }),
      dimension({ key: 'a', label: 'A', amount: [{ currency: 'CNY', amount: 300 }] }),
      dimension({ key: 'c', label: 'C', amount: [{ currency: 'JPY', amount: 9000 }] }),
    ]
    expect(sortDimensionStats(rows, 'CNY').map(row => row.label)).toEqual(['A', 'B', 'C'])
    expect(sortDimensionStats(rows, 'JPY').map(row => row.label)).toEqual(['C', 'A', 'B'])
  })

  it('sortDimensionStats 金额相同时按名称排序且不改动入参', () => {
    const rows = [
      dimension({ key: 'b', label: 'B', amount: [{ currency: 'CNY', amount: 10 }] }),
      dimension({ key: 'a', label: 'A', amount: [{ currency: 'CNY', amount: 10 }] }),
    ]
    expect(sortDimensionStats(rows, 'CNY').map(row => row.label)).toEqual(['A', 'B'])
    expect(rows.map(row => row.label)).toEqual(['B', 'A'])
  })
})
