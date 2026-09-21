<script setup lang="ts">
import { computed } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import type { OrderFormModel } from '@/types/forms'
import { calcGoodsAmount } from '@/utils/order-form'
import { sumPaid, sumPending, type PaymentFormLike } from '@/utils/payment'

const props = withDefaults(
  defineProps<{
    modelValue: OrderFormModel
    mode: 'create' | 'edit'
    totalAmount: number
    loading?: boolean
  }>(),
  { loading: false },
)

const emit = defineEmits<{ submit: []; cancel: [] }>()

const payments = computed<PaymentFormLike[]>(() =>
  props.modelValue.payments.map((payment, index) => ({
    type: payment.type,
    amount: payment.amount,
    status: payment.status,
    dueAt: payment.dueAt ?? null,
    paidAt: payment.paidAt ?? null,
    sortOrder: index,
  })),
)

const itemCount = computed(() =>
  props.modelValue.items.reduce((sum, item) => sum + item.quantity, 0),
)

const goodsAmount = computed(() =>
  props.modelValue.autoCalculateGoodsAmount ? calcGoodsAmount(props.modelValue.items) : props.modelValue.goodsAmount,
)

const paidAmount = computed(() => sumPaid(payments.value))
const pendingAmount = computed(() => sumPending(payments.value))

const nodeTotal = computed(() =>
  Number(props.modelValue.payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0).toFixed(2)),
)

const gap = computed(() => Number((nodeTotal.value - props.totalAmount).toFixed(2)))
</script>

<template>
  <aside class="order-summary app-card">
    <h2 class="order-summary__title">订单摘要</h2>

    <div class="order-summary__row">
      <span>商品数量</span>
      <span>{{ itemCount }} 件</span>
    </div>
    <el-divider class="order-summary__divider" />

    <div class="order-summary__row">
      <span>商品金额</span>
      <AppCurrency :amount="goodsAmount" :currency="props.modelValue.currency" />
    </div>
    <div class="order-summary__row">
      <span>优惠</span>
      <AppCurrency :amount="props.modelValue.discountAmount" :currency="props.modelValue.currency" />
    </div>
    <div class="order-summary__row">
      <span>运费</span>
      <AppCurrency :amount="props.modelValue.shippingAmount" :currency="props.modelValue.currency" />
    </div>
    <div class="order-summary__row">
      <span>税费</span>
      <AppCurrency :amount="props.modelValue.taxAmount" :currency="props.modelValue.currency" />
    </div>
    <div class="order-summary__row">
      <span>其他</span>
      <AppCurrency :amount="props.modelValue.extraAmount" :currency="props.modelValue.currency" />
    </div>
    <el-divider class="order-summary__divider" />

    <div class="order-summary__row order-summary__row--total">
      <span>总金额</span>
      <AppCurrency :amount="props.totalAmount" :currency="props.modelValue.currency" />
    </div>
    <div class="order-summary__row">
      <span>已支付</span>
      <AppCurrency :amount="paidAmount" :currency="props.modelValue.currency" />
    </div>
    <div class="order-summary__row">
      <span>待支付</span>
      <AppCurrency :amount="pendingAmount" :currency="props.modelValue.currency" />
    </div>
    <div class="order-summary__row">
      <span>付款差额</span>
      <AppCurrency :amount="gap" :currency="props.modelValue.currency" />
    </div>

    <div class="order-summary__actions">
      <el-button type="primary" :loading="props.loading" @click="emit('submit')">
        {{ props.mode === 'create' ? '保存订单' : '保存修改' }}
      </el-button>
      <el-button @click="emit('cancel')">取消</el-button>
    </div>
  </aside>
</template>

<style scoped>
.order-summary {
  position: sticky;
  top: 20px;
}

.order-summary__title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.order-summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.order-summary__row--total {
  font-weight: 600;
  font-size: 15px;
}

.order-summary__divider {
  margin: 8px 0;
}

.order-summary__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 1024px) {
  .order-summary {
    position: static;
  }
}
</style>
