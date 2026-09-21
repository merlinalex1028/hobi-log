<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '@/utils/format'

const props = withDefaults(
  defineProps<{ amount?: number | null; currency?: string; placeholder?: string }>(),
  { currency: 'CNY', placeholder: '待定' },
)

const text = computed(() =>
  props.amount === null || props.amount === undefined
    ? props.placeholder
    : formatCurrency(props.amount, props.currency),
)
</script>

<template>
  <span class="app-currency">{{ text }}</span>
</template>
