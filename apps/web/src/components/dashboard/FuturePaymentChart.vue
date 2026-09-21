<script setup lang="ts">
import { computed } from 'vue'
import AppChart from '@/components/chart/AppChart.vue'
import AppEmpty from '@/components/common/AppEmpty.vue'
import type { FuturePaymentVo } from '@/types/models'
import { buildFuturePaymentOption } from '@/utils/chart'

const props = defineProps<{ rows: FuturePaymentVo[] }>()

const option = computed(() => buildFuturePaymentOption(props.rows))
</script>

<template>
  <AppEmpty
    v-if="props.rows.length === 0"
    title="没有未来的付款计划"
    description="待付款节点会按月份显示在这里。"
  />
  <AppChart v-else :option="option" height="260px" />
</template>
