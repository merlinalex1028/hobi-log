<script setup lang="ts">
import { computed } from 'vue'
import AppChart from '@/components/chart/AppChart.vue'
import AppEmpty from '@/components/common/AppEmpty.vue'
import type { MonthlyPaymentVo } from '@/types/models'
import { buildMonthlyTrendOption } from '@/utils/chart'

const props = defineProps<{ rows: MonthlyPaymentVo[] }>()

const option = computed(() => buildMonthlyTrendOption(props.rows))
</script>

<template>
  <AppEmpty
    v-if="props.rows.length === 0"
    title="区间内没有付款记录"
    description="换一个时间区间再试试。"
  />
  <AppChart v-else :option="option" height="300px" />
</template>
