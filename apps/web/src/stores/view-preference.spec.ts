import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { useViewPreferenceStore } from './view-preference'

const STORAGE_KEY = 'hobilog:order-view'

describe('useViewPreferenceStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('默认使用表格视图', () => {
    expect(useViewPreferenceStore().orderView).toBe('table')
  })

  it('读取 localStorage 中保存的卡片视图', () => {
    localStorage.setItem(STORAGE_KEY, 'grid')
    expect(useViewPreferenceStore().orderView).toBe('grid')
  })

  it('非法持久化值回退表格视图', () => {
    localStorage.setItem(STORAGE_KEY, 'timeline')
    expect(useViewPreferenceStore().orderView).toBe('table')
  })

  it('setOrderView 写回 localStorage', async () => {
    const store = useViewPreferenceStore()
    store.setOrderView('grid')
    await nextTick()
    expect(store.orderView).toBe('grid')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('grid')
  })
})
