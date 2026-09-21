<script setup lang="ts">
import OrderCard from './OrderCard.vue'
import type { OrderListItem } from '@/types/models'

const props = defineProps<{ items: OrderListItem[] }>()

const emit = defineEmits<{ click: [id: string]; 'quick-action': [action: string, id: string] }>()
</script>

<template>
  <div class="order-grid">
    <OrderCard
      v-for="order in props.items"
      :key="order.id"
      :order="order"
      @click="id => emit('click', id)"
      @quick-action="(action, id) => emit('quick-action', action, id)"
    />
  </div>
</template>

<style scoped>
.order-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
</style>
