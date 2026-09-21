<script setup lang="ts">
const props = defineProps<{ modelValue: 'table' | 'grid' }>()
const emit = defineEmits<{ 'update:modelValue': [value: 'table' | 'grid'] }>()
</script>

<template>
  <el-radio-group
    :model-value="props.modelValue"
    class="order-view-switch"
    @update:model-value="emit('update:modelValue', $event as 'table' | 'grid')"
  >
    <el-radio-button value="table">表格</el-radio-button>
    <el-radio-button value="grid">卡片</el-radio-button>
  </el-radio-group>
</template>

<style scoped>
.order-view-switch {
  flex-shrink: 0;
}
</style>
