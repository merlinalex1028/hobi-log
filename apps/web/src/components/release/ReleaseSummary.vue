<script setup lang="ts">
import AppDate from '@/components/common/AppDate.vue'
import type { OrderListItem } from '@/types/models'

const props = defineProps<{ summary: OrderListItem['releaseSummary'] }>()

function precisionOf(value: string | null): 'DAY' | 'MONTH' {
  return value === 'DAY' ? 'DAY' : 'MONTH'
}
</script>

<template>
  <div class="release-summary">
    <AppDate
      v-if="props.summary.plannedDate"
      :value="props.summary.plannedDate"
      :precision="precisionOf(props.summary.precision)"
    />
    <span v-else class="text-secondary">未记录</span>
    <el-tag v-if="props.summary.delayMonths > 0" type="warning" size="small" effect="light" round>
      延期 {{ props.summary.delayMonths }} 个月
    </el-tag>
  </div>
</template>

<style scoped>
.release-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
