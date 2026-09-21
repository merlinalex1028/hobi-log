<script setup lang="ts">
import { computed } from 'vue'
import DashboardKpiCard from './DashboardKpiCard.vue'
import type { DashboardVo } from '@/types/models'
import { buildDashboardKpis } from '@/utils/dashboard'

const props = defineProps<{ kpis: DashboardVo['kpis'] }>()
const emit = defineEmits<{ navigate: [path: string] }>()

const cards = computed(() => buildDashboardKpis(props.kpis))
</script>

<template>
  <div class="dashboard-kpi-grid">
    <DashboardKpiCard
      v-for="card in cards"
      :key="card.key"
      :title="card.title"
      :value="card.value"
      :amounts="card.amounts"
      :description="card.description"
      clickable
      @click="emit('navigate', card.to)"
    />
  </div>
</template>

<style scoped>
.dashboard-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
</style>
