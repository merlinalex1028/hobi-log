<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from '@hobilog/shared'
import type { ProductFilterState } from '@/types/forms'

const props = defineProps<{ modelValue: ProductFilterState }>()
const emit = defineEmits<{
  'update:modelValue': [value: ProductFilterState]
  search: []
  reset: []
}>()

const moreVisible = ref(false)

const categoryOptions = PRODUCT_CATEGORIES.map(value => ({ value, label: PRODUCT_CATEGORY_LABELS[value] }))

const statusOptions = [
  { value: 'ACTIVE', label: '在用' },
  { value: 'ARCHIVED', label: '已归档' },
]

function patch(partial: Partial<ProductFilterState>): void {
  emit('update:modelValue', { ...props.modelValue, ...partial, page: 1 })
}

const keyword = computed({
  get: () => props.modelValue.keyword,
  set: (value: string | undefined) => patch({ keyword: value ?? '' }),
})
const category = computed({
  get: () => props.modelValue.category,
  set: (value: string | undefined) => patch({ category: value ?? '' }),
})
const manufacturer = computed({
  get: () => props.modelValue.manufacturer,
  set: (value: string | undefined) => patch({ manufacturer: value ?? '' }),
})
const ipName = computed({
  get: () => props.modelValue.ipName,
  set: (value: string | undefined) => patch({ ipName: value ?? '' }),
})
const characterName = computed({
  get: () => props.modelValue.characterName,
  set: (value: string | undefined) => patch({ characterName: value ?? '' }),
})
const status = computed({
  get: () => props.modelValue.status,
  set: (value: string | undefined) => patch({ status: value ?? '' }),
})

const debouncedSearch = useDebounceFn(() => emit('search'), 300)

watch(
  () => [
    props.modelValue.keyword,
    props.modelValue.category,
    props.modelValue.manufacturer,
    props.modelValue.ipName,
    props.modelValue.characterName,
    props.modelValue.status,
  ],
  () => debouncedSearch(),
)
</script>

<template>
  <div class="app-card product-filter-bar">
    <div class="product-filter-bar__row">
      <el-input
        v-model="keyword"
        class="product-filter-bar__keyword"
        placeholder="搜索商品名称 / IP / 角色"
        clearable
      />
      <el-select v-model="category" class="product-filter-bar__field" placeholder="商品类型" clearable>
        <el-option v-for="option in categoryOptions" :key="option.value" :value="option.value" :label="option.label" />
      </el-select>
      <el-input v-model="manufacturer" class="product-filter-bar__field" placeholder="厂商" clearable />
      <el-button @click="moreVisible = true">更多筛选</el-button>
      <el-button link @click="emit('reset')">重置</el-button>
    </div>

    <el-drawer v-model="moreVisible" title="更多筛选" size="320px">
      <el-form label-position="top">
        <el-form-item label="IP">
          <el-input v-model="ipName" clearable placeholder="按 IP 筛选" />
        </el-form-item>
        <el-form-item label="角色">
          <el-input v-model="characterName" clearable placeholder="按角色筛选" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="status" clearable placeholder="全部状态">
            <el-option v-for="option in statusOptions" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-drawer>
  </div>
</template>

<style scoped>
.product-filter-bar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.product-filter-bar__keyword {
  flex: 1 1 260px;
  max-width: 360px;
}

.product-filter-bar__field {
  flex: 0 1 180px;
}
</style>
