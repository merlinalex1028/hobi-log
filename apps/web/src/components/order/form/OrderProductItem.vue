<script setup lang="ts">
import { computed } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppImage from '@/components/common/AppImage.vue'
import type { OrderItemForm } from '@/types/forms'

const props = withDefaults(
  defineProps<{
    item: OrderItemForm
    index: number
    count?: number
    currency?: string
    readonly?: boolean
  }>(),
  { count: 1, currency: 'CNY', readonly: false },
)

const emit = defineEmits<{ update: [OrderItemForm]; remove: []; move: [number] }>()

const subtotal = computed(() => Number((props.item.unitPrice * props.item.quantity).toFixed(2)))

function patch(partial: Partial<OrderItemForm>): void {
  emit('update', { ...props.item, ...partial })
}

const quantity = computed({
  get: () => props.item.quantity,
  set: (value: number | undefined) => patch({ quantity: value ?? 1 }),
})

const unitPrice = computed({
  get: () => props.item.unitPrice,
  set: (value: number | undefined) => patch({ unitPrice: value ?? 0 }),
})
</script>

<template>
  <div class="order-product-item">
    <div class="order-product-item__cover">
      <AppImage :src="props.item.coverUrl" :alt="props.item.name" ratio="1 / 1" fit="contain" />
    </div>

    <div class="order-product-item__main">
      <div class="order-product-item__name">{{ props.item.name }}</div>
      <div class="order-product-item__fields">
        <label class="order-product-item__field">
          <span class="order-product-item__label">本次单价</span>
          <el-input-number v-model="unitPrice" :min="0" :controls="false" :disabled="props.readonly" />
        </label>
        <label class="order-product-item__field">
          <span class="order-product-item__label">数量</span>
          <el-input-number v-model="quantity" :min="1" :precision="0" :disabled="props.readonly" />
        </label>
        <div class="order-product-item__field">
          <span class="order-product-item__label">小计</span>
          <span class="order-product-item__subtotal">
            <AppCurrency :amount="subtotal" :currency="props.currency" />
          </span>
        </div>
      </div>
    </div>

    <div v-if="!props.readonly" class="order-product-item__actions">
      <el-button link :disabled="props.index === 0" @click="emit('move', -1)">上移</el-button>
      <el-button link :disabled="props.index === props.count - 1" @click="emit('move', 1)">下移</el-button>
      <el-button link type="danger" @click="emit('remove')">删除</el-button>
    </div>
  </div>
</template>

<style scoped>
.order-product-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  align-items: flex-start;
}

.order-product-item__cover {
  width: 64px;
  flex-shrink: 0;
}

.order-product-item__main {
  flex: 1;
  min-width: 0;
}

.order-product-item__name {
  font-weight: 600;
  margin-bottom: 8px;
}

.order-product-item__fields {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.order-product-item__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-product-item__label {
  color: var(--text-secondary);
  font-size: 12px;
}

.order-product-item__subtotal {
  font-weight: 600;
  line-height: 32px;
}

.order-product-item__actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
</style>
