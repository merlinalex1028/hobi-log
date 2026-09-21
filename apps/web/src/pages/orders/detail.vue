<script setup lang="ts">
import { useMutation, useQuery } from '@tanstack/vue-query'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ShipmentStatus } from '@hobilog/shared'
import { cancelOrder, getOrderDetail, type OrderPaymentPayload } from '@/api/order.api'
import { createPayment, markPaymentPaid, refundPayment, updatePayment } from '@/api/payment.api'
import { queryKeys } from '@/api/query-keys'
import { delayRelease, markReleased, markStoreArrived, openBalance } from '@/api/release.api'
import { createShipment, deliverShipment, updateShipment } from '@/api/shipment.api'
import AttachmentSection from '@/components/attachment/AttachmentSection.vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import AppQueryState from '@/components/common/AppQueryState.vue'
import AppSection from '@/components/common/AppSection.vue'
import OrderDetailHeader from '@/components/order/detail/OrderDetailHeader.vue'
import OrderOverviewAside from '@/components/order/detail/OrderOverviewAside.vue'
import OrderTimeline from '@/components/order/detail/OrderTimeline.vue'
import PaymentDetailSection from '@/components/order/detail/PaymentDetailSection.vue'
import MarkPaymentPaidDialog from '@/components/payment/MarkPaymentPaidDialog.vue'
import RefundPaymentDialog from '@/components/payment/RefundPaymentDialog.vue'
import ReleaseDelayDialog from '@/components/release/ReleaseDelayDialog.vue'
import ReleaseDetailSection from '@/components/release/ReleaseDetailSection.vue'
import ShipmentDetailSection from '@/components/shipment/ShipmentDetailSection.vue'
import ShipmentFormDrawer from '@/components/shipment/ShipmentFormDrawer.vue'
import { useInvalidate } from '@/composables/useInvalidate'
import { plannedReleaseOf } from '@/utils/release'

type MarkPaidPayload = Parameters<typeof markPaymentPaid>[1]
type RefundPayload = Parameters<typeof refundPayment>[1]
type DelayPayload = Parameters<typeof delayRelease>[1]
type ShipmentPayload = Parameters<typeof createShipment>[1]
type ShipmentUpdatePayload = Parameters<typeof updateShipment>[1]

const route = useRoute()
const router = useRouter()
const invalidate = useInvalidate()

const orderId = computed(() => String(route.params.id ?? ''))

const { data: order, isLoading, isError, refetch } = useQuery({
  queryKey: computed(() => queryKeys.orders.detail(orderId.value)),
  queryFn: () => getOrderDetail(orderId.value),
})

const markPaidTarget = ref<string | null>(null)
const refundTarget = ref<string | null>(null)
const delayVisible = ref(false)
const shipmentVisible = ref(false)
const editingShipmentId = ref<string | null>(null)

const markPaidPayment = computed(
  () => order.value?.payments.find(payment => payment.id === markPaidTarget.value) ?? null,
)
const refundPaymentNode = computed(
  () => order.value?.payments.find(payment => payment.id === refundTarget.value) ?? null,
)
const editingShipment = computed(
  () => order.value?.shipments.find(shipment => shipment.id === editingShipmentId.value) ?? null,
)
const releasePlan = computed(() => plannedReleaseOf(order.value?.releaseEvents ?? []))

async function refresh(): Promise<void> {
  await invalidate('order')
  await refetch()
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

const markPaidMutation = useMutation({
  mutationFn: (payload: { id: string; body: MarkPaidPayload }) => markPaymentPaid(payload.id, payload.body),
  onSuccess: async () => {
    ElMessage.success('已标记付款')
    markPaidTarget.value = null
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '标记付款失败')),
})

const refundMutation = useMutation({
  mutationFn: (payload: { id: string; body: RefundPayload }) => refundPayment(payload.id, payload.body),
  onSuccess: async () => {
    ElMessage.success('已记录退款')
    refundTarget.value = null
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '退款失败')),
})

