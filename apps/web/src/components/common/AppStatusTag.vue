<script setup lang="ts">
import { computed } from 'vue'
import { STATUS_CONFIG, TONE_BY_COLOR } from '@/constants/status'

const props = withDefaults(
  defineProps<{ status: string; size?: 'small' | 'default' | 'large'; label?: string }>(),
  { size: 'default' },
)

const config = computed(
  () => STATUS_CONFIG[props.status] ?? { label: props.status, color: 'gray', icon: 'Clock' },
)
const tone = computed(() => TONE_BY_COLOR[config.value.color] ?? 'info')
</script>

<template>
  <el-tag :type="tone" :size="props.size" effect="light" round>
    {{ props.label ?? config.label }}
  </el-tag>
</template>
