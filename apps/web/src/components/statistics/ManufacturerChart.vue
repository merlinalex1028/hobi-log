<script setup lang="ts">
import DimensionChart from './DimensionChart.vue'
import type { DimensionStatVo } from '@/types/models'

const props = defineProps<{ rows: DimensionStatVo[] }>()
</script>

<template>
  <DimensionChart
    :rows="props.rows"
    empty-title="区间内没有厂商数据"
    empty-description="商品填了厂商字段后这里会按厂商汇总。"
  />
</template>
