<script setup lang="ts">
import DimensionChart from './DimensionChart.vue'
import type { DimensionStatVo } from '@/types/models'

const props = defineProps<{ rows: DimensionStatVo[] }>()
</script>

<template>
  <DimensionChart
    :rows="props.rows"
    empty-title="区间内没有平台数据"
    empty-description="在「平台 / 店铺」里维护平台后再看这里。"
  />
</template>
