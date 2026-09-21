<script setup lang="ts">
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import AppImage from '@/components/common/AppImage.vue'
import type { CollectionItemVo } from '@/types/models'

const props = defineProps<{ items: CollectionItemVo[] }>()
const emit = defineEmits<{ open: [orderId: string] }>()
</script>

<template>
  <div class="collection-grid">
    <article
      v-for="item in props.items"
      :key="item.orderItemId"
      class="collection-grid__card app-card"
      role="button"
      tabindex="0"
      @click="emit('open', item.orderId)"
    >
      <AppImage :src="item.coverUrl" :alt="item.name" ratio="1 / 1" />
      <h3 class="collection-grid__name">{{ item.name }}</h3>
      <dl class="collection-grid__meta">
        <div>
          <dt>数量</dt>
          <dd>{{ item.quantity }}</dd>
        </div>
        <div>
          <dt>入库时间</dt>
          <dd><AppDate :value="item.deliveredAt" /></dd>
        </div>
        <div>
          <dt>购入价</dt>
          <dd><AppCurrency :amount="item.purchasePrice" :currency="item.currency" /></dd>
        </div>
      </dl>
    </article>
  </div>
</template>

<style scoped>
.collection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.collection-grid__card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collection-grid__card:hover {
  border-color: var(--el-color-primary);
}

.collection-grid__name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.collection-grid__meta {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.collection-grid__meta div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.collection-grid__meta dt {
  color: var(--text-secondary);
}

.collection-grid__meta dd {
  margin: 0;
}
</style>
