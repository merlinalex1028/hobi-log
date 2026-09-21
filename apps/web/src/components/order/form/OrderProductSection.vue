<script setup lang="ts">
import { computed, ref } from 'vue'
import AppEmpty from '@/components/common/AppEmpty.vue'
import ProductQuickCreateDrawer from './ProductQuickCreateDrawer.vue'
import ProductSelectorDrawer from './ProductSelectorDrawer.vue'
import OrderProductItem from './OrderProductItem.vue'
import type { OrderItemForm } from '@/types/forms'
import type { ProductVo } from '@/types/models'

const props = withDefaults(
  defineProps<{ items: OrderItemForm[]; currency?: string; readonly?: boolean }>(),
  { currency: 'CNY', readonly: false },
)

const emit = defineEmits<{ change: [OrderItemForm[]] }>()

const selectorVisible = ref(false)
const quickCreateVisible = ref(false)

const selectedIds = computed(() => props.items.map(item => item.productId))

function toFormItem(product: ProductVo, existing?: OrderItemForm): OrderItemForm {
  return {
    productId: product.id,
    name: product.name,
    coverUrl: product.coverUrl,
    quantity: existing ? existing.quantity + 1 : 1,
    unitPrice: existing ? existing.unitPrice : (product.officialPrice ?? 0),
  }
}

function addProducts(products: ProductVo[]): void {
  const next = [...props.items]
  for (const product of products) {
    const index = next.findIndex(item => item.productId === product.id)
    const existing = index >= 0 ? next[index] : undefined
    const item = toFormItem(product, existing)
    if (index >= 0) next[index] = item
    else next.push(item)
  }
  emit('change', next)
}

function onSelect(products: ProductVo[]): void {
  addProducts(products)
  selectorVisible.value = false
}

function onQuickCreated(product: ProductVo): void {
  addProducts([product])
  quickCreateVisible.value = false
}

function updateItem(index: number, item: OrderItemForm): void {
  const next = [...props.items]
  next[index] = item
  emit('change', next)
}

function removeItem(index: number): void {
  emit(
    'change',
    props.items.filter((_, position) => position !== index),
  )
}

function onSelectorVisible(value: boolean): void {
  selectorVisible.value = value
}

function onQuickCreateVisible(value: boolean): void {
  quickCreateVisible.value = value
}

function moveItem(index: number, delta: number): void {
  const target = index + delta
  if (target < 0 || target >= props.items.length) return
  const next = [...props.items]
  const [moved] = next.splice(index, 1)
  if (!moved) return
  next.splice(target, 0, moved)
  emit('change', next)
}
</script>

<template>
  <section class="app-section app-card order-product-section">
    <div class="order-product-section__header">
      <div>
        <h2 class="order-product-section__title">商品</h2>
        <p class="order-product-section__description">选择已有商品，或现场快速创建</p>
      </div>
      <div v-if="!props.readonly" class="order-product-section__actions">
        <el-button type="primary" @click="selectorVisible = true">+ 添加商品</el-button>
        <el-button @click="quickCreateVisible = true">快速创建</el-button>
      </div>
    </div>

    <AppEmpty
      v-if="props.items.length === 0"
      title="还没有商品"
      description="先从商品库选一件，或者快速创建。"
      action-text="添加商品"
      @action="selectorVisible = true"
    />
    <div v-else class="order-product-section__list">
      <OrderProductItem
        v-for="(item, index) in props.items"
        :key="`${item.productId}-${index}`"
        :item="item"
        :index="index"
        :count="props.items.length"
        :currency="props.currency"
        :readonly="props.readonly"
        @update="next => updateItem(index, next)"
        @remove="removeItem(index)"
        @move="delta => moveItem(index, delta)"
      />
    </div>

    <ProductSelectorDrawer
      v-if="selectorVisible"
      :model-value="selectorVisible"
      :selected-ids="selectedIds"
      @update:model-value="onSelectorVisible"
      @select="onSelect"
      @create="quickCreateVisible = true"
    />
    <ProductQuickCreateDrawer
      v-if="quickCreateVisible"
      :model-value="quickCreateVisible"
      @update:model-value="onQuickCreateVisible"
      @created="onQuickCreated"
    />
  </section>
</template>

<style scoped>
.order-product-section {
  margin-bottom: 16px;
}

.order-product-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.order-product-section__title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.order-product-section__description {
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.order-product-section__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.order-product-section__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
