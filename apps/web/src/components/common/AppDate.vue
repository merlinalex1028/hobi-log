<script setup lang="ts">
import { computed } from 'vue'
import { formatDate } from '@/utils/format'

const props = withDefaults(
  defineProps<{ value?: string | null; precision?: 'DAY' | 'MONTH'; placeholder?: string }>(),
  { precision: 'DAY', placeholder: '—' },
)

const text = computed(() => (props.value ? formatDate(props.value, props.precision) : props.placeholder))
</script>

<template>
  <span class="app-date">{{ text }}</span>
</template>
