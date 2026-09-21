<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from '@hobilog/shared'
import { usePlatformStoreOptions } from '@/composables/usePlatformStoreOptions'
import type { OrderFilterState } from '@/composables/useOrderFilters'

const props = defineProps<{ modelValue: OrderFilterState }>()
const emit = defineEmits<{
  'update:modelValue': [value: OrderFilterState]
  search: []
  reset: []
}>()

const PAYMENT_SUMMARY_OPTIONS = [
  { value: 'UNPAID', label: '未付款' },
  { value: 'PARTIALLY_PAID', label: '部分付款' },
  { value: 'OVERDUE', label: '已逾期' },
  { value: 'PAID', label: '已付清' },
]

const moreVisible = ref(false)

const { platforms, stores } = usePlatformStoreOptions(() => props.modelValue.platformId)

const platformOptions = computed(() => platforms.value.map(platform => ({ value: platform.id, label: platform.name })))
const storeOptions = computed(() => stores.value.map(store => ({ value: store.id, label: store.name })))
const categoryOptions = PRODUCT_CATEGORIES.map(value => ({ value, label: PRODUCT_CATEGORY_LABELS[value] }))

function patch(partial: Partial<OrderFilterState>): void {
  emit('update:modelValue', { ...props.modelValue, ...partial, page: 1 })
}

const keyword = computed({
  get: () => props.modelValue.keyword,
  set: (value: string | undefined) => patch({ keyword: value ?? '' }),
})
const paymentSummaryStatus = computed({
  get: () => props.modelValue.paymentSummaryStatus,
  set: (value: string | undefined) => patch({ paymentSummaryStatus: value ?? '' }),
})
const platformId = computed({
  get: () => props.modelValue.platformId,
  set: (value: string | undefined) => patch({ platformId: value ?? '', storeId: '' }),
})
const storeId = computed({
  get: () => props.modelValue.storeId,
  set: (value: string | undefined) => patch({ storeId: value ?? '' }),
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
const category = computed({
  get: () => props.modelValue.category,
  set: (value: string | undefined) => patch({ category: value ?? '' }),
})
const delayed = computed({
  get: () => props.modelValue.delayed,
  set: (value: boolean) => patch({ delayed: value }),
})
const priceMin = computed({
  get: () => props.modelValue.priceMin,
  set: (value: number | undefined) => patch({ priceMin: value ?? undefined }),
})
const priceMax = computed({
  get: () => props.modelValue.priceMax,
  set: (value: number | undefined) => patch({ priceMax: value ?? undefined }),
})
const year = computed({
  get: () => (props.modelValue.year === undefined ? '' : String(props.modelValue.year)),
  set: (value: string) => patch({ year: value ? Number(value) : undefined }),
})

const debouncedSearch = useDebounceFn(() => emit('search'), 300)

watch(
  () => [
    props.modelValue.keyword,
    props.modelValue.paymentSummaryStatus,
    props.modelValue.platformId,
    props.modelValue.storeId,
    props.modelValue.manufacturer,
    props.modelValue.ipName,
    props.modelValue.characterName,
    props.modelValue.category,
    props.modelValue.year,
    props.modelValue.priceMin,
    props.modelValue.priceMax,
    props.modelValue.delayed,
  ],
  () => debouncedSearch(),
)
</script>

<template>
  <div class="app-card order-filter-bar">
    <div class="order-filter-bar__row">
      <el-input
        v-model="keyword"
        class="order-filter-bar__keyword"
        placeholder="搜索订单号 / 商品名"
        clearable
      />
      <el-select
        v-model="paymentSummaryStatus"
        class="order-filter-bar__field"
        placeholder="付款状态"
        clearable
      >
        <el-option
          v-for="option in PAYMENT_SUMMARY_OPTIONS"
          :key="option.value"
          :value="option.value"
          :label="option.label"
        />
      </el-select>
      <el-select v-model="platformId" class="order-filter-bar__field" placeholder="平台" clearable>
        <el-option v-for="option in platformOptions" :key="option.value" :value="option.value" :label="option.label" />
      </el-select>
      <el-select v-model="storeId" class="order-filter-bar__field" placeholder="店铺" clearable filterable>
        <el-option v-for="option in storeOptions" :key="option.value" :value="option.value" :label="option.label" />
      </el-select>
      <el-button @click="moreVisible = true">更多筛选</el-button>
      <el-button link @click="emit('reset')">重置</el-button>
    </div>

    <el-drawer v-model="moreVisible" title="更多筛选" size="320px">
      <el-form label-position="top">
        <el-form-item label="厂商">
          <el-input v-model="manufacturer" clearable />
        </el-form-item>
        <el-form-item label="IP">
          <el-input v-model="ipName" clearable />
        </el-form-item>
        <el-form-item label="角色">
          <el-input v-model="characterName" clearable />
        </el-form-item>
        <el-form-item label="商品类型">
          <el-select v-model="category" clearable placeholder="全部类型">
            <el-option v-for="option in categoryOptions" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
        </el-form-item>
        <el-form-item label="下单年份">
          <el-date-picker v-model="year" type="year" value-format="YYYY" placeholder="选择年份" />
        </el-form-item>
        <el-form-item label="商品金额区间">
          <div class="order-filter-bar__range">
            <el-input-number v-model="priceMin" :min="0" :controls="false" placeholder="最低" />
            <span class="text-secondary">—</span>
            <el-input-number v-model="priceMax" :min="0" :controls="false" placeholder="最高" />
          </div>
        </el-form-item>
        <el-form-item label="是否延期">
          <el-switch v-model="delayed" active-text="只看延期订单" />
        </el-form-item>
      </el-form>
    </el-drawer>
  </div>
</template>

<style scoped>
.order-filter-bar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.order-filter-bar__keyword {
  flex: 1 1 220px;
  max-width: 320px;
}

.order-filter-bar__field {
  flex: 0 1 160px;
}

.order-filter-bar__range {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
</style>
