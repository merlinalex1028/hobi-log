<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { getCollectionList, getCollectionStats } from '@/api/collection.api'
import { queryKeys } from '@/api/query-keys'
import CollectionFilterBar from '@/components/collection/CollectionFilterBar.vue'
import CollectionGrid from '@/components/collection/CollectionGrid.vue'
import CollectionStats from '@/components/collection/CollectionStats.vue'
import AppEmpty from '@/components/common/AppEmpty.vue'
import AppQueryState from '@/components/common/AppQueryState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import {
  DEFAULT_COLLECTION_FILTER,
  filterCollectionItems,
  type CollectionFilterState,
} from '@/utils/collection'

const router = useRouter()

const page = ref(1)
const pageSize = ref(20)
const filter = ref<CollectionFilterState>({ ...DEFAULT_COLLECTION_FILTER })

const listParams = computed(() => ({ page: page.value, pageSize: pageSize.value }))

const {
  data: listPage,
  isLoading,
  isError,
  refetch,
} = useQuery({
  queryKey: computed(() => queryKeys.collection.list(listParams.value)),
  queryFn: () => getCollectionList(listParams.value),
})

const { data: stats } = useQuery({
  queryKey: queryKeys.collection.stats,
  queryFn: getCollectionStats,
})

const allItems = computed(() => listPage.value?.items ?? [])
const items = computed(() => filterCollectionItems(allItems.value, filter.value))
const total = computed(() => listPage.value?.total ?? 0)

async function retry(): Promise<void> {
  await refetch()
}

async function onPageChange(next: number): Promise<void> {
  page.value = next
  await refetch()
}

function resetFilter(): void {
  filter.value = { ...DEFAULT_COLLECTION_FILTER }
}

function openOrder(orderId: string): void {
  void router.push(`/orders/${orderId}`)
}
</script>

<template>
  <div>
    <AppPageHeader title="收藏库" description="已签收的收藏（由订单推导）" />

    <CollectionStats v-if="stats" :stats="stats" />

    <CollectionFilterBar v-model="filter" @reset="resetFilter" />

    <AppQueryState :error="isError" :loading="isLoading" :rows="6" @retry="retry">
      <AppEmpty
        v-if="allItems.length === 0"
        title="还没有已入库的收藏"
        description="订单全部签收后，商品会出现在这里。"
        action-text="去看订单"
        @action="router.push('/orders')"
      />
      <template v-else>
        <AppEmpty
          v-if="items.length === 0"
          title="当前页没有匹配的收藏"
          description="试试清空筛选条件。"
          action-text="重置筛选"
          @action="resetFilter"
        />
        <CollectionGrid v-else :items="items" @open="openOrder" />

        <el-pagination
          v-if="total > pageSize"
          class="collection-pagination"
          layout="prev, pager, next, total"
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          @current-change="onPageChange"
        />
      </template>
    </AppQueryState>
  </div>
</template>

<style scoped>
.collection-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
