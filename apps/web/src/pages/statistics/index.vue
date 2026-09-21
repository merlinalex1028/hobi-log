<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { getCollectionStats } from '@/api/collection.api'
import { queryKeys } from '@/api/query-keys'
import {
  getDimensionStatistics,
  getFuturePayments,
  getMonthlyPayments,
  type DimensionKey,
} from '@/api/statistics.api'
import AppEmpty from '@/components/common/AppEmpty.vue'
import AppErrorState from '@/components/common/AppErrorState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import AppSection from '@/components/common/AppSection.vue'
import CategoryChart from '@/components/statistics/CategoryChart.vue'
import FuturePaymentChart from '@/components/statistics/FuturePaymentChart.vue'
import IpRanking from '@/components/statistics/IpRanking.vue'
import ManufacturerChart from '@/components/statistics/ManufacturerChart.vue'
import PaymentTrendChart from '@/components/statistics/PaymentTrendChart.vue'
import PlatformChart from '@/components/statistics/PlatformChart.vue'
import StatisticsKpiGrid from '@/components/statistics/StatisticsKpiGrid.vue'
import { useAppSettingsStore } from '@/stores/app-settings'
import type { StatisticsKpi } from '@/types/forms'
import {
  filterByMonths,
  mergeCurrencyAmounts,
  recentMonths,
  sumMonthlyNetPaid,
  uniqueCurrencies,
} from '@/utils/statistics'

const ALL_TIME_FROM = '2000-01-01'
const TREND_MONTHS = 12

const router = useRouter()
const settings = useAppSettingsStore()

const today = new Date().toISOString().slice(0, 10)
const currentYear = new Date().getFullYear()

const monthlyParams = computed(() => ({ from: ALL_TIME_FROM, to: today }))
const futureParams = computed(() => ({ months: 12 }))
const trendMonths = computed(() => recentMonths(TREND_MONTHS))

const monthlyQuery = useQuery({
  queryKey: computed(() => queryKeys.statistics.monthly(monthlyParams.value)),
  queryFn: () => getMonthlyPayments(monthlyParams.value),
})

const futureQuery = useQuery({
  queryKey: computed(() => queryKeys.statistics.future(futureParams.value)),
  queryFn: () => getFuturePayments(futureParams.value),
})

const collectionQuery = useQuery({
  queryKey: queryKeys.collection.stats,
  queryFn: getCollectionStats,
})

function dimensionQuery(dimension: DimensionKey) {
  return useQuery({
    queryKey: computed(() => queryKeys.statistics.dimension(dimension, monthlyParams.value)),
    queryFn: () => getDimensionStatistics(dimension, monthlyParams.value),
  })
}

const categoriesQuery = dimensionQuery('categories')
const platformsQuery = dimensionQuery('platforms')
const manufacturersQuery = dimensionQuery('manufacturers')
const ipsQuery = dimensionQuery('ips')

const allQueries = [
  monthlyQuery,
  futureQuery,
  collectionQuery,
  categoriesQuery,
  platformsQuery,
  manufacturersQuery,
  ipsQuery,
]

const isLoading = computed(() => allQueries.some(query => query.isLoading.value))
const isError = computed(() => allQueries.some(query => query.isError.value))

async function retry(): Promise<void> {
  await Promise.all(allQueries.map(query => query.refetch()))
}

const monthlyRows = computed(() => monthlyQuery.data.value ?? [])
const trendRows = computed(() => filterByMonths(monthlyRows.value, trendMonths.value))
const futureRows = computed(() => futureQuery.data.value ?? [])
const categories = computed(() => categoriesQuery.data.value ?? [])
const platforms = computed(() => platformsQuery.data.value ?? [])
const manufacturers = computed(() => manufacturersQuery.data.value ?? [])
const ips = computed(() => ipsQuery.data.value ?? [])

const kpis = computed<StatisticsKpi[]>(() => [
  {
    key: 'totalPaid',
    title: '累计消费',
    description: '全部订单的实付净额（已扣退款）',
    amounts: sumMonthlyNetPaid(monthlyRows.value),
  },
  {
    key: 'yearPaid',
    title: `${currentYear} 年消费`,
    description: '按付款日期归年',
    amounts: sumMonthlyNetPaid(monthlyRows.value, String(currentYear)),
  },
  {
    key: 'futurePayment',
    title: '未来待付款',
    description: '未来 12 个月的待付款计划',
    amounts: mergeCurrencyAmounts(futureRows.value.map(row => row.byCurrency)),
    to: '/orders?tab=WAITING_PAYMENT',
  },
  {
    key: 'collection',
    title: '收藏数量',
    description: '已签收的收藏件数',
    value: collectionQuery.data.value?.totalItems ?? 0,
    to: '/collection',
  },
])

const rankingCurrencyOverride = ref<string | null>(null)
const rankingCurrencies = computed(() => uniqueCurrencies(ips.value.map(row => row.amount)))
const rankingCurrency = computed(() => {
  const available = rankingCurrencies.value
  const override = rankingCurrencyOverride.value
  if (override && available.includes(override)) return override
  if (available.includes(settings.defaultCurrency)) return settings.defaultCurrency
  return available[0] ?? settings.defaultCurrency
})
</script>

<template>
  <div>
    <AppPageHeader title="统计" description="按付款、品类、平台、厂商与 IP 汇总">
      <template #extra>
        <span class="text-secondary">区间：{{ ALL_TIME_FROM }} ~ {{ today }}（多币种不合并）</span>
      </template>
    </AppPageHeader>

    <AppErrorState v-if="isError" @retry="retry" />
    <el-skeleton v-else-if="isLoading" :rows="8" />
    <template v-else>
      <StatisticsKpiGrid :kpis="kpis" @navigate="path => router.push(path)" />

      <AppSection title="付款趋势（近 12 个月）" description="柱：实付净额 / 虚线：订单规模">
        <PaymentTrendChart :rows="trendRows" />
      </AppSection>

      <AppSection title="未来待付款（按月份 / 币种）">
        <FuturePaymentChart :rows="futureRows" />
      </AppSection>

      <div class="statistics-charts">
        <AppSection title="品类">
          <CategoryChart :rows="categories" />
        </AppSection>
        <AppSection title="平台">
          <PlatformChart :rows="platforms" />
        </AppSection>
        <AppSection title="厂商">
          <ManufacturerChart :rows="manufacturers" />
        </AppSection>
      </div>

      <AppSection title="IP 排行" description="按所选币种金额倒序，多币种分列">
        <template #extra>
          <el-select
            :model-value="rankingCurrency"
            size="small"
            class="statistics-ranking-currency"
            @update:model-value="rankingCurrencyOverride = $event as string"
          >
            <el-option v-for="currency in rankingCurrencies" :key="currency" :value="currency" :label="currency" />
          </el-select>
        </template>
        <AppEmpty
          v-if="ips.length === 0"
          title="区间内没有 IP 数据"
          description="订单关联 IP 后这里会排名。"
        />
        <IpRanking v-else :rows="ips" :currency="rankingCurrency" />
      </AppSection>
    </template>
  </div>
</template>

<style scoped>
.statistics-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}

.statistics-ranking-currency {
  width: 120px;
}
</style>
