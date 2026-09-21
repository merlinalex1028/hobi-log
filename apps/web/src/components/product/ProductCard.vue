<script setup lang="ts">
import { computed } from 'vue'
import { PRODUCT_CATEGORY_LABELS } from '@hobilog/shared'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppImage from '@/components/common/AppImage.vue'
import type { ProductVo } from '@/types/models'

const props = defineProps<{ product: ProductVo }>()
const emit = defineEmits<{ click: [id: string]; edit: [id: string] }>()

const categoryLabel = computed(() => PRODUCT_CATEGORY_LABELS[props.product.category] ?? props.product.category)
</script>

<template>
  <div class="app-card product-card" @click="emit('click', props.product.id)">
    <AppImage :src="props.product.coverUrl" :alt="props.product.name" ratio="4 / 5" />
    <div class="product-card__title">{{ props.product.name }}</div>
    <div class="product-card__meta">
      <span>{{ categoryLabel }}</span>
      <span v-if="props.product.manufacturer">· {{ props.product.manufacturer }}</span>
    </div>
    <div class="product-card__meta">
      <span v-if="props.product.ipName">{{ props.product.ipName }}</span>
      <span v-if="props.product.characterName">· {{ props.product.characterName }}</span>
    </div>
    <div class="product-card__price">
      <AppCurrency :amount="props.product.officialPrice" :currency="props.product.officialCurrency ?? 'CNY'" />
    </div>
    <div class="product-card__actions">
      <el-button link type="primary" @click.stop="emit('edit', props.product.id)">编辑</el-button>
    </div>
  </div>
</template>

<style scoped>
.product-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.product-card:hover {
  border-color: var(--color-primary);
}

.product-card__title {
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-card__meta {
  color: var(--text-secondary);
  font-size: 12px;
  min-height: 16px;
}

.product-card__price {
  font-weight: 600;
}

.product-card__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
