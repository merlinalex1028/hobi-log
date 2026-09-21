<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import type { OrderDetail } from '@/types/models'

type PaymentNode = OrderDetail['payments'][number]

const props = withDefaults(
  defineProps<{ modelValue: boolean; payment?: PaymentNode | null; refundedAmount?: number }>(),
  { payment: null, refundedAmount: 0 },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [
    payload: { amount: number; paidAt?: string; paymentMethod?: string; note?: string; markOriginal: boolean },
  ]
}>()

const form = reactive<{
  amount: number | null
  paidAt: string
  paymentMethod: string
  note: string
  markOriginal: boolean
}>({ amount: null, paidAt: '', paymentMethod: '', note: '', markOriginal: true })

const error = ref('')

const amount = computed({
  get: () => form.amount ?? undefined,
  set: (value: number | undefined) => {
    form.amount = value ?? null
  },
})

const suggestedAmount = computed(() => {
  const planned = props.payment?.amount ?? 0
  return Number(Math.max(0, planned - props.refundedAmount).toFixed(2))
})

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return
    error.value = ''
    Object.assign(form, {
      amount: suggestedAmount.value,
      paidAt: '',
      paymentMethod: '',
      note: '',
      markOriginal: true,
    })
  },
  { immediate: true },
)

function submit(): void {
  if (form.amount === null || form.amount <= 0) {
    error.value = '退款金额必须大于 0'
    return
  }
  emit('submit', {
    amount: form.amount,
    paidAt: form.paidAt || undefined,
    paymentMethod: form.paymentMethod || undefined,
    note: form.note || undefined,
    markOriginal: form.markOriginal,
  })
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    title="记录退款"
    width="480px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
      <el-form-item label="节点金额">
        <AppCurrency :amount="props.payment?.amount ?? null" :currency="props.payment?.currency ?? 'CNY'" />
      </el-form-item>
      <el-form-item label="已退款">
        <AppCurrency :amount="props.refundedAmount" :currency="props.payment?.currency ?? 'CNY'" />
      </el-form-item>
      <el-form-item label="退款金额" required>
        <el-input-number v-model="amount" class="refund__control" :min="0" :controls="false" />
      </el-form-item>
      <el-form-item label="退款时间">
        <el-date-picker v-model="form.paidAt" class="refund__control" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="退款方式">
        <el-input v-model="form.paymentMethod" placeholder="支付宝 / 微信 / 银行" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.note" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="回写原节点状态">
        <el-switch v-model="form.markOriginal" active-text="把原节点标记为已退款" />
      </el-form-item>
    </el-form>

    <p v-if="error" class="text-danger refund__error">{{ error }}</p>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="submit">确认退款</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.refund__control {
  width: 100%;
}

.refund__error {
  margin: 0;
}
</style>
