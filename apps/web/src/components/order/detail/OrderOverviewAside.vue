<script setup lang="ts">
import { computed } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import type { OrderDetail } from '@/types/models'
import { plannedReleaseOf } from '@/utils/release'

const props = defineProps<{ order: OrderDetail }>()

const emit = defineEmits<{ 'mark-paid': []; release: []; shipment: [] }>()

const plan = computed(() => plannedReleaseOf(props.order.releaseEvents))
const summary = computed(() => props.order.paymentSummary)
</script>

<template>
  <aside class="order-overview app-card">
    <h2 class="order-overview__title">订单概览</h2>

    <div class="order-overview__row">
      <span>状态</span>
      <AppStatusTag :status="props.order.displayStatus" :label="props.order.displayStatusLabel" size="small" />
    </div>
    <div class="order-overview__row">
      <span>总金额</span>
      <AppCurrency :amount="props.order.totalAmount" :currency="props.order.currency" />
    </div>
    <div class="order-overview__row">
      <span>已支付</span>
      <AppCurrency :amount="summary.paidAmount" :currency="props.order.currency" />
    </div>
    <div class="order-overview__row">
      <span>待支付</span>
      <AppCurrency :amount="summary.pendingAmount" :currency="props.order.currency" />
    </div>
    <div class="order-overview__row">
      <span>退款</span>
      <AppCurrency :amount="summary.refundAmount" :currency="props.order.currency" />
    </div>

    <el-divider class="order-overview__divider" />

    <div v-if="summary.nextPayment" class="order-overview__next">
      <div class="order-overview__row">
        <span>下一付款</span>
        <AppCurrency :amount="summary.nextPayment.amount" :currency="props.order.currency" />
      </div>
      <div class="order-overview__row">
        <span>付款截止</span>
        <AppDate :value="summary.nextPayment.dueAt" />
      </div>
      <div v-if="summary.nextPayment.isOverdue" class="text-danger order-overview__overdue">
        已逾期 {{ summary.nextPayment.overdueDays }} 天
      </div>
    </div>
    <div class="order-overview__row">
      <span>预计出货</span>
      <AppDate :value="plan.date" :precision="plan.precision" />
    </div>

    <el-divider class="order-overview__divider" />

    <div class="order-overview__row">
      <span>平台</span>
      <span>{{ props.order.platformName ?? '—' }}</span>
    </div>
    <div class="order-overview__row">
      <span>店铺</span>
      <span>{{ props.order.storeName ?? '—' }}</span>
    </div>
    <div class="order-overview__row">
      <span>订单号</span>
      <span>{{ props.order.orderNo ?? '—' }}</span>
    </div>
    <div class="order-overview__row">
      <span>下单时间</span>
      <AppDate :value="props.order.orderedAt" />
    </div>

    <div class="order-overview__actions">
      <el-button type="primary" size="small" @click="emit('mark-paid')">标记付款</el-button>
      <el-button size="small" @click="emit('release')">更新出货</el-button>
      <el-button size="small" @click="emit('shipment')">添加物流</el-button>
    </div>
  </aside>
</template>

<style scoped>
.order-overview {
  position: sticky;
  top: 20px;
}

.order-overview__title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.order-overview__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
}

.order-overview__divider {
  margin: 8px 0;
}

.order-overview__overdue {
  font-size: 12px;
}

.order-overview__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 1024px) {
  .order-overview {
    position: static;
  }
}
</style>
