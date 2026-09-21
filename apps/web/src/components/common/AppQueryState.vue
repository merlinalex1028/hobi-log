<script setup lang="ts">
import AppErrorState from '@/components/common/AppErrorState.vue'

withDefaults(defineProps<{ loading?: boolean; error?: boolean; rows?: number; errorMessage?: string }>(), {
  rows: 8,
})

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <AppErrorState v-if="error" :message="errorMessage" @retry="emit('retry')" />
  <el-skeleton v-else-if="loading" :rows="rows" />
  <slot v-else />
</template>
