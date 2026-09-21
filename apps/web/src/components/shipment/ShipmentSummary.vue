<script setup lang="ts">
import { computed } from 'vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import type { OrderListItem } from '@/types/models'

const props = defineProps<{ summary: OrderListItem['shipmentSummary'] }>()

const tracking = computed(() => {
  const parts = [props.summary.carrier, props.summary.trackingNo].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
})
</script>

<template>
  <div class="shipment-summary">
    <AppStatusTag v-if="props.summary.status" :status="props.summary.status" size="small" />
    <span v-else class="text-secondary">还没有物流</span>
    <div v-if="tracking" class="text-secondary shipment-summary__tracking">{{ tracking }}</div>
    <div v-if="props.summary.inTransitCount > 1" class="text-secondary shipment-summary__tracking">
      {{ props.summary.inTransitCount }} 个包裹运输中
    </div>
  </div>
</template>

<style scoped>
.shipment-summary__tracking {
  font-size: 12px;
  margin-top: 2px;
}
</style>
