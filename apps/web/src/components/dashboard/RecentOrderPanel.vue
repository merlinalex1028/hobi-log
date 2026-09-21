<script setup lang="ts">
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import type { DashboardVo } from '@/types/models'

const props = defineProps<{ items: DashboardVo['recentOrders'] }>()
const emit = defineEmits<{ open: [orderId: string] }>()
</script>

<template>
  <div class="recent-order-panel">
    <p v-if="props.items.length === 0" class="text-secondary">还没有任何订单。</p>
    <ul v-else class="recent-order-panel__list">
      <li
        v-for="item in props.items"
        :key="item.id"
        class="recent-order-panel__item"
        role="button"
        tabindex="0"
        @click="emit('open', item.id)"
      >
        <span class="recent-order-panel__date"><AppDate :value="item.orderedAt" /></span>
        <AppStatusTag :status="item.displayStatus" :label="item.displayStatusLabel" size="small" />
        <span class="recent-order-panel__amount">
          <AppCurrency :amount="item.totalAmount" :currency="item.currency" />
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.recent-order-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-order-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.recent-order-panel__item:hover {
  border-color: var(--el-color-primary);
}

.recent-order-panel__date {
  color: var(--text-secondary);
}

.recent-order-panel__amount {
  font-weight: 500;
}
</style>
