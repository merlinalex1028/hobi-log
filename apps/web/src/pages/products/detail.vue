<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { PRODUCT_CATEGORY_LABELS } from '@hobilog/shared'
import { getOrderList } from '@/api/order.api'
import { getProductDetail } from '@/api/product.api'
import { queryKeys } from '@/api/query-keys'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import AppEmpty from '@/components/common/AppEmpty.vue'
import AppQueryState from '@/components/common/AppQueryState.vue'
import AppImage from '@/components/common/AppImage.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import AppSection from '@/components/common/AppSection.vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import type { CurrencyAmountVo, OrderListItem } from '@/types/models'
import { hasValue } from '@/utils/format'
import { netPaid, sumPaid, type PaymentFormLike } from '@/utils/payment'

const route = useRoute()
const router = useRouter()

const productId = computed(() => String(route.params.id ?? ''))

const {
  data: product,
  isLoading,
  isError,
  refetch: refetchProduct,
} = useQuery({
  queryKey: computed(() => queryKeys.products.detail(productId.value)),
  queryFn: () => getProductDetail(productId.value),
})

const orderParams = computed(() => ({ keyword: product.value?.name ?? '', pageSize: 50 }))

const { data: orderPage, refetch: refetchOrders } = useQuery({
  queryKey: computed(() => queryKeys.orders.list(orderParams.value)),
  queryFn: () => getOrderList(orderParams.value),
  enabled: computed(() => Boolean(product.value?.name)),
})

const orders = computed<OrderListItem[]>(() => orderPage.value?.items ?? [])

const categoryLabel = computed(() =>
  product.value ? PRODUCT_CATEGORY_LABELS[product.value.category] ?? product.value.category : '',
)

const releasePrecision = computed<'DAY' | 'MONTH'>(() => (product.value?.releaseDatePrecision === 'DAY' ? 'DAY' : 'MONTH'))

function display(value: string | null | undefined): string {
  return hasValue(value) ? String(value) : '—'
}

function totalsByCurrency(reduce: (payments: PaymentFormLike[]) => number): CurrencyAmountVo[] {
  const groups = new Map<string, PaymentFormLike[]>()
  for (const order of orders.value) {
    const payments = groups.get(order.currency) ?? []
    payments.push({
      type: 'FULL',
      amount: order.paymentSummary.paidAmount,
      status: 'PAID',
      sortOrder: payments.length,
    })
    if (order.paymentSummary.refundAmount > 0) {
      payments.push({
        type: 'REFUND',
        amount: order.paymentSummary.refundAmount,
        status: 'PAID',
        sortOrder: payments.length,
      })
    }
    groups.set(order.currency, payments)
  }
  return [...groups.entries()]
    .map(([currency, payments]) => ({ currency, amount: reduce(payments) }))
    .sort((a, b) => b.amount - a.amount)
}

const paidTotals = computed(() => totalsByCurrency(sumPaid))
const netTotals = computed(() => totalsByCurrency(netPaid))

function countByShipment(statuses: string[]): number {
  return orders.value
    .filter(order => statuses.includes(order.shipmentSummary.status ?? ''))
    .reduce((sum, order) => sum + order.itemCount, 0)
}

const deliveredCount = computed(() => countByShipment(['DELIVERED']))
const inTransitCount = computed(() => countByShipment(['SHIPPED', 'IN_TRANSIT']))

async function reload(): Promise<void> {
  await refetchProduct()
  await refetchOrders()
}

function openOrder(order: OrderListItem): void {
  router.push(`/orders/${order.id}`)
}
</script>

