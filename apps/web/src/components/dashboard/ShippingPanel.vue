<script setup lang="ts">
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import type { DashboardVo } from '@/types/models'

const props = defineProps<{ items: DashboardVo['shipping'] }>()
const emit = defineEmits<{ open: [orderId: string] }>()
</script>

<template>
  <div class="shipping-panel">
    <p v-if="props.items.length === 0" class="text-secondary">当前没有在途包裹。</p>
    <ul v-else class="shipping-panel__list">
      <li
        v-for="item in props.items"
        :key="`${item.orderId}-${item.trackingNo ?? ''}`"
        class="shipping-panel__item"
        role="button"
        tabindex="0"
        @click="emit('open', item.orderId)"
      >
        <span class="shipping-panel__title">{{ item.title }}</span>
        <span class="shipping-panel__meta text-secondary">
          <span>{{ item.carrier ?? '未填写物流公司' }}</span>
          <span>{{ item.trackingNo ?? '无单号' }}</span>
          <AppStatusTag :status="item.status" size="small" />
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.shipping-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shipping-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.shipping-panel__item:hover {
  border-color: var(--el-color-primary);
}

.shipping-panel__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}
</style>
