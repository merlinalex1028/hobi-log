<script setup lang="ts">
import DimensionChart from './DimensionChart.vue'
import type { DimensionStatVo } from '@/types/models'

const props = defineProps<{ rows: DimensionStatVo[] }>()
</script>

<template>
  <DimensionChart
    :rows="props.rows"
    empty-title="区间内没有品类数据"
    empty-description="创建订单后这里会按品类汇总。"
  />
</template>
