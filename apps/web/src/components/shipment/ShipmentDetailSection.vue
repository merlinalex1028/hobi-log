<script setup lang="ts">
import AppSection from '@/components/common/AppSection.vue'
import ShipmentCard from './ShipmentCard.vue'
import type { OrderDetail } from '@/types/models'

const props = defineProps<{ order: OrderDetail }>()

const emit = defineEmits<{
  create: []
  'update-status': [id: string, status: string]
  deliver: [id: string]
  edit: [id: string]
}>()
</script>

<template>
  <AppSection title="物流" description="一个订单可以有多个包裹">
    <template #extra>
      <el-button size="small" type="primary" @click="emit('create')">+ 添加物流</el-button>
    </template>

    <div v-if="props.order.shipments.length === 0" class="text-secondary">还没有物流记录。</div>
    <div v-else class="shipment-detail__list">
      <ShipmentCard
        v-for="shipment in props.order.shipments"
        :key="shipment.id"
        :shipment="shipment"
        @update-status="(id, status) => emit('update-status', id, status)"
        @deliver="id => emit('deliver', id)"
        @edit="id => emit('edit', id)"
      />
    </div>
  </AppSection>
</template>

<style scoped>
.shipment-detail__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
