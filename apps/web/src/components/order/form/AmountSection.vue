<script setup lang="ts">
import { computed } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppSection from '@/components/common/AppSection.vue'
import type { OrderFormModel } from '@/types/forms'

const props = defineProps<{ modelValue: OrderFormModel; totalAmount: number }>()
const emit = defineEmits<{ change: [Partial<OrderFormModel>] }>()

const autoCalculate = computed({
  get: () => props.modelValue.autoCalculateGoodsAmount,
  set: (value: boolean) => emit('change', { autoCalculateGoodsAmount: value }),
})

function numberField(key: 'goodsAmount' | 'discountAmount' | 'shippingAmount' | 'taxAmount' | 'extraAmount') {
  return computed({
    get: () => props.modelValue[key],
    set: (value: number | undefined) => emit('change', { [key]: value ?? 0 }),
  })
}

const goodsAmount = numberField('goodsAmount')
const discountAmount = numberField('discountAmount')
const shippingAmount = numberField('shippingAmount')
const taxAmount = numberField('taxAmount')
const extraAmount = numberField('extraAmount')
</script>

<template>
  <AppSection title="金额" description="商品金额可自动按商品行合计，订单总额实时计算">
    <el-form label-position="top" class="amount-section__form">
      <el-form-item label="商品金额">
        <el-input-number
          v-model="goodsAmount"
          class="amount-section__control"
          :min="0"
          :controls="false"
          :disabled="props.modelValue.autoCalculateGoodsAmount"
          placeholder="自动计算中"
        />
      </el-form-item>
      <el-form-item label="优惠">
        <el-input-number v-model="discountAmount" class="amount-section__control" :min="0" :controls="false" />
      </el-form-item>
      <el-form-item label="运费">
        <el-input-number v-model="shippingAmount" class="amount-section__control" :min="0" :controls="false" />
      </el-form-item>
      <el-form-item label="税费">
        <el-input-number v-model="taxAmount" class="amount-section__control" :min="0" :controls="false" />
      </el-form-item>
      <el-form-item label="其他费用">
        <el-input-number v-model="extraAmount" class="amount-section__control" :min="0" :controls="false" />
      </el-form-item>
      <el-form-item label="订单总额">
        <span class="amount-section__total">
          <AppCurrency :amount="props.totalAmount" :currency="props.modelValue.currency" />
        </span>
      </el-form-item>
    </el-form>

    <el-switch v-model="autoCalculate" active-text="自动计算商品金额" />
  </AppSection>
</template>

<style scoped>
.amount-section__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0 16px;
}

.amount-section__control {
  width: 100%;
}

.amount-section__total {
  font-size: 16px;
  font-weight: 600;
  line-height: 32px;
}
</style>
