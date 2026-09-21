import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@hobilog/shared'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const CURRENCY_KEY = 'hobilog:default-currency'
const TIME_ZONE_KEY = 'hobilog:time-zone'
const VIEW_KEY = 'hobilog:order-default-view'

export const TIME_ZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai（UTC+8）' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo（UTC+9）' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong（UTC+8）' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles（UTC-8）' },
  { value: 'Europe/London', label: 'Europe/London（UTC+0）' },
  { value: 'UTC', label: 'UTC' },
] as const

export const ORDER_DEFAULT_VIEWS = [
  { value: 'last-used' as const, label: '沿用上次（当前视图）' },
  { value: 'table' as const, label: '表格' },
  { value: 'grid' as const, label: '卡片' },
]

export type OrderDefaultView = (typeof ORDER_DEFAULT_VIEWS)[number]['value']

function readStorage(key: string): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
}

function readCurrency(): string {
  const stored = readStorage(CURRENCY_KEY)
  return stored && (SUPPORTED_CURRENCIES as readonly string[]).includes(stored) ? stored : DEFAULT_CURRENCY
}

function readTimeZone(): string {
  const stored = readStorage(TIME_ZONE_KEY)
  if (stored) return stored
  return typeof Intl === 'undefined' ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone
}

function readOrderDefaultView(): OrderDefaultView {
  const stored = readStorage(VIEW_KEY)
  return stored === 'table' || stored === 'grid' ? stored : 'last-used'
}

export const useAppSettingsStore = defineStore('app-settings', () => {
  const defaultCurrency = ref(readCurrency())
  const timeZone = ref(readTimeZone())
  const orderDefaultView = ref<OrderDefaultView>(readOrderDefaultView())

  watch(defaultCurrency, value => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CURRENCY_KEY, value)
  })
  watch(timeZone, value => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TIME_ZONE_KEY, value)
  })
  watch(orderDefaultView, value => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(VIEW_KEY, value)
  })

  function setDefaultCurrency(value: string): void {
    defaultCurrency.value = value
  }

  function setTimeZone(value: string): void {
    timeZone.value = value
  }

  function setOrderDefaultView(value: OrderDefaultView): void {
    orderDefaultView.value = value
  }

  return {
    defaultCurrency,
    timeZone,
    orderDefaultView,
    setDefaultCurrency,
    setTimeZone,
    setOrderDefaultView,
  }
})
