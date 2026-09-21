<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import type { OrderDetail } from '@/types/models'

type PaymentNode = OrderDetail['payments'][number]

const props = withDefaults(
  defineProps<{ modelValue: boolean; payment?: PaymentNode | null }>(),
  { payment: null },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [
    payload: {
      paidAmount: number
      paidAt?: string
      paymentMethod?: string
      transactionNo?: string
      note?: string
      createSupplement: boolean
    },
  ]
}>()

const form = reactive<{
  paidAmount: number | null
  paidAt: string
  paymentMethod: string
  transactionNo: string
  note: string
  createSupplement: boolean
}>({
  paidAmount: null,
  paidAt: '',
  paymentMethod: '',
  transactionNo: '',
  note: '',
  createSupplement: true,
})

const error = ref('')

const plannedAmount = computed(() => props.payment?.amount ?? null)
const supplementAmount = computed(() => {
  if (plannedAmount.value === null || form.paidAmount === null) return 0
  return Number((form.paidAmount - plannedAmount.value).toFixed(2))
})

const paidAmount = computed({
  get: () => form.paidAmount ?? undefined,
  set: (value: number | undefined) => {
    form.paidAmount = value ?? null
  },
})

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return
    error.value = ''
    Object.assign(form, {
      paidAmount: plannedAmount.value,
      paidAt: '',
      paymentMethod: '',
      transactionNo: '',
      note: '',
      createSupplement: true,
    })
  },
  { immediate: true },
)

function submit(): void {
  if (form.paidAmount === null) {
    error.value = '实际付款金额必填'
    return
  }
  if (form.paidAmount < 0) {
    error.value = '实际付款金额不能为负'
    return
  }
  emit('submit', {
    paidAmount: form.paidAmount,
    paidAt: form.paidAt || undefined,
    paymentMethod: form.paymentMethod || undefined,
    transactionNo: form.transactionNo || undefined,
    note: form.note || undefined,
    createSupplement: form.createSupplement,
  })
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    title="标记已付款"
    width="480px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
      <el-form-item label="计划金额">
        <AppCurrency :amount="plannedAmount" :currency="props.payment?.currency ?? 'CNY'" />
      </el-form-item>
      <el-form-item label="实际付款金额" required>
        <el-input-number v-model="paidAmount" class="mark-paid__control" :min="0" :controls="false" />
      </el-form-item>
      <el-form-item label="付款时间">
        <el-date-picker v-model="form.paidAt" class="mark-paid__control" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="支付方式">
        <el-input v-model="form.paymentMethod" placeholder="支付宝 / 微信 / 银行" />
      </el-form-item>
      <el-form-item label="交易号">
        <el-input v-model="form.transactionNo" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.note" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>

    <el-alert v-if="supplementAmount > 0" type="warning" :closable="false" show-icon>
      <p class="mark-paid__hint">
        实际付款高于计划金额，将创建补差价
        <AppCurrency :amount="supplementAmount" :currency="props.payment?.currency ?? 'CNY'" />
      </p>
      <el-switch v-model="form.createSupplement" active-text="创建补差价节点" />
    </el-alert>

    <p v-if="error" class="text-danger mark-paid__error">{{ error }}</p>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="submit">确认已付款</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.mark-paid__control {
  width: 100%;
}

.mark-paid__hint {
  margin: 0 0 8px;
}

.mark-paid__error {
  margin: 8px 0 0;
}
</style>
