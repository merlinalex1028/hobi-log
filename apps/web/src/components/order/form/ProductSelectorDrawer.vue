<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from '@hobilog/shared'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppImage from '@/components/common/AppImage.vue'
import { useProductPicker } from '@/composables/useProductPicker'
import type { ProductVo } from '@/types/models'

const props = withDefaults(defineProps<{ modelValue: boolean; selectedIds?: string[] }>(), { selectedIds: () => [] })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; select: [products: ProductVo[]]; create: [] }>()

const { filters, page, pageSize, items, total, isLoading, isError, refetch, nextPage, prevPage } = useProductPicker()

const known = reactive<Record<string, ProductVo>>({})
const chosenIds = reactive<string[]>([])

const alreadySelected = computed(() => new Set(props.selectedIds))
const categoryOptions = PRODUCT_CATEGORIES.map(value => ({ value, label: PRODUCT_CATEGORY_LABELS[value] }))

watch(
  items,
  list => {
    for (const product of list) known[product.id] = product
  },
  { immediate: true },
)

const hasMore = computed(() => page.value * pageSize < total.value)

function isChosen(id: string): boolean {
  return chosenIds.includes(id)
}

function toggle(id: string): void {
  const index = chosenIds.indexOf(id)
  if (index >= 0) chosenIds.splice(index, 1)
  else chosenIds.push(id)
}

function useRecent(): void {
  filters.value = { keyword: '', category: '', manufacturer: '' }
  page.value = 1
}

function confirm(): void {
  const picked = chosenIds.map(id => known[id]).filter((product): product is ProductVo => product !== undefined)
  emit('select', picked)
}

function close(): void {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-drawer
    :model-value="props.modelValue"
    title="选择商品"
    size="640px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="product-selector__filters">
      <el-input v-model="filters.keyword" class="product-selector__keyword" placeholder="搜索商品名称" clearable />
      <el-select v-model="filters.category" class="product-selector__field" placeholder="商品类型" clearable>
        <el-option
          v-for="option in categoryOptions"
          :key="option.value"
          :value="option.value"
          :label="option.label"
        />
      </el-select>
      <el-input v-model="filters.manufacturer" class="product-selector__field" placeholder="厂商" clearable />
      <el-button link @click="useRecent">最近商品</el-button>
    </div>

    <div class="product-selector__list">
      <el-empty v-if="isError" description="加载失败，请重试" />
      <el-skeleton v-else-if="isLoading" :rows="5" />
      <el-empty v-else-if="items.length === 0" description="没有匹配的商品" />
      <template v-else>
        <div v-for="product in items" :key="product.id" class="product-selector__item">
          <el-checkbox
            :model-value="isChosen(product.id)"
            :disabled="alreadySelected.has(product.id)"
            @update:model-value="toggle(product.id)"
          />
          <div class="product-selector__cover">
            <AppImage :src="product.coverUrl" :alt="product.name" ratio="1 / 1" fit="contain" />
          </div>
          <div class="product-selector__info" @click="!alreadySelected.has(product.id) && toggle(product.id)">
            <div class="product-selector__name">{{ product.name }}</div>
            <div class="text-secondary product-selector__meta">
              {{ PRODUCT_CATEGORY_LABELS[product.category] ?? product.category }}
              <span v-if="product.manufacturer"> · {{ product.manufacturer }}</span>
              <span v-if="alreadySelected.has(product.id)"> · 已加入</span>
            </div>
          </div>
          <div class="product-selector__price">
            <AppCurrency :amount="product.officialPrice" :currency="product.officialCurrency ?? 'CNY'" />
          </div>
        </div>
      </template>
    </div>

    <div class="product-selector__pager">
      <span class="text-secondary">共 {{ total }} 条</span>
      <el-button :disabled="page <= 1" @click="prevPage">上一页</el-button>
      <el-button :disabled="!hasMore" @click="nextPage">下一页</el-button>
      <el-button v-if="isError" @click="() => refetch()">重试</el-button>
    </div>

    <template #footer>
      <el-button @click="emit('create')">快速创建</el-button>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :disabled="chosenIds.length === 0" @click="confirm">
        加入订单（{{ chosenIds.length }}）
      </el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.product-selector__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.product-selector__keyword {
  flex: 1 1 180px;
}

.product-selector__field {
  flex: 0 1 140px;
}

.product-selector__list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.product-selector__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.product-selector__cover {
  width: 44px;
  flex-shrink: 0;
}

.product-selector__info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.product-selector__name {
  font-weight: 600;
}

.product-selector__meta {
  font-size: 12px;
}

.product-selector__price {
  flex-shrink: 0;
}

.product-selector__pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
