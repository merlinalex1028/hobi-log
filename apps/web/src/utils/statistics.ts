import type { CurrencyAmountVo, DimensionStatVo, MonthlyPaymentVo } from '@/types/models'

export function uniqueCurrencies(groups: CurrencyAmountVo[][]): string[] {
  const set = new Set<string>()
  for (const group of groups) {
    for (const item of group) set.add(item.currency)
  }
  return [...set].sort()
}

export function amountFor(amounts: CurrencyAmountVo[], currency: string): number {
  return amounts.find(item => item.currency === currency)?.amount ?? 0
}

export function mergeCurrencyAmounts(groups: CurrencyAmountVo[][]): CurrencyAmountVo[] {
  const totals = new Map<string, number>()
  for (const group of groups) {
    for (const item of group) {
      totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount)
    }
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

export function sumMonthlyNetPaid(rows: MonthlyPaymentVo[], monthPrefix = ''): CurrencyAmountVo[] {
  return mergeCurrencyAmounts(
    rows
      .filter(row => row.month.startsWith(monthPrefix))
      .map(row => [{ currency: row.currency, amount: row.netPaidAmount }]),
  )
}

export function recentMonths(count: number, today: Date = new Date()): string[] {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()
  const months: string[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(Date.UTC(year, month - offset, 1))
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export function filterByMonths<T extends { month: string }>(rows: T[], months: string[]): T[] {
  const allowed = new Set(months)
  return rows.filter(row => allowed.has(row.month))
}

export function sortDimensionStats(rows: DimensionStatVo[], currency: string): DimensionStatVo[] {
  return [...rows].sort((left, right) => {
    const diff = amountFor(right.amount, currency) - amountFor(left.amount, currency)
    return diff !== 0 ? diff : left.label.localeCompare(right.label)
  })
}
