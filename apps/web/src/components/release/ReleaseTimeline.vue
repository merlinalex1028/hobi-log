<script setup lang="ts">
import { computed } from 'vue'
import { RELEASE_EVENT_TYPE_LABELS } from '@hobilog/shared'
import AppDate from '@/components/common/AppDate.vue'
import type { OrderDetail } from '@/types/models'
import { sortReleaseEventsAsc } from '@/utils/release'

type ReleaseEvent = OrderDetail['releaseEvents'][number]

const props = defineProps<{ events: ReleaseEvent[] }>()

const TONES: Record<string, 'primary' | 'success' | 'warning' | 'info'> = {
  EXPECTED_RELEASE: 'info',
  DELAY: 'warning',
  RELEASED: 'primary',
  STORE_ARRIVED: 'success',
  BALANCE_OPEN: 'warning',
  SHIPMENT_READY: 'primary',
}

const sorted = computed(() => sortReleaseEventsAsc(props.events))

function label(event: ReleaseEvent): string {
  const type = event.type as keyof typeof RELEASE_EVENT_TYPE_LABELS
  return RELEASE_EVENT_TYPE_LABELS[type] ?? event.label
}

function detail(event: ReleaseEvent): string | null {
  if (event.oldDate && event.newDate) return `${event.oldDate} → ${event.newDate}`
  return event.note
}
</script>

<template>
  <el-timeline v-if="sorted.length > 0" class="release-timeline">
    <el-timeline-item
      v-for="event in sorted"
      :key="event.id"
      :type="TONES[event.type] ?? 'info'"
      :timestamp="String(event.occurredAt)"
      placement="top"
    >
      <div class="release-timeline__title">{{ label(event) }}</div>
      <div v-if="detail(event)" class="text-secondary release-timeline__detail">{{ detail(event) }}</div>
      <div v-if="event.source" class="text-secondary release-timeline__detail">
        来源：{{ event.source }}
        <a v-if="event.sourceUrl" :href="event.sourceUrl" target="_blank" rel="noreferrer">链接</a>
      </div>
    </el-timeline-item>
  </el-timeline>
  <p v-else class="text-secondary">还没有出货记录。</p>
</template>

<style scoped>
.release-timeline__title {
  font-weight: 600;
}

.release-timeline__detail {
  font-size: 12px;
}
</style>
