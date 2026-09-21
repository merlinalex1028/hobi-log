<script setup lang="ts">
import { computed } from 'vue'
import AppDate from '@/components/common/AppDate.vue'
import AppSection from '@/components/common/AppSection.vue'
import ReleaseTimeline from './ReleaseTimeline.vue'
import type { OrderDetail } from '@/types/models'
import { plannedReleaseOf } from '@/utils/release'

const props = defineProps<{ order: OrderDetail }>()

const emit = defineEmits<{ delay: []; released: []; 'store-arrived': []; 'balance-open': [] }>()

const plan = computed(() => plannedReleaseOf(props.order.releaseEvents))

const hasReleased = computed(() => props.order.releaseEvents.some(event => event.type === 'RELEASED'))
const hasStoreArrived = computed(() => props.order.releaseEvents.some(event => event.type === 'STORE_ARRIVED'))
const balanceOpened = computed(() => props.order.releaseEvents.some(event => event.type === 'BALANCE_OPEN'))
</script>

<template>
  <AppSection title="出货" description="预计出货、延期与实际出货时间线">
    <template #extra>
      <el-button size="small" @click="emit('delay')">更新预计出货</el-button>
      <el-button size="small" :disabled="hasReleased" @click="emit('released')">标记厂商出货</el-button>
      <el-button size="small" :disabled="hasStoreArrived" @click="emit('store-arrived')">标记店铺到货</el-button>
      <el-button size="small" :disabled="balanceOpened" @click="emit('balance-open')">开启补款</el-button>
    </template>

    <el-descriptions :column="2" border size="small">
      <el-descriptions-item label="当前预计出货">
        <AppDate :value="plan.date" :precision="plan.precision" />
      </el-descriptions-item>
      <el-descriptions-item label="累计延期">
        <span v-if="props.order.releaseSummary.delayMonths > 0">{{ props.order.releaseSummary.delayMonths }} 个月</span>
        <span v-else class="text-secondary">无</span>
      </el-descriptions-item>
      <el-descriptions-item label="厂商出货">{{ hasReleased ? '已出货' : '未出货' }}</el-descriptions-item>
      <el-descriptions-item label="店铺到货">{{ hasStoreArrived ? '已到货' : '未到货' }}</el-descriptions-item>
    </el-descriptions>

    <ReleaseTimeline class="release-detail__timeline" :events="props.order.releaseEvents" />
  </AppSection>
</template>

<style scoped>
.release-detail__timeline {
  margin-top: 16px;
  padding-left: 4px;
}
</style>
