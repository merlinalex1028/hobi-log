import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppSettingsStore } from './app-settings'

describe('useAppSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('默认币种回退 CNY，订单默认视图为沿用上次', () => {
    const store = useAppSettingsStore()
    expect(store.defaultCurrency).toBe('CNY')
    expect(store.orderDefaultView).toBe('last-used')
  })

  it('读取 localStorage 中的合法值', () => {
    localStorage.setItem('hobilog:default-currency', 'JPY')
    localStorage.setItem('hobilog:order-default-view', 'grid')
    localStorage.setItem('hobilog:time-zone', 'Asia/Tokyo')
    const store = useAppSettingsStore()
    expect(store.defaultCurrency).toBe('JPY')
    expect(store.orderDefaultView).toBe('grid')
    expect(store.timeZone).toBe('Asia/Tokyo')
  })

  it('非法持久化值回退默认', () => {
    localStorage.setItem('hobilog:default-currency', 'EUR')
    localStorage.setItem('hobilog:order-default-view', 'timeline')
    const store = useAppSettingsStore()
    expect(store.defaultCurrency).toBe('CNY')
    expect(store.orderDefaultView).toBe('last-used')
  })

  it('setter 写回 localStorage', async () => {
    const store = useAppSettingsStore()
    store.setDefaultCurrency('JPY')
    store.setTimeZone('UTC')
    store.setOrderDefaultView('table')
    await nextTick()
    expect(localStorage.getItem('hobilog:default-currency')).toBe('JPY')
    expect(localStorage.getItem('hobilog:time-zone')).toBe('UTC')
    expect(localStorage.getItem('hobilog:order-default-view')).toBe('table')
  })
})
