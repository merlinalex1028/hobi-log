<script setup lang="ts">
import { computed } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'

const props = withDefaults(
  defineProps<{
    totalAmount: number
    nodeTotal: number
    paidAmount: number
    pendingAmount: number
    currency?: string
  }>(),
  { currency: 'CNY' },
)

const gap = computed(() => Number((props.nodeTotal - props.totalAmount).toFixed(2)))
</script>

<template>
  <div class="payment-summary">
    <div class="payment-summary__row">
      <span>订单总额</span>
      <AppCurrency :amount="props.totalAmount" :currency="props.currency" />
    </div>
    <div class="payment-summary__row">
      <span>付款节点合计</span>
      <AppCurrency :amount="props.nodeTotal" :currency="props.currency" />
    </div>
    <div class="payment-summary__row">
      <span>已支付</span>
      <AppCurrency :amount="props.paidAmount" :currency="props.currency" />
    </div>
    <div class="payment-summary__row">
      <span>待支付</span>
      <AppCurrency :amount="props.pendingAmount" :currency="props.currency" />
    </div>
    <div class="payment-summary__row">
      <span>差额</span>
      <AppCurrency :amount="gap" :currency="props.currency" />
    </div>
    <el-alert
      v-if="gap !== 0"
      class="payment-summary__alert"
      type="warning"
      :closable="false"
      show-icon
      title="付款节点合计与订单总额不一致，保存后再调整也可以"
    />
  </div>
</template>

<style scoped>
.payment-summary {
  background: var(--page-bg);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
}

.payment-summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
}

.payment-summary__alert {
  margin-top: 8px;
}
</style>
