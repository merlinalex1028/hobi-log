import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'hobilog:order-view'

export type OrderView = 'table' | 'grid'

function readStoredView(): OrderView {
  const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
  return stored === 'grid' ? 'grid' : 'table'
}

export const useViewPreferenceStore = defineStore('view-preference', () => {
  const orderView = ref<OrderView>(readStoredView())

  watch(orderView, value => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, value)
  })

  function setOrderView(value: OrderView): void {
    orderView.value = value
  }

  return { orderView, setOrderView }
})
