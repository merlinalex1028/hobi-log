<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { PAYMENT_TYPES, PAYMENT_TYPE_LABELS } from '@hobilog/shared'
import AppSection from '@/components/common/AppSection.vue'
import PaymentDetailCard from '@/components/payment/PaymentDetailCard.vue'
import PaymentProgress from '@/components/payment/PaymentProgress.vue'
import type { OrderPaymentPayload } from '@/api/order.api'
import type { OrderDetail } from '@/types/models'

const props = defineProps<{ order: OrderDetail }>()

const emit = defineEmits<{
  'mark-paid': [id: string]
  refund: [id: string]
  save: [id: string, patch: Partial<OrderPaymentPayload>]
  create: [payload: OrderPaymentPayload]
}>()

const creating = ref(false)

const draft = reactive<{ type: string; name: string; amount: number | null; dueAt: string; note: string }>({
  type: 'OTHER',
  name: '',
  amount: null,
  dueAt: '',
  note: '',
})

const typeOptions = PAYMENT_TYPES.filter(type => type !== 'REFUND').map(type => ({
  value: type,
  label: PAYMENT_TYPE_LABELS[type],
}))

const sortedPayments = computed(() => [...props.order.payments].sort((a, b) => a.sortOrder - b.sortOrder))

const draftAmount = computed({
  get: () => draft.amount ?? undefined,
  set: (value: number | undefined) => {
    draft.amount = value ?? null
  },
})

function submit(): void {
  emit('create', {
    type: draft.type,
    name: draft.name || undefined,
    amount: draft.amount,
    dueAt: draft.dueAt || undefined,
    note: draft.note || undefined,
  })
  creating.value = false
  Object.assign(draft, { type: 'OTHER', name: '', amount: null, dueAt: '', note: '' })
}
</script>

<template>
  <AppSection title="付款" description="按节点记录收款与退款">
    <template #extra>
      <el-button size="small" @click="creating = !creating">+ 添加付款</el-button>
    </template>

    <PaymentProgress
      :total-amount="props.order.totalAmount"
      :paid-amount="props.order.paymentSummary.paidAmount"
      :pending-amount="props.order.paymentSummary.pendingAmount"
      :refunded-amount="props.order.paymentSummary.refundAmount"
      :currency="props.order.currency"
      :next-payment="props.order.paymentSummary.nextPayment"
    />

    <div v-if="creating" class="payment-detail-section__create">
      <el-select v-model="draft.type" class="payment-detail-section__field">
        <el-option v-for="option in typeOptions" :key="option.value" :value="option.value" :label="option.label" />
      </el-select>
      <el-input v-model="draft.name" class="payment-detail-section__field" placeholder="节点名称" />
      <el-input-number v-model="draftAmount" :min="0" :controls="false" placeholder="金额（留空=待定）" />
      <el-date-picker v-model="draft.dueAt" type="date" value-format="YYYY-MM-DD" placeholder="截止时间" />
      <el-input v-model="draft.note" class="payment-detail-section__field" placeholder="备注" />
      <el-button type="primary" size="small" @click="submit">添加</el-button>
    </div>

    <div class="payment-detail-section__list">
      <PaymentDetailCard
        v-for="payment in sortedPayments"
        :key="payment.id"
        :payment="payment"
        :refunded-amount="props.order.paymentSummary.refundAmount"
        @mark-paid="id => emit('mark-paid', id)"
        @refund="id => emit('refund', id)"
        @save="(id, patch) => emit('save', id, patch)"
      />
    </div>
  </AppSection>
</template>

<style scoped>
.payment-detail-section__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.payment-detail-section__create {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
}

.payment-detail-section__field {
  flex: 1 1 140px;
  max-width: 200px;
}
</style>
