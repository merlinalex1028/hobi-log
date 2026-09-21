<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { useDebounceFn } from '@vueuse/core'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { getOrderList } from '@/api/order.api'
import { queryKeys } from '@/api/query-keys'
import AppEmpty from '@/components/common/AppEmpty.vue'
import AppQueryState from '@/components/common/AppQueryState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import OrderFilterBar from '@/components/order/OrderFilterBar.vue'
import OrderGrid from '@/components/order/OrderGrid.vue'
import OrderQuickTabs from '@/components/order/OrderQuickTabs.vue'
import OrderTable from '@/components/order/OrderTable.vue'
import OrderViewSwitch from '@/components/order/OrderViewSwitch.vue'
import { useOrderFilters, type OrderFilterState } from '@/composables/useOrderFilters'
import { useViewPreferenceStore } from '@/stores/view-preference'

const router = useRouter()
const viewPreference = useViewPreferenceStore()
const { filters, syncToRoute, reset, setTab } = useOrderFilters()

const params = computed(() => ({
  tab: filters.tab,
  keyword: filters.keyword || undefined,
  paymentSummaryStatus: filters.paymentSummaryStatus || undefined,
  platformId: filters.platformId || undefined,
  storeId: filters.storeId || undefined,
  manufacturer: filters.manufacturer || undefined,
  ipName: filters.ipName || undefined,
  characterName: filters.characterName || undefined,
  category: filters.category || undefined,
  year: filters.year,
  priceMin: filters.priceMin,
  priceMax: filters.priceMax,
  delayed: filters.delayed ? true : undefined,
  page: filters.page,
  pageSize: filters.pageSize,
}))

const { data, isLoading, isError, refetch } = useQuery({
  queryKey: computed(() => queryKeys.orders.list(params.value)),
  queryFn: () => getOrderList(params.value),
})

const total = computed(() => data.value?.total ?? 0)
const items = computed(() => data.value?.items ?? [])

const syncRoute = useDebounceFn(() => {
  void syncToRoute()
}, 300)

function onFiltersUpdate(next: OrderFilterState): void {
  Object.assign(filters, next)
  syncRoute()
}

function onQuickAction(_action: string, id: string): void {
  void router.push(`/orders/${id}`)
}
</script>

<template>
  <div>
    <AppPageHeader title="订单" description="管理所有正在等待到家的收藏">
      <template #actions>
        <el-button type="primary" @click="router.push('/orders/create')">新建订单</el-button>
      </template>
    </AppPageHeader>

    <OrderQuickTabs :model-value="filters.tab" @update:model-value="setTab" />
    <OrderFilterBar :model-value="filters" @update:model-value="onFiltersUpdate" @search="refetch" @reset="reset" />

    <div class="orders-toolbar">
      <span class="text-secondary">共 {{ total }} 条</span>
      <OrderViewSwitch :model-value="viewPreference.orderView" @update:model-value="viewPreference.setOrderView" />
    </div>

    <AppQueryState :error="isError" :loading="isLoading" @retry="refetch">
      <AppEmpty
        v-if="items.length === 0"
        title="还没有任何订单"
        description="把第一件正在等到家的收藏记录下来吧。"
        action-text="创建订单"
        @action="router.push('/orders/create')"
      />
      <template v-else>
        <OrderTable
          v-if="viewPreference.orderView === 'table'"
          :items="items"
          @view="id => router.push(`/orders/${id}`)"
          @edit="id => router.push(`/orders/${id}/edit`)"
          @mark-payment="id => onQuickAction('mark-payment', id)"
          @update-release="id => onQuickAction('update-release', id)"
          @add-shipment="id => onQuickAction('add-shipment', id)"
        />
        <OrderGrid
          v-else
          :items="items"
          @click="id => router.push(`/orders/${id}`)"
          @quick-action="onQuickAction"
        />

        <el-pagination
          class="orders-pagination"
          layout="prev, pager, next, sizes"
          :total="total"
          :current-page="filters.page"
          :page-size="filters.pageSize"
          @current-change="(page: number) => syncToRoute({ page })"
          @size-change="(pageSize: number) => syncToRoute({ pageSize, page: 1 })"
        />
      </template>
    </AppQueryState>
  </div>
</template>

<style scoped>
.orders-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 12px;
}

.orders-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
