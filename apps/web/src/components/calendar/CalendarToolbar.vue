<script setup lang="ts">
import { CALENDAR_VIEWS, type CalendarViewName } from '@/constants/calendar'

const props = defineProps<{ view: CalendarViewName; title?: string }>()
const emit = defineEmits<{
  'update:view': [view: CalendarViewName]
  prev: []
  next: []
  today: []
}>()
</script>

<template>
  <div class="calendar-toolbar">
    <div class="calendar-toolbar__nav">
      <el-button size="small" @click="emit('prev')">上一页</el-button>
      <el-button size="small" @click="emit('today')">今天</el-button>
      <el-button size="small" @click="emit('next')">下一页</el-button>
    </div>
    <span class="calendar-toolbar__title">{{ props.title ?? '' }}</span>
    <el-select
      class="calendar-toolbar__view"
      size="small"
      :model-value="props.view"
      @update:model-value="emit('update:view', $event as CalendarViewName)"
    >
      <el-option v-for="item in CALENDAR_VIEWS" :key="item.value" :value="item.value" :label="item.label" />
    </el-select>
  </div>
</template>

<style scoped>
.calendar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.calendar-toolbar__nav {
  display: flex;
  gap: 8px;
}

.calendar-toolbar__title {
  font-weight: 600;
}

.calendar-toolbar__view {
  width: 120px;
}
</style>
