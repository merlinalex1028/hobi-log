<script setup lang="ts">
import AppDate from '@/components/common/AppDate.vue'
import type { DashboardVo } from '@/types/models'
import { toDatePrecision } from '@/utils/format'

const props = defineProps<{ items: DashboardVo['upcomingReleases'] }>()
const emit = defineEmits<{ open: [orderId: string] }>()
</script>

<template>
  <div class="upcoming-release-panel">
    <p v-if="props.items.length === 0" class="text-secondary">近期没有预计出货的订单。</p>
    <ul v-else class="upcoming-release-panel__list">
      <li
        v-for="item in props.items"
        :key="item.orderId"
        class="upcoming-release-panel__item"
        role="button"
        tabindex="0"
        @click="emit('open', item.orderId)"
      >
        <span class="upcoming-release-panel__title">{{ item.title }}</span>
        <span class="upcoming-release-panel__meta text-secondary">
          <AppDate :value="item.plannedDate" :precision="toDatePrecision(item.precision)" />
          <span v-if="item.delayMonths > 0" class="text-danger">延期 {{ item.delayMonths }} 个月</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.upcoming-release-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upcoming-release-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.upcoming-release-panel__item:hover {
  border-color: var(--el-color-primary);
}

.upcoming-release-panel__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}
</style>
