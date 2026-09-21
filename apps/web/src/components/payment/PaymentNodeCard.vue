<script setup lang="ts">
import { computed } from 'vue'
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, PAYMENT_TYPES } from '@hobilog/shared'
import type { PaymentFormItem } from '@/types/forms'

const props = withDefaults(
  defineProps<{
    node: PaymentFormItem
    index: number
    count?: number
    readonly?: boolean
    typeOptions?: readonly string[]
  }>(),
  { count: 1, readonly: false },
)

const emit = defineEmits<{ update: [PaymentFormItem]; remove: []; move: [number]; copy: [] }>()

const typeOptions = computed(() => props.typeOptions ?? PAYMENT_TYPES.filter(type => type !== 'REFUND'))
const statusOptions = (['PENDING', 'PAID'] as const).map(value => ({ value, label: PAYMENT_STATUS_LABELS[value] }))

const amountUndetermined = computed(() => props.node.amount === null)
function typeLabel(value: string): string {
  return (PAYMENT_TYPE_LABELS as Record<string, string>)[value] ?? value
}

const nodeLabel = computed(() => props.node.name ?? typeLabel(props.node.type))

function patch(partial: Partial<PaymentFormItem>): void {
  emit('update', { ...props.node, ...partial })
}

const name = computed({
  get: () => props.node.name ?? '',
  set: (value: string) => patch({ name: value || undefined }),
})
const type = computed({
  get: () => props.node.type,
  set: (value: string) => patch({ type: value }),
})
const amount = computed({
  get: () => (props.node.amount === null ? undefined : props.node.amount),
  set: (value: number | undefined) => patch({ amount: value ?? null }),
})
const status = computed({
  get: () => props.node.status,
  set: (value: 'PENDING' | 'PAID') => patch({ status: value }),
})
const dueAt = computed({
  get: () => props.node.dueAt ?? '',
  set: (value: string) => patch({ dueAt: value || undefined }),
})
const paidAt = computed({
  get: () => props.node.paidAt ?? '',
  set: (value: string) => patch({ paidAt: value || undefined }),
})
const paymentMethod = computed({
  get: () => props.node.paymentMethod ?? '',
  set: (value: string) => patch({ paymentMethod: value || undefined }),
})
const note = computed({
  get: () => props.node.note ?? '',
  set: (value: string) => patch({ note: value || undefined }),
})

function toggleUndetermined(value: boolean): void {
  patch({ amount: value ? null : 0 })
}
</script>

<template>
  <div class="payment-node app-card">
    <div class="payment-node__header">
      <span class="payment-node__index">#{{ props.index + 1 }}</span>
      <el-input v-model="name" class="payment-node__name" :placeholder="nodeLabel" :disabled="props.readonly" />
      <el-select v-model="type" class="payment-node__type" :disabled="props.readonly">
        <el-option v-for="option in typeOptions" :key="option" :value="option" :label="typeLabel(option)" />
      </el-select>
      <div v-if="!props.readonly" class="payment-node__actions">
        <el-button link :disabled="props.index === 0" @click="emit('move', -1)">上移</el-button>
        <el-button link :disabled="props.index === props.count - 1" @click="emit('move', 1)">下移</el-button>
        <el-button link @click="emit('copy')">复制</el-button>
        <el-button link type="danger" @click="emit('remove')">删除</el-button>
      </div>
    </div>

    <div class="payment-node__fields">
      <el-form-item label="金额">
        <div class="payment-node__amount">
          <el-input-number
            v-model="amount"
            :min="0"
            :controls="false"
            :disabled="props.readonly || amountUndetermined"
            placeholder="待定"
          />
          <el-switch
            :model-value="amountUndetermined"
            :disabled="props.readonly"
            active-text="金额待定"
            @update:model-value="toggleUndetermined"
          />
        </div>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="status" :disabled="props.readonly">
          <el-option v-for="option in statusOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
      <el-form-item label="截止时间">
        <el-date-picker v-model="dueAt" type="date" value-format="YYYY-MM-DD" :disabled="props.readonly" placeholder="不填表示待定" />
      </el-form-item>
      <el-form-item label="付款时间">
        <el-date-picker v-model="paidAt" type="date" value-format="YYYY-MM-DD" :disabled="props.readonly" />
      </el-form-item>
      <el-form-item label="支付方式">
        <el-input v-model="paymentMethod" :disabled="props.readonly" placeholder="支付宝 / 微信 / 信用卡" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="note" :disabled="props.readonly" />
      </el-form-item>
    </div>
  </div>
</template>

<style scoped>
.payment-node {
  padding: 12px 16px;
}

.payment-node__header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.payment-node__index {
  color: var(--text-secondary);
  font-size: 12px;
}

.payment-node__name {
  flex: 1 1 160px;
  max-width: 220px;
}

.payment-node__type {
  width: 140px;
}

.payment-node__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.payment-node__fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0 16px;
}

.payment-node__amount {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
</style>
