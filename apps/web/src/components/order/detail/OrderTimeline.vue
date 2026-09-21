<script setup lang="ts">
import { computed } from 'vue'
import { formatDateTime } from '@/utils/format'
import type { TimelineItem } from '@/types/models'
import { sortTimelineDesc, TIMELINE_SOURCE_LABELS, TIMELINE_SOURCE_TONES } from '@/utils/timeline'

const props = defineProps<{ items: TimelineItem[] }>()

const sorted = computed(() => sortTimelineDesc(props.items))
</script>

<template>
  <div class="order-timeline">
    <el-timeline v-if="sorted.length > 0">
      <el-timeline-item
        v-for="item in sorted"
        :key="item.id"
        :timestamp="formatDateTime(item.occurredAt)"
        placement="top"
        :type="TIMELINE_SOURCE_TONES[item.source]"
      >
        <div class="order-timeline__title">
          <el-tag size="small" effect="plain" :type="TIMELINE_SOURCE_TONES[item.source]">
            {{ TIMELINE_SOURCE_LABELS[item.source] }}
          </el-tag>
          <span>{{ item.title }}</span>
        </div>
        <div v-if="item.description" class="text-secondary order-timeline__description">
          {{ item.description }}
        </div>
      </el-timeline-item>
    </el-timeline>
    <p v-else class="text-secondary">还没有任何记录。</p>
  </div>
</template>

<style scoped>
.order-timeline__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.order-timeline__description {
  font-size: 12px;
}
</style>
