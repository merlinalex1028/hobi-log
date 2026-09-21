import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface OrderFilterState {
  tab: string
  keyword: string
  paymentSummaryStatus: string
  platformId: string
  storeId: string
  manufacturer: string
  ipName: string
  characterName: string
  category: string
  year: number | undefined
  priceMin: number | undefined
  priceMax: number | undefined
  delayed: boolean
  page: number
  pageSize: number
}

export const DEFAULT_ORDER_FILTERS: OrderFilterState = {
  tab: 'ALL',
  keyword: '',
  paymentSummaryStatus: '',
  platformId: '',
  storeId: '',
  manufacturer: '',
  ipName: '',
  characterName: '',
  category: '',
  year: undefined,
  priceMin: undefined,
  priceMax: undefined,
  delayed: false,
  page: 1,
  pageSize: 20,
}

export function parseFiltersFromQuery(query: Record<string, unknown>): OrderFilterState {
  const numberOrUndefined = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const stringOrEmpty = (value: unknown): string => (typeof value === 'string' ? value : '')

  return {
    ...DEFAULT_ORDER_FILTERS,
    tab: stringOrEmpty(query.tab) || DEFAULT_ORDER_FILTERS.tab,
    keyword: stringOrEmpty(query.keyword),
    paymentSummaryStatus: stringOrEmpty(query.paymentSummaryStatus),
    platformId: stringOrEmpty(query.platformId),
    storeId: stringOrEmpty(query.storeId),
    manufacturer: stringOrEmpty(query.manufacturer),
    ipName: stringOrEmpty(query.ipName),
    characterName: stringOrEmpty(query.characterName),
    category: stringOrEmpty(query.category),
    year: numberOrUndefined(query.year),
    priceMin: numberOrUndefined(query.priceMin),
    priceMax: numberOrUndefined(query.priceMax),
    delayed: query.delayed === 'true' || query.delayed === true,
    page: numberOrUndefined(query.page) ?? 1,
    pageSize: numberOrUndefined(query.pageSize) ?? 20,
  }
}

export function toQuery(filters: OrderFilterState): Record<string, string> {
  const query: Record<string, string> = {}
  const pick = (key: keyof OrderFilterState, value: unknown) => {
    if (value === undefined || value === null || value === '' || value === false) return
    query[String(key)] = String(value)
  }
  pick('tab', filters.tab === 'ALL' ? '' : filters.tab)
  pick('keyword', filters.keyword)
  pick('paymentSummaryStatus', filters.paymentSummaryStatus)
  pick('platformId', filters.platformId)
  pick('storeId', filters.storeId)
  pick('manufacturer', filters.manufacturer)
  pick('ipName', filters.ipName)
  pick('characterName', filters.characterName)
  pick('category', filters.category)
  pick('year', filters.year)
  pick('priceMin', filters.priceMin)
  pick('priceMax', filters.priceMax)
  pick('delayed', filters.delayed ? 'true' : '')
  pick('page', filters.page > 1 ? filters.page : '')
  pick('pageSize', filters.pageSize !== 20 ? filters.pageSize : '')
  return query
}

export function useOrderFilters() {
  const route = useRoute()
  const router = useRouter()
  const filters = reactive<OrderFilterState>(parseFiltersFromQuery(route.query))

  const query = computed(() => toQuery(filters))

  async function syncToRoute(extra: Partial<OrderFilterState> = {}): Promise<void> {
    Object.assign(filters, extra)
    await router.replace({ query: query.value })
  }

  async function reset(): Promise<void> {
    Object.assign(filters, DEFAULT_ORDER_FILTERS)
    await router.replace({ query: {} })
  }

  async function setTab(tab: string): Promise<void> {
    await syncToRoute({ tab, page: 1 })
  }

  return { filters, query, parseFiltersFromQuery, toQuery, syncToRoute, reset, setTab }
}
