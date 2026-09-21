<script setup lang="ts">
import { computed } from 'vue'
import AppChart from '@/components/chart/AppChart.vue'
import AppEmpty from '@/components/common/AppEmpty.vue'
import type { DimensionStatVo } from '@/types/models'
import { buildDimensionOption } from '@/utils/chart'

const props = withDefaults(
  defineProps<{ rows: DimensionStatVo[]; emptyTitle: string; emptyDescription?: string; limit?: number }>(),
  { limit: 10 },
)

const option = computed(() => buildDimensionOption(props.rows, props.limit))
</script>

<template>
  <AppEmpty
    v-if="props.rows.length === 0"
    :title="props.emptyTitle"
    :description="props.emptyDescription"
  />
  <AppChart v-else :option="option" height="300px" />
</template>
