<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { queryKeys } from '@/api/query-keys'
import { getDashboard } from '@/api/statistics.api'
import AppQueryState from '@/components/common/AppQueryState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import AppSection from '@/components/common/AppSection.vue'
import DashboardGreeting from '@/components/dashboard/DashboardGreeting.vue'
import DashboardKpiGrid from '@/components/dashboard/DashboardKpiGrid.vue'
import FuturePaymentChart from '@/components/chart/FuturePaymentChart.vue'
import RecentOrderPanel from '@/components/dashboard/RecentOrderPanel.vue'
import ShippingPanel from '@/components/dashboard/ShippingPanel.vue'
import TodoPanel from '@/components/dashboard/TodoPanel.vue'
import UpcomingReleasePanel from '@/components/dashboard/UpcomingReleasePanel.vue'

const router = useRouter()

const {
  data: dashboard,
  isLoading,
  isError,
  refetch,
} = useQuery({ queryKey: queryKeys.dashboard, queryFn: getDashboard })

const todoCount = computed(() => dashboard.value?.todos.length ?? 0)

async function retry(): Promise<void> {
  await refetch()
}

function openOrder(orderId: string): void {
  void router.push(`/orders/${orderId}`)
}

function navigate(path: string): void {
  void router.push(path)
}
</script>

<template>
  <div>
    <AppPageHeader title="首页" description="收藏的等待与到货一览" />

    <AppQueryState :error="isError" :loading="isLoading" @retry="retry">
      <template v-if="dashboard">
        <DashboardGreeting :todo-count="todoCount" />
        <DashboardKpiGrid :kpis="dashboard.kpis" @navigate="navigate" />

        <AppSection title="待办">
          <TodoPanel :todos="dashboard.todos" @open="openOrder" />
        </AppSection>

        <AppSection title="未来付款（按月份 / 币种）">
          <FuturePaymentChart :rows="dashboard.futurePayments" height="260px" />
        </AppSection>

        <div class="dashboard-panels">
          <AppSection title="即将出货">
            <UpcomingReleasePanel :items="dashboard.upcomingReleases" @open="openOrder" />
          </AppSection>
          <AppSection title="运输中">
            <ShippingPanel :items="dashboard.shipping" @open="openOrder" />
          </AppSection>
          <AppSection title="最近订单">
            <RecentOrderPanel :items="dashboard.recentOrders" @open="openOrder" />
          </AppSection>
        </div>
      </template>
    </AppQueryState>
  </div>
</template>

<style scoped>
.dashboard-panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  align-items: start;
}
</style>
