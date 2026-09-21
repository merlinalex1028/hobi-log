<script setup lang="ts">
import { computed } from 'vue'
import AmountSection from './form/AmountSection.vue'
import OrderInfoSection from './form/OrderInfoSection.vue'
import OrderProductSection from './form/OrderProductSection.vue'
import OrderSummaryAside from './form/OrderSummaryAside.vue'
import ReleaseSection from './form/ReleaseSection.vue'
import PaymentSection from '@/components/payment/PaymentSection.vue'
import type { OrderFormModel, OrderItemForm } from '@/types/forms'
import { calcGoodsAmount, calcTotalAmount } from '@/utils/order-form'

const props = withDefaults(
  defineProps<{ modelValue: OrderFormModel; mode: 'create' | 'edit'; loading?: boolean }>(),
  { loading: false },
)

const emit = defineEmits<{ 'update:modelValue': [OrderFormModel]; submit: []; cancel: [] }>()

const goodsAmount = computed(() =>
  props.modelValue.autoCalculateGoodsAmount ? calcGoodsAmount(props.modelValue.items) : props.modelValue.goodsAmount,
)

const totalAmount = computed(() =>
  calcTotalAmount({
    goodsAmount: goodsAmount.value,
    discountAmount: props.modelValue.discountAmount,
    shippingAmount: props.modelValue.shippingAmount,
    taxAmount: props.modelValue.taxAmount,
    extraAmount: props.modelValue.extraAmount,
  }),
)

function patch(part: Partial<OrderFormModel>): void {
  emit('update:modelValue', { ...props.modelValue, ...part })
}

function onItemsChange(items: OrderItemForm[]): void {
  patch({ items })
}
</script>

<template>
  <div class="order-form">
    <div class="order-form__main">
      <OrderProductSection
        :items="props.modelValue.items"
        :currency="props.modelValue.currency"
        :readonly="props.mode === 'edit'"
        @change="onItemsChange"
      />
      <OrderInfoSection :model-value="props.modelValue" :mode="props.mode" @change="patch" />
      <AmountSection :model-value="props.modelValue" :total-amount="totalAmount" @change="patch" />
      <PaymentSection
        :model-value="props.modelValue"
        :total-amount="totalAmount"
        :mode="props.mode"
        @change="patch"
      />
      <ReleaseSection :model-value="props.modelValue" @change="patch" />
    </div>
    <OrderSummaryAside
      :model-value="props.modelValue"
      :mode="props.mode"
      :total-amount="totalAmount"
      :loading="props.loading"
      @submit="emit('submit')"
      @cancel="emit('cancel')"
    />
  </div>
</template>

<style scoped>
.order-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
}

.order-form__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1024px) {
  .order-form {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
