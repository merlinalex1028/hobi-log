<script setup lang="ts">
import { computed } from 'vue'
import { PAYMENT_TYPE_LABELS } from '@hobilog/shared'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import type { OrderPaymentSummary } from '@/types/models'

const props = withDefaults(
  defineProps<{
    totalAmount: number
    paidAmount: number
    pendingAmount: number
    refundedAmount?: number
    currency: string
    nextPayment?: OrderPaymentSummary['nextPayment']
  }>(),
  { refundedAmount: 0 },
)

const percentage = computed(() =>
  props.totalAmount > 0 ? Math.min(100, Math.round((props.paidAmount / props.totalAmount) * 100)) : 0,
)

const nextPaymentLabel = computed(() => {
  const next = props.nextPayment
  if (!next) return ''
  const type = next.type as keyof typeof PAYMENT_TYPE_LABELS
  return next.name ?? PAYMENT_TYPE_LABELS[type] ?? next.type
})
</script>

<template>
  <div class="payment-progress">
    <div class="payment-progress__amount">
      <AppCurrency :amount="props.paidAmount" :currency="props.currency" />
      <span class="text-secondary">
        / <AppCurrency :amount="props.totalAmount" :currency="props.currency" />
      </span>
    </div>
    <el-progress :percentage="percentage" :show-text="false" :stroke-width="6" />
    <div class="text-secondary payment-progress__pending">
      待付 <AppCurrency :amount="props.pendingAmount" :currency="props.currency" />
    </div>
    <div v-if="props.nextPayment" class="payment-progress__next">
      {{ nextPaymentLabel }}
      <AppCurrency :amount="props.nextPayment.amount" :currency="props.currency" />
      <span v-if="props.nextPayment.dueAt">
        ·
        <AppDate :value="props.nextPayment.dueAt" />
      </span>
      <span v-if="props.nextPayment.isOverdue" class="text-danger">
        · 已逾期 {{ props.nextPayment.overdueDays }} 天
      </span>
    </div>
  </div>
</template>

<style scoped>
.payment-progress__amount {
  margin-bottom: 4px;
}

.payment-progress__pending {
  font-size: 12px;
  margin-top: 4px;
}

.payment-progress__next {
  font-size: 12px;
  margin-top: 4px;
}
</style>
