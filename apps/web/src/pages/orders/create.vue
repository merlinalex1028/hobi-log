<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createOrder } from '@/api/order.api'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import OrderForm from '@/components/order/OrderForm.vue'
import { useOrderForm } from '@/composables/useOrderForm'
import type { OrderFormModel } from '@/types/forms'

const router = useRouter()
const { form, errors, warnings, toPayload, validate } = useOrderForm()
const submitting = ref(false)

function applyForm(next: OrderFormModel): void {
  Object.assign(form, next)
}

async function onSubmit(): Promise<void> {
  if (!validate()) {
    ElMessage.error(errors.value.join('；'))
    return
  }
  for (const warning of warnings.value) ElMessage.warning(warning)

  submitting.value = true
  try {
    const order = await createOrder(toPayload())
    ElMessage.success('订单已创建')
    await router.replace(`/orders/${order.id}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <AppPageHeader title="新建订单" description="记录一次实际购买">
      <template #actions>
        <el-button @click="router.back()">返回</el-button>
      </template>
    </AppPageHeader>
    <OrderForm
      :model-value="form"
      mode="create"
      :loading="submitting"
      @update:model-value="applyForm"
      @submit="onSubmit"
      @cancel="router.back()"
    />
  </div>
</template>
