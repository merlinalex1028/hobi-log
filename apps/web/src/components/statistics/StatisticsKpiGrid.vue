<script setup lang="ts">
import DashboardKpiCard from '@/components/dashboard/DashboardKpiCard.vue'
import type { StatisticsKpi } from '@/types/forms'

const props = defineProps<{ kpis: StatisticsKpi[] }>()
const emit = defineEmits<{ navigate: [path: string] }>()
</script>

<template>
  <div class="statistics-kpi-grid">
    <DashboardKpiCard
      v-for="kpi in props.kpis"
      :key="kpi.key"
      :title="kpi.title"
      :value="kpi.value"
      :amounts="kpi.amounts"
      :description="kpi.description"
      :clickable="Boolean(kpi.to)"
      @click="kpi.to && emit('navigate', kpi.to)"
    />
  </div>
</template>

<style scoped>
.statistics-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
</style>
