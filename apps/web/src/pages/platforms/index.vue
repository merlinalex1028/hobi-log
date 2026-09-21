<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import type { CreatePlatformPayload, PlatformListParams } from '@/api/platform.api'
import {
  createPlatform,
  createPresets,
  deletePlatform,
  getPlatformList,
  updatePlatform,
} from '@/api/platform.api'
import { queryKeys } from '@/api/query-keys'
import type { CreateStorePayload, StoreListParams } from '@/api/store.api'
import { createStore, deleteStore, getStoreList, updateStore } from '@/api/store.api'
import AppQueryState from '@/components/common/AppQueryState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import PlatformList from '@/components/platform/PlatformList.vue'
import StoreList from '@/components/platform/StoreList.vue'
import { useInvalidate } from '@/composables/useInvalidate'

const OPTION_PAGE_SIZE = 100
const STORE_PAGE_SIZE = 20

const invalidate = useInvalidate()

const selectedPlatformId = ref<string | null>(null)
const storePage = ref(1)
const message = ref('')

const platformParams = computed<PlatformListParams>(() => ({ page: 1, pageSize: OPTION_PAGE_SIZE }))

const {
  data: platformPage,
  isLoading: platformsLoading,
  isError: platformsError,
  refetch: refetchPlatforms,
} = useQuery({
  queryKey: computed(() => queryKeys.platforms.list({ ...platformParams.value })),
  queryFn: () => getPlatformList(platformParams.value),
})

const storeParams = computed<StoreListParams>(() => ({
  page: storePage.value,
  pageSize: STORE_PAGE_SIZE,
  platformId: selectedPlatformId.value ?? undefined,
}))

const {
  data: storePageData,
  isLoading: storesLoading,
  isError: storesError,
  refetch: refetchStores,
} = useQuery({
  queryKey: computed(() => queryKeys.stores.list({ ...storeParams.value })),
  queryFn: () => getStoreList(storeParams.value),
})

const platforms = computed(() => platformPage.value?.items ?? [])
const stores = computed(() => storePageData.value?.items ?? [])
const storeTotal = computed(() => storePageData.value?.total ?? 0)

async function invalidatePlatforms(): Promise<void> {
  await invalidate('platform')
}

const createPlatformMutation = useMutation({
  mutationFn: (payload: CreatePlatformPayload) => createPlatform(payload),
  onSuccess: invalidatePlatforms,
})

const updatePlatformMutation = useMutation({
  mutationFn: ({ id, payload }: { id: string; payload: CreatePlatformPayload }) =>
    updatePlatform(id, payload),
  onSuccess: invalidatePlatforms,
})

const deletePlatformMutation = useMutation({
  mutationFn: (id: string) => deletePlatform(id),
  onSuccess: invalidatePlatforms,
})

const importPresetsMutation = useMutation({
  mutationFn: createPresets,
  onSuccess: async result => {
    message.value = `已导入 ${result.created} 个预置平台`
    await invalidatePlatforms()
  },
})

const createStoreMutation = useMutation({
  mutationFn: (payload: CreateStorePayload) => createStore(payload),
  onSuccess: invalidatePlatforms,
})

const updateStoreMutation = useMutation({
  mutationFn: ({ id, payload }: { id: string; payload: CreateStorePayload }) => updateStore(id, payload),
  onSuccess: invalidatePlatforms,
})

const deleteStoreMutation = useMutation({
  mutationFn: (id: string) => deleteStore(id),
  onSuccess: invalidatePlatforms,
})

function selectPlatform(id: string): void {
  selectedPlatformId.value = selectedPlatformId.value === id ? null : id
  storePage.value = 1
}

async function retry(): Promise<void> {
  await Promise.all([refetchPlatforms(), refetchStores()])
}
</script>

<template>
  <div>
    <AppPageHeader title="平台 / 店铺" description="维护购买渠道，供订单与统计使用" />

    <p v-if="message" class="text-secondary">{{ message }}</p>

    <AppQueryState
      :error="platformsError || storesError"
      :loading="platformsLoading || storesLoading"
      :rows="6"
      @retry="retry"
    >
      <div class="platform-page">
        <section class="app-card">
          <PlatformList
            :platforms="platforms"
            :selected-id="selectedPlatformId"
            @select="selectPlatform"
            @create="payload => createPlatformMutation.mutate(payload)"
            @update="(id, payload) => updatePlatformMutation.mutate({ id, payload })"
            @remove="id => deletePlatformMutation.mutate(id)"
            @import-presets="importPresetsMutation.mutate()"
          />
        </section>

        <section class="app-card">
          <StoreList
            :stores="stores"
            :platforms="platforms"
            :platform-id="selectedPlatformId"
            :total="storeTotal"
            :page="storePage"
            :page-size="STORE_PAGE_SIZE"
            @create="payload => createStoreMutation.mutate(payload)"
            @update="(id, payload) => updateStoreMutation.mutate({ id, payload })"
            @remove="id => deleteStoreMutation.mutate(id)"
            @page-change="next => (storePage = next)"
          />
        </section>
      </div>
    </AppQueryState>
  </div>
</template>

<style scoped>
.platform-page {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 16px;
  align-items: start;
}

@media (max-width: 1024px) {
  .platform-page {
    grid-template-columns: 1fr;
  }
}
</style>
