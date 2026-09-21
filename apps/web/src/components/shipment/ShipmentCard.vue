<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS } from '@hobilog/shared'
import AppDate from '@/components/common/AppDate.vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import type { OrderDetail } from '@/types/models'

type ShipmentNode = OrderDetail['shipments'][number]

const props = defineProps<{ shipment: ShipmentNode }>()

const emit = defineEmits<{
  'update-status': [id: string, status: string]
  deliver: [id: string]
  edit: [id: string]
}>()

const statusOptions = SHIPMENT_STATUSES.map(value => ({ value, label: SHIPMENT_STATUS_LABELS[value] }))

const selectedStatus = ref(props.shipment.status)

watch(
  () => props.shipment.status,
  value => {
    selectedStatus.value = value
  },
)

const isDelivered = computed(() => props.shipment.status === 'DELIVERED')
const tracking = computed(() => props.shipment.trackingNo ?? '—')

function onStatusChange(value: string): void {
  if (value === props.shipment.status) return
  emit('update-status', props.shipment.id, value)
}
</script>

<template>
  <div class="shipment-card app-card">
    <div class="shipment-card__header">
      <div class="shipment-card__title">
        <span>{{ props.shipment.carrier ?? '未填写物流公司' }}</span>
        <AppStatusTag :status="props.shipment.status" size="small" />
      </div>
      <div class="shipment-card__actions">
        <el-select
          :model-value="selectedStatus"
          size="small"
          class="shipment-card__status"
          @update:model-value="onStatusChange($event as string)"
        >
          <el-option v-for="option in statusOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
        <el-button link @click="emit('edit', props.shipment.id)">编辑</el-button>
        <el-button v-if="!isDelivered" link type="primary" @click="emit('deliver', props.shipment.id)">标记签收</el-button>
      </div>
    </div>

    <div class="shipment-card__meta">
      <span>单号：{{ tracking }}</span>
      <span>
        发货：<AppDate :value="props.shipment.shippedAt" />
      </span>
      <span>
        预计到货：<AppDate :value="props.shipment.estimatedDeliveryAt" />
      </span>
      <span v-if="props.shipment.deliveredAt">
        签收：<AppDate :value="props.shipment.deliveredAt" />
      </span>
    </div>

    <div class="shipment-card__items">
      <el-tag v-for="item in props.shipment.items" :key="item.orderItemId" size="small" effect="plain">
        {{ item.productName }} × {{ item.quantity }}
      </el-tag>
    </div>

    <p v-if="props.shipment.note" class="text-secondary shipment-card__note">{{ props.shipment.note }}</p>
  </div>
</template>

<style scoped>
.shipment-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.shipment-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.shipment-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shipment-card__status {
  width: 110px;
}

.shipment-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
}

.shipment-card__items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.shipment-card__note {
  margin: 8px 0 0;
  font-size: 12px;
}
</style>
