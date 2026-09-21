<script setup lang="ts">
import { computed } from 'vue'
import AppSection from '@/components/common/AppSection.vue'
import PaymentModeSelector from './PaymentModeSelector.vue'
import PaymentNodeCard from './PaymentNodeCard.vue'
import PaymentSummary from './PaymentSummary.vue'
import { usePaymentSummary } from '@/composables/usePaymentSummary'
import type { OrderFormModel, PaymentFormItem } from '@/types/forms'
import { applyDepositChange, defaultPaymentItemsFor } from '@/utils/order-form'
import type { PaymentFormLike } from '@/utils/payment'

const props = withDefaults(
  defineProps<{
    modelValue: OrderFormModel
    totalAmount: number
    mode?: 'create' | 'edit'
  }>(),
  { mode: 'create' },
)

const emit = defineEmits<{ change: [Partial<OrderFormModel>] }>()

const editable = computed(() => props.mode === 'create')
const payments = computed(() => props.modelValue.payments)
const paymentLikes = computed<PaymentFormLike[]>(() =>
  payments.value.map((payment, index) => ({
    type: payment.type,
    amount: payment.amount,
    status: payment.status,
    dueAt: payment.dueAt ?? null,
    paidAt: payment.paidAt ?? null,
    sortOrder: index,
  })),
)

const summary = usePaymentSummary(paymentLikes, computed(() => props.totalAmount))

const nodeTotal = computed(() =>
  Number(payments.value.reduce((sum, payment) => sum + (payment.amount ?? 0), 0).toFixed(2)),
)

const typeOptions = computed<readonly string[] | undefined>(() => {
  switch (props.modelValue.paymentMode) {
    case 'FULL':
      return ['FULL']
    case 'DEPOSIT_BALANCE':
      return ['DEPOSIT', 'BALANCE']
    case 'INSTALLMENT':
      return ['INSTALLMENT']
    default:
      return undefined
  }
})

const canAddNode = computed(
  () => editable.value && (props.modelValue.paymentMode === 'INSTALLMENT' || props.modelValue.paymentMode === 'CUSTOM'),
)

function patchPayments(next: PaymentFormItem[]): void {
  emit('change', { payments: next })
}

function onModeChange(mode: string): void {
  emit('change', { paymentMode: mode, payments: defaultPaymentItemsFor(mode, props.totalAmount) })
}

function onNodeUpdate(index: number, node: PaymentFormItem): void {
  const next = payments.value.map((current, position) => (position === index ? node : current))
  patchPayments(applyDepositChange(next, index, props.totalAmount))
}

function onNodeRemove(index: number): void {
  if (payments.value.length <= 1) return
  patchPayments(payments.value.filter((_, position) => position !== index))
}

function onNodeMove(index: number, delta: number): void {
  const target = index + delta
  if (target < 0 || target >= payments.value.length) return
  const next = [...payments.value]
  const [moved] = next.splice(index, 1)
  if (!moved) return
  next.splice(target, 0, moved)
  patchPayments(next)
}

function onNodeCopy(index: number): void {
  const source = payments.value[index]
  if (!source) return
  const next = [...payments.value]
  next.splice(index + 1, 0, { ...source, status: 'PENDING', paidAt: undefined })
  patchPayments(next)
}

function addNode(): void {
  const type = props.modelValue.paymentMode === 'INSTALLMENT' ? 'INSTALLMENT' : 'OTHER'
  patchPayments([...payments.value, { type, amount: null, status: 'PENDING' }])
}
</script>

<template>
  <AppSection title="付款" description="按付款模式拆分节点，节点合计与总额不一致只提示不拦截">
    <PaymentModeSelector
      :model-value="props.modelValue.paymentMode"
      :disabled="!editable"
      @update:model-value="onModeChange"
    />

    <div class="payment-section__nodes">
      <PaymentNodeCard
        v-for="(node, index) in payments"
        :key="index"
        :node="node"
        :index="index"
        :count="payments.length"
        :readonly="!editable"
        :type-options="typeOptions"
        @update="next => onNodeUpdate(index, next)"
        @remove="onNodeRemove(index)"
        @move="delta => onNodeMove(index, delta)"
        @copy="onNodeCopy(index)"
      />
    </div>

    <el-button v-if="canAddNode" class="payment-section__add" @click="addNode">+ 添加付款节点</el-button>

    <PaymentSummary
      class="payment-section__summary"
      :total-amount="props.totalAmount"
      :node-total="nodeTotal"
      :paid-amount="summary.paidAmount"
      :pending-amount="summary.pendingAmount"
      :currency="props.modelValue.currency"
    />
  </AppSection>
</template>

<style scoped>
.payment-section__nodes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
}

.payment-section__add {
  margin-bottom: 16px;
}

.payment-section__summary {
  margin-top: 8px;
}
</style>
