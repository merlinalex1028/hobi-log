<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import type { ProductCategory } from '@hobilog/shared'
import { getProductList } from '@/api/product.api'
import { queryKeys } from '@/api/query-keys'
import AppEmpty from '@/components/common/AppEmpty.vue'
import AppQueryState from '@/components/common/AppQueryState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import ProductCard from '@/components/product/ProductCard.vue'
import ProductFilterBar from '@/components/product/ProductFilterBar.vue'
import ProductFormDrawer from '@/components/product/ProductFormDrawer.vue'
import type { ProductFilterState } from '@/types/forms'
import type { ProductVo } from '@/types/models'

const router = useRouter()

function defaultFilters(): ProductFilterState {
  return {
    page: 1,
    pageSize: 24,
    keyword: '',
    category: '',
    manufacturer: '',
    ipName: '',
    characterName: '',
    status: '',
  }
}

const filters = ref<ProductFilterState>(defaultFilters())
const drawerVisible = ref(false)
const editingProduct = ref<ProductVo | null>(null)

const params = computed(() => ({
  page: filters.value.page,
  pageSize: filters.value.pageSize,
  keyword: filters.value.keyword || undefined,
  category: (filters.value.category || undefined) as ProductCategory | undefined,
  manufacturer: filters.value.manufacturer || undefined,
  ipName: filters.value.ipName || undefined,
  characterName: filters.value.characterName || undefined,
  status: (filters.value.status || undefined) as 'ACTIVE' | 'ARCHIVED' | undefined,
}))

const { data, isLoading, isError, refetch } = useQuery({
  queryKey: queryKeys.products.list(params.value),
  queryFn: () => getProductList(params.value),
})

const total = computed(() => data.value?.total ?? 0)

function openCreate(): void {
  editingProduct.value = null
  drawerVisible.value = true
}

function openEdit(id: string): void {
  editingProduct.value = data.value?.items.find(item => item.id === id) ?? null
  drawerVisible.value = true
}

function resetFilters(): void {
  filters.value = defaultFilters()
}

async function onPageChange(page: number): Promise<void> {
  filters.value = { ...filters.value, page }
  await refetch()
}

async function onSaved(): Promise<void> {
  editingProduct.value = null
  await refetch()
}
</script>

<template>
  <div>
    <AppPageHeader title="商品库" description="手办 / GK / 周边的商品资料">
      <template #actions>
        <el-button type="primary" @click="openCreate">新建商品</el-button>
      </template>
    </AppPageHeader>

    <ProductFilterBar v-model="filters" @search="refetch" @reset="resetFilters" />

    <AppQueryState :error="isError" :loading="isLoading" :rows="6" @retry="refetch">
      <AppEmpty
        v-if="!data || data.items.length === 0"
        title="还没有商品"
        description="先创建商品，再把它加入订单。"
        action-text="新建商品"
        @action="openCreate"
      />
      <template v-else>
        <div class="product-grid">
          <ProductCard
            v-for="product in data.items"
            :key="product.id"
            :product="product"
            @click="id => router.push(`/products/${id}`)"
            @edit="openEdit"
          />
        </div>
        <el-pagination
          v-if="total > filters.pageSize"
          class="product-pagination"
          layout="prev, pager, next, total"
          :current-page="filters.page"
          :page-size="filters.pageSize"
          :total="total"
          @current-change="onPageChange"
        />
      </template>
    </AppQueryState>

    <ProductFormDrawer v-model="drawerVisible" :product="editingProduct" @saved="onSaved" />
  </div>
</template>

<style scoped>
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.product-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
