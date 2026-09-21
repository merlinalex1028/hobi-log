import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import type { ProductCategory } from '@hobilog/shared'
import { getProductList } from '@/api/product.api'
import { queryKeys } from '@/api/query-keys'
import type { ProductVo } from '@/types/models'

export interface ProductPickerFilters {
  keyword: string
  category: string
  manufacturer: string
}

export const PRODUCT_PICKER_PAGE_SIZE = 8

export function useProductPicker() {
  const filters = ref<ProductPickerFilters>({ keyword: '', category: '', manufacturer: '' })
  const page = ref(1)

  const params = computed(() => ({
    page: page.value,
    pageSize: PRODUCT_PICKER_PAGE_SIZE,
    keyword: filters.value.keyword || undefined,
    category: (filters.value.category || undefined) as ProductCategory | undefined,
    manufacturer: filters.value.manufacturer || undefined,
    status: 'ACTIVE' as const,
  }))

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: computed(() => queryKeys.products.list(params.value)),
    queryFn: () => getProductList(params.value),
  })

  watch(
    filters,
    () => {
      page.value = 1
    },
    { deep: true },
  )

  const items = computed<ProductVo[]>(() => data.value?.items ?? [])
  const total = computed(() => data.value?.total ?? 0)

  function nextPage(): void {
    if (page.value * PRODUCT_PICKER_PAGE_SIZE >= total.value) return
    page.value += 1
  }

  function prevPage(): void {
    if (page.value <= 1) return
    page.value -= 1
  }

  return { filters, page, pageSize: PRODUCT_PICKER_PAGE_SIZE, items, total, isLoading, isError, refetch, nextPage, prevPage }
}
