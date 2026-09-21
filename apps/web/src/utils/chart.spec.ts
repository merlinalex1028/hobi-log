import type { EChartsOption, SeriesOption } from 'echarts'
import type { DimensionStatVo, FuturePaymentVo, MonthlyPaymentVo } from '@/types/models'
import { describe, expect, it } from 'vitest'
import {
  buildDimensionOption,
  buildFuturePaymentOption,
  buildGroupedBarOption,
  buildMonthlyTrendOption,
  currencyColor,
} from './chart'

interface LooseSeries {
  name?: string
  type?: string
  data?: unknown
  stack?: string
}

function seriesOf(option: EChartsOption): LooseSeries[] {
  const series = option.series
  if (!series) return []
  const list: SeriesOption[] = Array.isArray(series) ? series : [series]
  return list as unknown as LooseSeries[]
}

function future(overrides: Partial<FuturePaymentVo> = {}): FuturePaymentVo {
  return { month: '2026-10', byCurrency: [], ...overrides }
}

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

describe('utils/chart', () => {
  it('currencyColor 命中预设币种，未知币种按序号取回退色', () => {
    expect(currencyColor('CNY')).toBe('#d14b4b')
    expect(currencyColor('JPY')).toBe('#3d5fd8')
    expect(currencyColor('EUR', 0)).toBe('#7a5af5')
    expect(currencyColor('EUR', 1)).toBe('#00a3b4')
    expect(currencyColor('EUR', 4)).toBe('#7a5af5')
  })

  it('buildFuturePaymentOption 按币种出多组柱，缺失币种补 0', () => {
    const option = buildFuturePaymentOption([
      future({ month: '2026-10', byCurrency: [{ currency: 'CNY', amount: 500 }] }),
      future({ month: '2026-11', byCurrency: [{ currency: 'CNY', amount: 300 }, { currency: 'JPY', amount: 9000 }] }),
    ])
    const series = seriesOf(option)
    expect(series.map(item => item.name)).toEqual(['CNY', 'JPY'])
    expect(series[0]?.data).toEqual([500, 300])
    expect(series[1]?.data).toEqual([0, 9000])
    expect(series.every(item => item.type === 'bar' && item.stack === 'total')).toBe(true)
  })

  it('buildMonthlyTrendOption 每个币种出「实付净额」柱 + 「订单规模」虚线', () => {
    const rows = [
      monthly({ month: '2026-09', currency: 'CNY', netPaidAmount: 1000, orderAmount: 1800 }),
      monthly({ month: '2026-10', currency: 'CNY', netPaidAmount: 200, orderAmount: 400 }),
      monthly({ month: '2026-09', currency: 'JPY', netPaidAmount: 20000, orderAmount: 30000 }),
    ]
    const option = buildMonthlyTrendOption(rows)
    const series = seriesOf(option)
    expect(series.map(item => item.name)).toEqual([
      'CNY 实付净额',
      'CNY 订单规模',
      'JPY 实付净额',
      'JPY 订单规模',
    ])
    expect(series[0]?.data).toEqual([1000, 200])
    expect(series[1]?.data).toEqual([1800, 400])
    expect(series[2]?.data).toEqual([20000, 0])
    expect(series[3]?.type).toBe('line')
  })

  it('buildDimensionOption 只取前 limit 行并堆叠多币种', () => {
    const rows = [
      dimension({ key: 'a', label: 'A', amount: [{ currency: 'CNY', amount: 1 }, { currency: 'JPY', amount: 2 }] }),
      dimension({ key: 'b', label: 'B', amount: [{ currency: 'CNY', amount: 3 }] }),
      dimension({ key: 'c', label: 'C', amount: [{ currency: 'CNY', amount: 4 }] }),
    ]
    const option = buildDimensionOption(rows, 2)
    const series = seriesOf(option)
    expect(series.map(item => item.name)).toEqual(['CNY', 'JPY'])
    expect(series[0]?.data).toEqual([1, 3])
    expect(series[1]?.data).toEqual([2, 0])
    expect(series[0]?.stack).toBe('total')
  })

  it('buildGroupedBarOption 不堆叠时 stack 为 undefined', () => {
    const option = buildGroupedBarOption({
      labels: ['2026-09'],
      series: [{ currency: 'CNY', values: [1] }],
    })
    expect(seriesOf(option)[0]?.stack).toBeUndefined()
  })
})
