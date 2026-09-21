<script setup lang="ts">
import { computed } from 'vue'
import AppImage from '@/components/common/AppImage.vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import type { OrderListItem } from '@/types/models'

const props = defineProps<{ order: OrderListItem }>()

const covers = computed(() => props.order.productSummaries.slice(0, 3))
const title = computed(() => props.order.productSummaries[0]?.name ?? '未命名商品')
</script>

<template>
  <div class="order-product-summary">
    <div class="order-product-summary__covers">
      <div v-for="cover in covers" :key="cover.productId" class="order-product-summary__cover">
        <AppImage :src="cover.coverUrl" :alt="cover.name" ratio="1 / 1" fit="contain" />
      </div>
    </div>
    <div class="order-product-summary__text">
      <div class="order-product-summary__title">{{ title }}</div>
      <div class="order-product-summary__meta">
        <AppStatusTag :status="props.order.displayStatus" :label="props.order.displayStatusLabel" size="small" />
        共 {{ props.order.itemCount }} 件
        <span v-if="props.order.productSummaries.length > 1"> · {{ props.order.productSummaries.length }} 个商品</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-product-summary {
  display: flex;
  gap: 8px;
  align-items: center;
}

.order-product-summary__covers {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.order-product-summary__cover {
  width: 36px;
}

.order-product-summary__text {
  min-width: 0;
}

.order-product-summary__title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-product-summary__meta {
  font-size: 12px;
}
</style>
