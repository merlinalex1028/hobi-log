import type { EChartsOption } from 'echarts'
import type { CurrencyAmountVo, DimensionStatVo, FuturePaymentVo, MonthlyPaymentVo } from '@/types/models'
import { amountFor, uniqueCurrencies } from './statistics'

export const CURRENCY_COLORS: Record<string, string> = {
  CNY: '#d14b4b',
  JPY: '#3d5fd8',
  USD: '#2f9e63',
  HKD: '#c98a2e',
}

const FALLBACK_COLORS = ['#7a5af5', '#00a3b4', '#e07b39', '#8a8f98'] as const

export function currencyColor(currency: string, index = 0): string {
  return CURRENCY_COLORS[currency] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length] ?? '#8a8f98'
}

type SingleSeries = Exclude<NonNullable<EChartsOption['series']>, readonly unknown[]>

export interface CurrencySeries {
  currency: string
  values: number[]
}

export function toCurrencySeries(rows: CurrencyAmountVo[][], currencies: string[]): CurrencySeries[] {
  return currencies.map(currency => ({
    currency,
    values: rows.map(amounts => amountFor(amounts, currency)),
  }))
}

function barSeries(name: string, values: number[], color: string, stack?: string): SingleSeries {
  return { name, type: 'bar', data: values, itemStyle: { color }, ...(stack ? { stack } : {}) }
}

function lineSeries(name: string, values: number[], color: string): SingleSeries {
  return {
    name,
    type: 'line',
    data: values,
    smooth: true,
    symbolSize: 6,
    itemStyle: { color },
    lineStyle: { type: 'dashed', color },
  }
}

const BASE_GRID = { left: 8, right: 16, top: 36, bottom: 8, containLabel: true } as const

export function buildGroupedBarOption(params: {
  labels: string[]
  series: CurrencySeries[]
  stack?: boolean
}): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: params.series.map(item => item.currency) },
    grid: BASE_GRID,
    xAxis: { type: 'category', data: params.labels },
    yAxis: { type: 'value' },
    series: params.series.map((item, index) =>
      barSeries(item.currency, item.values, currencyColor(item.currency, index), params.stack ? 'total' : undefined),
    ),
  }
}

export function buildFuturePaymentOption(rows: FuturePaymentVo[]): EChartsOption {
  const currencies = uniqueCurrencies(rows.map(row => row.byCurrency))
  return buildGroupedBarOption({
    labels: rows.map(row => row.month),
    series: toCurrencySeries(
      rows.map(row => row.byCurrency),
      currencies,
    ),
    stack: true,
  })
}

export function buildMonthlyTrendOption(rows: MonthlyPaymentVo[]): EChartsOption {
  const months = [...new Set(rows.map(row => row.month))].sort()
  const currencies = [...new Set(rows.map(row => row.currency))].sort()
  const byMonthCurrency = new Map(rows.map(row => [`${row.month}|${row.currency}`, row]))

  const series: SingleSeries[] = []
  currencies.forEach((currency, index) => {
    const color = currencyColor(currency, index)
    const paid = months.map(month => byMonthCurrency.get(`${month}|${currency}`)?.netPaidAmount ?? 0)
    const order = months.map(month => byMonthCurrency.get(`${month}|${currency}`)?.orderAmount ?? 0)
    series.push(barSeries(`${currency} 实付净额`, paid, color))
    series.push(lineSeries(`${currency} 订单规模`, order, color))
  })

  return {
    tooltip: { trigger: 'axis' },
    legend: {},
    grid: BASE_GRID,
    xAxis: { type: 'category', data: months },
    yAxis: { type: 'value' },
    series,
  }
}

export function buildDimensionOption(rows: DimensionStatVo[], limit = 10): EChartsOption {
  const top = rows.slice(0, limit)
  const currencies = uniqueCurrencies(top.map(row => row.amount))
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {},
    grid: { ...BASE_GRID, right: 24 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: top.map(row => row.label) },
    series: currencies.map((currency, index) =>
      barSeries(
        currency,
        top.map(row => amountFor(row.amount, currency)),
        currencyColor(currency, index),
        'total',
      ),
    ),
  }
}
