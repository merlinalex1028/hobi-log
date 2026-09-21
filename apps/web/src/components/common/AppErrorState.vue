<script setup lang="ts">
withDefaults(defineProps<{ message?: string; retryText?: string }>(), {
  message: '加载失败，请稍后重试',
  retryText: '重试',
})
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <el-result class="app-error-state" icon="error" :title="message">
    <template #extra>
      <el-button type="primary" @click="emit('retry')">{{ retryText }}</el-button>
    </template>
  </el-result>
</template>