const savePaymentMutation = useMutation({
  mutationFn: (payload: { id: string; patch: Partial<OrderPaymentPayload> }) =>
    updatePayment(payload.id, payload.patch),
  onSuccess: async () => {
    ElMessage.success('付款节点已更新')
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '更新付款节点失败')),
})

const createPaymentMutation = useMutation({
  mutationFn: (payload: OrderPaymentPayload) => createPayment(orderId.value, payload),
  onSuccess: async () => {
    ElMessage.success('已添加付款节点')
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '添加付款节点失败')),
})

const delayMutation = useMutation({
  mutationFn: (body: DelayPayload) => delayRelease(orderId.value, body),
  onSuccess: async () => {
    ElMessage.success('已更新预计出货')
    delayVisible.value = false
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '更新预计出货失败')),
})

const releaseMutation = useMutation({
  mutationFn: (kind: 'released' | 'store-arrived' | 'balance-open') =>
    kind === 'released'
      ? markReleased(orderId.value, {})
      : kind === 'store-arrived'
        ? markStoreArrived(orderId.value, {})
        : openBalance(orderId.value, {}),
  onSuccess: async () => {
    ElMessage.success('已记录出货事件')
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '记录出货事件失败')),
})

const shipmentMutation = useMutation({
  mutationFn: (body: ShipmentPayload) => createShipment(orderId.value, body),
  onSuccess: async () => {
    ElMessage.success('已添加物流')
    shipmentVisible.value = false
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '添加物流失败')),
})

const shipmentUpdateMutation = useMutation({
  mutationFn: (payload: { id: string; body: ShipmentUpdatePayload }) =>
    updateShipment(payload.id, payload.body),
  onSuccess: async () => {
    ElMessage.success('物流已更新')
    editingShipmentId.value = null
    shipmentVisible.value = false
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '更新物流失败')),
})

const deliverMutation = useMutation({
  mutationFn: (id: string) => deliverShipment(id, {}),
  onSuccess: async () => {
    ElMessage.success('已标记签收')
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '标记签收失败')),
})

const cancelMutation = useMutation({
  mutationFn: (body: { refund: boolean; note?: string }) => cancelOrder(orderId.value, body),
  onSuccess: async () => {
    ElMessage.success('订单已取消')
    await refresh()
  },
  onError: error => ElMessage.error(failureMessage(error, '取消订单失败')),
})

function openMarkPaid(id?: string): void {
  if (id) {
    markPaidTarget.value = id
    return
  }
  const pending = order.value?.payments.find(payment => payment.status === 'PENDING')
  if (!pending) {
    ElMessage.info('没有待付款节点')
    return
  }
  markPaidTarget.value = pending.id
}

function closeMarkPaid(): void {
  markPaidTarget.value = null
}

function openRefund(id: string): void {
  refundTarget.value = id
}

function closeRefund(): void {
  refundTarget.value = null
}

function submitMarkPaid(payload: MarkPaidPayload): void {
  if (!markPaidTarget.value) return
  markPaidMutation.mutate({ id: markPaidTarget.value, body: payload })
}

function submitRefund(payload: RefundPayload): void {
  if (!refundTarget.value) return
  refundMutation.mutate({ id: refundTarget.value, body: payload })
}

function savePayment(id: string, patch: Partial<OrderPaymentPayload>): void {
  savePaymentMutation.mutate({ id, patch })
}

function openShipmentForm(): void {
  editingShipmentId.value = null
  shipmentVisible.value = true
}

function editShipment(id: string): void {
  editingShipmentId.value = id
  shipmentVisible.value = true
}

function openDelay(): void {
  delayVisible.value = true
}

function updateShipmentStatus(id: string, status: string): void {
  shipmentUpdateMutation.mutate({ id, body: { status: status as ShipmentStatus } })
}

function onShipmentVisible(value: boolean): void {
  shipmentVisible.value = value
  if (!value) editingShipmentId.value = null
}

function submitShipment(payload: ShipmentPayload): void {
  shipmentMutation.mutate(payload)
}

function updateShipmentBody(payload: ShipmentUpdatePayload): void {
  if (!editingShipmentId.value) return
  shipmentUpdateMutation.mutate({ id: editingShipmentId.value, body: payload })
}
</script>

