<script setup lang="ts">
import { computed } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import { CALENDAR_EVENT_CONFIG } from '@/constants/calendar'
import type { CalendarEventExtendedProps } from '@/utils/calendar'
import { toDatePrecision } from '@/utils/format'

const props = defineProps<{ modelValue: boolean; eventProps: CalendarEventExtendedProps | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; viewOrder: [orderId: string] }>()

const typeLabel = computed(() =>
  props.eventProps ? CALENDAR_EVENT_CONFIG[props.eventProps.type].label : '',
)
</script>

<template>
  <el-drawer
    :model-value="props.modelValue"
    title="事件详情"
    size="360px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="props.eventProps" class="calendar-event-drawer">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="商品">
          {{ props.eventProps.title }}
        </el-descriptions-item>
        <el-descriptions-item label="事件类型">{{ typeLabel }}</el-descriptions-item>
        <el-descriptions-item label="日期">
          <AppDate :value="props.eventProps.date" :precision="toDatePrecision(props.eventProps.precision)" />
        </el-descriptions-item>
        <el-descriptions-item label="金额">
          <AppCurrency
            :amount="props.eventProps.amount"
            :currency="props.eventProps.currency ?? 'CNY'"
          />
        </el-descriptions-item>
        <el-descriptions-item label="订单状态">
          <AppStatusTag :status="props.eventProps.displayStatus" />
        </el-descriptions-item>
      </el-descriptions>
    </div>
    <template #footer>
      <el-button
        type="primary"
        :disabled="!props.eventProps"
        @click="props.eventProps && emit('viewOrder', props.eventProps.orderId)"
      >
        查看订单
      </el-button>
    </template>
  </el-drawer>
</template>