<template>
  <div>
    <AppPageHeader title="商品详情" :description="product?.name">
      <template #actions>
        <el-button @click="router.push('/products')">返回商品库</el-button>
      </template>
    </AppPageHeader>

    <AppQueryState :error="isError" :loading="isLoading" @retry="reload">
      <template v-if="product">
        <div class="product-detail">
          <div class="app-card product-detail__cover">
            <AppImage :src="product.coverUrl" :alt="product.name" ratio="1 / 1" fit="contain" />
          </div>

          <AppSection title="商品资料" class="product-detail__info">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="商品名称">{{ product.name }}</el-descriptions-item>
              <el-descriptions-item label="别名">{{ display(product.originalName) }}</el-descriptions-item>
              <el-descriptions-item label="商品类型">{{ categoryLabel }}</el-descriptions-item>
              <el-descriptions-item label="IP">{{ display(product.ipName) }}</el-descriptions-item>
              <el-descriptions-item label="角色">{{ display(product.characterName) }}</el-descriptions-item>
              <el-descriptions-item label="厂商">{{ display(product.manufacturer) }}</el-descriptions-item>
              <el-descriptions-item label="系列">{{ display(product.seriesName) }}</el-descriptions-item>
              <el-descriptions-item label="比例">{{ display(product.scale) }}</el-descriptions-item>
              <el-descriptions-item label="版本">{{ display(product.version) }}</el-descriptions-item>
              <el-descriptions-item label="SKU">{{ display(product.sku) }}</el-descriptions-item>
              <el-descriptions-item label="官方价格">
                <AppCurrency :amount="product.officialPrice" :currency="product.officialCurrency ?? 'CNY'" />
              </el-descriptions-item>
              <el-descriptions-item label="官方公布时间">
                <AppDate :value="product.announcedAt" />
              </el-descriptions-item>
              <el-descriptions-item label="预计发售时间">
                <AppDate :value="product.originalReleaseDate" :precision="releasePrecision" />
              </el-descriptions-item>
              <el-descriptions-item label="状态">{{ product.status === 'ARCHIVED' ? '已归档' : '在用' }}</el-descriptions-item>
              <el-descriptions-item label="描述" :span="2">{{ display(product.description) }}</el-descriptions-item>
            </el-descriptions>
          </AppSection>
        </div>

        <div class="product-detail__stats">
          <div class="app-card product-detail__stat">
            <div class="product-detail__stat-label">购买次数</div>
            <div class="product-detail__stat-value">{{ orders.length }}</div>
          </div>
          <div class="app-card product-detail__stat">
            <div class="product-detail__stat-label">累计支付</div>
            <div v-if="paidTotals.length === 0" class="product-detail__stat-value">—</div>
            <div v-for="total in paidTotals" :key="total.currency" class="product-detail__stat-value">
              <AppCurrency :amount="total.amount" :currency="total.currency" />
            </div>
          </div>
          <div class="app-card product-detail__stat">
            <div class="product-detail__stat-label">累计净支出</div>
            <div v-if="netTotals.length === 0" class="product-detail__stat-value">—</div>
            <div v-for="total in netTotals" :key="total.currency" class="product-detail__stat-value">
              <AppCurrency :amount="total.amount" :currency="total.currency" />
            </div>
          </div>
          <div class="app-card product-detail__stat">
            <div class="product-detail__stat-label">收藏状态</div>
            <div class="product-detail__stat-value">已入库 {{ deliveredCount }} 件</div>
            <div class="product-detail__stat-hint">在途 {{ inTransitCount }} 件</div>
          </div>
        </div>

        <AppSection title="相关订单" description="按商品名匹配的历史订单">
          <AppEmpty v-if="orders.length === 0" title="还没有相关订单" description="创建订单并把该商品加进去。" />
          <el-table v-else :data="orders" row-key="id" @row-click="openOrder">
            <el-table-column label="订单号" min-width="160">
              <template #default="{ row }">{{ row.orderNo ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="下单日期" min-width="120">
              <template #default="{ row }">
                <AppDate :value="row.orderedAt" />
              </template>
            </el-table-column>
            <el-table-column label="状态" min-width="140">
              <template #default="{ row }">
                <AppStatusTag :status="row.displayStatus" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="件数" width="80">
              <template #default="{ row }">{{ row.itemCount }}</template>
            </el-table-column>
            <el-table-column label="订单总额" min-width="140">
              <template #default="{ row }">
                <AppCurrency :amount="row.totalAmount" :currency="row.currency" />
              </template>
            </el-table-column>
            <el-table-column label="净支出" min-width="140">
              <template #default="{ row }">
                <AppCurrency :amount="row.paymentSummary.netPaidAmount" :currency="row.currency" />
              </template>
            </el-table-column>
          </el-table>
        </AppSection>
      </template>
      <AppEmpty v-else title="商品不存在" description="它可能已被删除或归档。" action-text="返回商品库" @action="router.push('/products')" />
    </AppQueryState>
  </div>
</template>

<style scoped>
.product-detail {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  align-items: start;
}

.product-detail__cover {
  padding: 12px;
}

.product-detail__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin: 16px 0;
}

.product-detail__stat-label {
  color: var(--text-secondary);
  font-size: 12px;
}

.product-detail__stat-value {
  font-size: 18px;
  font-weight: 600;
  margin-top: 4px;
}

.product-detail__stat-hint {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 4px;
}

@media (max-width: 1024px) {
  .product-detail {
    grid-template-columns: 1fr;
  }
}
</style>
