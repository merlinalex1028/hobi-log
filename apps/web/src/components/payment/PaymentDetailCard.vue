<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from '@hobilog/shared'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import type { OrderPaymentPayload } from '@/api/order.api'
import type { OrderDetail } from '@/types/models'

type PaymentNode = OrderDetail['payments'][number]

const props = withDefaults(
  defineProps<{ payment: PaymentNode; refundedAmount?: number }>(),
  { refundedAmount: 0 },
)

const emit = defineEmits<{
  'mark-paid': [id: string]
  refund: [id: string]
  save: [id: string, patch: Partial<OrderPaymentPayload>]
}>()

const STATUS_TONES: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
  PENDING: 'warning',
  PAID: 'success',
  PARTIALLY_REFUNDED: 'warning',
  REFUNDED: 'info',
  CANCELLED: 'info',
}

const editing = ref(false)
const showInfo = ref(false)

const draft = reactive<{ name: string; amount: number | null; dueAt: string; note: string }>({
  name: '',
  amount: null,
  dueAt: '',
  note: '',
})

const statusLabel = computed(
  () => PAYMENT_STATUS_LABELS[props.payment.status as keyof typeof PAYMENT_STATUS_LABELS] ?? props.payment.status,
)
const tone = computed(() =>
  props.payment.isOverdue ? 'danger' : (STATUS_TONES[props.payment.status] ?? 'info'),
)
const typeLabel = computed(
  () => PAYMENT_TYPE_LABELS[props.payment.type as keyof typeof PAYMENT_TYPE_LABELS] ?? props.payment.type,
)
const title = computed(() => props.payment.name ?? typeLabel.value)

const isPending = computed(() => props.payment.status === 'PENDING')
const isPaid = computed(() => props.payment.status === 'PAID' || props.payment.status === 'PARTIALLY_REFUNDED')
const isReadonly = computed(
  () => props.payment.status === 'REFUNDED' || props.payment.status === 'CANCELLED',
)

const draftAmount = computed({
  get: () => draft.amount ?? undefined,
  set: (value: number | undefined) => {
    draft.amount = value ?? null
  },
})

watch(
  () => [editing.value, props.payment] as const,
  () => {
    if (!editing.value) return
    draft.name = props.payment.name ?? ''
    draft.amount = props.payment.amount
    draft.dueAt = props.payment.dueAt ?? ''
    draft.note = props.payment.note ?? ''
  },
  { immediate: true },
)

function save(): void {
  emit('save', props.payment.id, {
    name: draft.name || undefined,
    amount: draft.amount,
    dueAt: draft.dueAt || undefined,
    note: draft.note || undefined,
  })
  editing.value = false
}
</script>

<template>
  <div class="payment-detail-card app-card">
    <div class="payment-detail-card__header">
      <div class="payment-detail-card__title">
        <span>{{ title }}</span>
        <el-tag class="payment-detail-card__type" size="small" effect="plain">{{ typeLabel }}</el-tag>
        <el-tag :type="tone" size="small" effect="light" round>{{ statusLabel }}</el-tag>
        <el-tag v-if="props.payment.isOverdue" type="danger" size="small" effect="light" round>已逾期</el-tag>
      </div>

      <div class="payment-detail-card__actions">
        <el-button v-if="isPending" link type="primary" @click="emit('mark-paid', props.payment.id)">
          标记已付款
        </el-button>
        <el-button v-if="isPaid" link type="primary" @click="emit('refund', props.payment.id)">退款</el-button>
        <el-button v-if="!isReadonly" link @click="editing = !editing">
          {{ isPending ? '编辑' : '编辑备注' }}
        </el-button>
        <el-button v-if="isPaid" link @click="showInfo = !showInfo">查看付款信息</el-button>
      </div>
    </div>

    <div class="payment-detail-card__meta">
      <span>
        金额：<AppCurrency :amount="props.payment.amount" :currency="props.payment.currency" />
      </span>
      <span>
        截止：<AppDate :value="props.payment.dueAt" />
      </span>
      <span v-if="props.payment.paidAt">
        付款：<AppDate :value="props.payment.paidAt" />
      </span>
    </div>

    <el-descriptions v-if="showInfo" class="payment-detail-card__info" :column="2" border size="small">
      <el-descriptions-item label="支付方式">{{ props.payment.paymentMethod ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="交易号">{{ props.payment.transactionNo ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="已退款金额">
        <AppCurrency :amount="props.refundedAmount" :currency="props.payment.currency" />
      </el-descriptions-item>
      <el-descriptions-item label="备注">{{ props.payment.note ?? '—' }}</el-descriptions-item>
    </el-descriptions>

    <div v-if="editing" class="payment-detail-card__editor">
      <el-form label-position="top" class="payment-detail-card__form">
        <el-form-item label="节点名称">
          <el-input v-model="draft.name" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number v-model="draftAmount" :min="0" :controls="false" placeholder="留空表示待定" />
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker v-model="draft.dueAt" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="draft.note" />
        </el-form-item>
      </el-form>
      <div class="payment-detail-card__editor-actions">
        <el-button type="primary" size="small" @click="save">保存</el-button>
        <el-button size="small" @click="editing = false">取消</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.payment-detail-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.payment-detail-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-weight: 600;
}

.payment-detail-card__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.payment-detail-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
}

.payment-detail-card__info {
  margin-top: 12px;
}

.payment-detail-card__editor {
  margin-top: 12px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}

.payment-detail-card__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0 12px;
}

.payment-detail-card__editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
