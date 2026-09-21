<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrderDetail, updateOrder } from '@/api/order.api'
import { queryKeys } from '@/api/query-keys'
import AppEmpty from '@/components/common/AppEmpty.vue'
import AppQueryState from '@/components/common/AppQueryState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import OrderForm from '@/components/order/OrderForm.vue'
import { useOrderForm } from '@/composables/useOrderForm'
import { useInvalidate } from '@/composables/useInvalidate'
import type { OrderFormModel } from '@/types/forms'
import { toOrderFormModel } from '@/utils/order-form'

const route = useRoute()
const router = useRouter()
const invalidate = useInvalidate()

const orderId = computed(() => String(route.params.id ?? ''))
const saving = ref(false)

const { data: order, isLoading, isError, refetch } = useQuery({
  queryKey: computed(() => queryKeys.orders.detail(orderId.value)),
  queryFn: () => getOrderDetail(orderId.value),
})

const { form, errors, validate, toUpdatePayload } = useOrderForm()

watch(order, detail => {
  if (detail) Object.assign(form, toOrderFormModel(detail))
})

function applyForm(next: OrderFormModel): void {
  Object.assign(form, next)
}

async function onSubmit(): Promise<void> {
  if (!validate()) {
    ElMessage.error(errors.value.join('；'))
    return
  }

  saving.value = true
  try {
    await updateOrder(orderId.value, toUpdatePayload())
    ElMessage.success('订单已更新')
    await invalidate('order')
    await router.replace(`/orders/${orderId.value}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AppPageHeader title="编辑订单" description="商品与付款节点请在订单详情页调整">
      <template #actions>
        <el-button @click="router.push(`/orders/${orderId}`)">返回详情</el-button>
      </template>
    </AppPageHeader>

    <AppQueryState :error="isError" :loading="isLoading" @retry="refetch">
      <OrderForm
        v-if="order"
        :model-value="form"
        mode="edit"
        :loading="saving"
        @update:model-value="applyForm"
        @submit="onSubmit"
        @cancel="router.push(`/orders/${orderId}`)"
      />
      <AppEmpty
        v-else
        title="订单不存在"
        description="它可能已被删除，或不属于当前账号。"
        action-text="返回订单列表"
        @action="router.push('/orders')"
      />
    </AppQueryState>
  </div>
</template>
