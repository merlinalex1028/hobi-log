<script setup lang="ts">
import { computed } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import AppImage from '@/components/common/AppImage.vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import PaymentProgress from '@/components/payment/PaymentProgress.vue'
import ReleaseSummary from '@/components/release/ReleaseSummary.vue'
import type { OrderListItem } from '@/types/models'

const props = defineProps<{ order: OrderListItem }>()

const emit = defineEmits<{ click: [id: string]; 'quick-action': [action: string, id: string] }>()

const title = computed(() => props.order.productSummaries[0]?.name ?? '未命名商品')
const cover = computed(() => props.order.productSummaries[0]?.coverUrl ?? null)
</script>

<template>
  <div class="app-card order-card" @click="emit('click', props.order.id)">
    <AppImage :src="cover" :alt="title" ratio="4 / 3" />
    <div class="order-card__title">{{ title }}</div>
    <div class="text-secondary order-card__meta">
      <span>{{ props.order.platformName ?? '未指定平台' }}</span>
      <span> · {{ props.order.storeName ?? '未指定店铺' }}</span>
    </div>
    <div class="order-card__row">
      <AppStatusTag :status="props.order.displayStatus" :label="props.order.displayStatusLabel" size="small" />
      <AppCurrency :amount="props.order.totalAmount" :currency="props.order.currency" />
    </div>
    <PaymentProgress
      :total-amount="props.order.totalAmount"
      :paid-amount="props.order.paymentSummary.paidAmount"
      :pending-amount="props.order.paymentSummary.pendingAmount"
      :refunded-amount="props.order.paymentSummary.refundAmount"
      :currency="props.order.currency"
      :next-payment="props.order.paymentSummary.nextPayment"
    />
    <div class="text-secondary order-card__meta">
      预计出货：<ReleaseSummary :summary="props.order.releaseSummary" />
    </div>
    <div class="order-card__footer">
      <AppDate :value="props.order.orderedAt" />
      <el-dropdown @command="(command: string) => emit('quick-action', command, props.order.id)">
        <el-button link @click.stop>快捷操作</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="mark-payment">标记付款</el-dropdown-item>
            <el-dropdown-item command="update-release">更新出货</el-dropdown-item>
            <el-dropdown-item command="add-shipment">添加物流</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped>
.order-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.order-card:hover {
  border-color: var(--color-primary, var(--status-blue));
}

.order-card__title {
  font-weight: 600;
}

.order-card__meta {
  font-size: 12px;
}

.order-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.order-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}
</style>
