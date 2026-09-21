import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { createStore, getStoreList, type CreateStorePayload } from '@/api/store.api'
import { getPlatformList } from '@/api/platform.api'
import { queryKeys } from '@/api/query-keys'
import type { StoreVo } from '@/types/models'

const OPTIONS_PAGE_SIZE = 100

export function usePlatformStoreOptions(platformId: () => string) {
  const platformParams = computed(() => ({ page: 1, pageSize: OPTIONS_PAGE_SIZE }))

  const {
    data: platformPage,
    isLoading: platformsLoading,
    isError: platformsError,
  } = useQuery({
    queryKey: computed(() => queryKeys.platforms.list(platformParams.value)),
    queryFn: () => getPlatformList(platformParams.value),
  })

  const storeParams = computed(() => ({
    page: 1,
    pageSize: OPTIONS_PAGE_SIZE,
    platformId: platformId() || undefined,
  }))

  const {
    data: storePage,
    isLoading: storesLoading,
    isError: storesError,
    refetch: refetchStores,
  } = useQuery({
    queryKey: computed(() => queryKeys.stores.list(storeParams.value)),
    queryFn: () => getStoreList(storeParams.value),
  })

  const platforms = computed(() => platformPage.value?.items ?? [])
  const stores = computed(() => storePage.value?.items ?? [])

  async function createStoreInline(payload: CreateStorePayload): Promise<StoreVo> {
    const created = await createStore(payload)
    await refetchStores()
    return created
  }

  return {
    platforms,
    stores,
    platformsLoading,
    storesLoading,
    platformsError,
    storesError,
    refetchStores,
    createStoreInline,
  }
}
