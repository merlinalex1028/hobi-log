import dayjs from 'dayjs'

const CURRENCY_SYMBOLS: Record<string, string> = { CNY: '¥', JPY: '¥', USD: '$', HKD: 'HK$' }

export function formatCurrency(amount: number, currency = 'CNY'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  const fractionDigits = currency === 'JPY' ? 0 : 2
  const value = amount.toLocaleString('zh-CN', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  return `${symbol}${value}`
}

export function formatDate(value: string | null | undefined, precision: 'DAY' | 'MONTH' = 'DAY'): string {
  if (!value) return ''
  return precision === 'MONTH' ? dayjs(value).format('YYYY年MM月') : dayjs(value).format('YYYY-MM-DD')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

export function toDatePrecision(value: string | null | undefined): 'DAY' | 'MONTH' {
  return value === 'MONTH' ? 'MONTH' : 'DAY'
}

export function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}
