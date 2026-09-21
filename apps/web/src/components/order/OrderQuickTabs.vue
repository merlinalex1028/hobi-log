<script setup lang="ts">
const props = defineProps<{ modelValue: string; counts?: Record<string, number> }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const tabs = [
  { label: '全部', value: 'ALL' },
  { label: '待付款', value: 'WAITING_PAYMENT' },
  { label: '待出货', value: 'WAITING_RELEASE' },
  { label: '运输中', value: 'IN_TRANSIT' },
  { label: '已完成', value: 'COMPLETED' },
]
</script>

<template>
  <div class="order-quick-tabs">
    <el-button
      v-for="tab in tabs"
      :key="tab.value"
      :type="props.modelValue === tab.value ? 'primary' : 'default'"
      round
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
      <span v-if="props.counts?.[tab.value] !== undefined">&nbsp;{{ props.counts[tab.value] }}</span>
    </el-button>
  </div>
</template>

<style scoped>
.order-quick-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