<template>
  <div>
    <AppQueryState :error="isError" :loading="isLoading" :rows="10" error-message="订单加载失败" @retry="refetch">
      <template v-if="order">
        <OrderDetailHeader
          :order="order"
          :canceling="cancelMutation.isPending.value"
          @edit="router.push(`/orders/${orderId}/edit`)"
          @cancel="payload => cancelMutation.mutate(payload)"
        />

        <div class="order-detail">
          <div class="order-detail__main">
            <AppSection title="商品" description="下单时的商品与本次单价">
              <el-table :data="order.items" row-key="id">
                <el-table-column label="商品" min-width="220">
                  <template #default="{ row }">{{ row.productName }}</template>
                </el-table-column>
                <el-table-column label="本次单价" width="140">
                  <template #default="{ row }">
                    <AppCurrency :amount="row.unitPrice" :currency="order.currency" />
                  </template>
                </el-table-column>
                <el-table-column label="数量" width="90">
                  <template #default="{ row }">{{ row.quantity }}</template>
                </el-table-column>
                <el-table-column label="小计" width="140">
                  <template #default="{ row }">
                    <AppCurrency :amount="row.subtotal" :currency="order.currency" />
                  </template>
                </el-table-column>
              </el-table>
            </AppSection>

            <PaymentDetailSection
              :order="order"
              @mark-paid="openMarkPaid"
              @refund="openRefund"
              @save="savePayment"
              @create="payload => createPaymentMutation.mutate(payload)"
            />

            <ReleaseDetailSection
              :order="order"
              @delay="openDelay"
              @released="releaseMutation.mutate('released')"
              @store-arrived="releaseMutation.mutate('store-arrived')"
              @balance-open="releaseMutation.mutate('balance-open')"
            />

            <ShipmentDetailSection
              :order="order"
              @create="openShipmentForm"
              @update-status="updateShipmentStatus"
              @deliver="id => deliverMutation.mutate(id)"
              @edit="editShipment"
            />

            <AttachmentSection :order-id="order.id" :attachments="order.attachments" @changed="refresh" />

            <AppSection title="时间轴" description="付款 / 出货 / 物流 / 订单">
              <OrderTimeline :items="order.timeline" />
            </AppSection>
          </div>

          <OrderOverviewAside
            :order="order"
            @mark-paid="openMarkPaid()"
            @release="openDelay"
            @shipment="openShipmentForm"
          />
        </div>

        <MarkPaymentPaidDialog
          :model-value="markPaidTarget !== null"
          :payment="markPaidPayment"
          @update:model-value="closeMarkPaid"
          @submit="submitMarkPaid"
        />

        <RefundPaymentDialog
          :model-value="refundTarget !== null"
          :payment="refundPaymentNode"
          :refunded-amount="order.paymentSummary.refundAmount"
          @update:model-value="closeRefund"
          @submit="submitRefund"
        />

        <ReleaseDelayDialog
          v-model="delayVisible"
          :current-date="releasePlan.date"
          :current-precision="releasePlan.precision"
          :saving="delayMutation.isPending.value"
          @submit="payload => delayMutation.mutate(payload)"
        />

        <ShipmentFormDrawer
          :model-value="shipmentVisible"
          :order-items="order.items"
          :shipments="order.shipments"
          :shipment="editingShipment"
          :saving="shipmentMutation.isPending.value || shipmentUpdateMutation.isPending.value"
          @update:model-value="onShipmentVisible"
          @submit="submitShipment"
          @update="updateShipmentBody"
        />

        <p class="text-secondary order-detail__updated">
          最后更新：<AppDate :value="order.updatedAt" />
        </p>
      </template>
    </AppQueryState>
  </div>
</template>

<style scoped>
.order-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
  margin-top: 16px;
}

.order-detail__main {
  min-width: 0;
}

.order-detail__updated {
  margin-top: 16px;
  font-size: 12px;
}

@media (max-width: 1024px) {
  .order-detail {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
