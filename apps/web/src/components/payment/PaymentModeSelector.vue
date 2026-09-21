<script setup lang="ts">
import { PAYMENT_MODE_LABELS, PAYMENT_MODES } from '@hobilog/shared'

const props = withDefaults(defineProps<{ modelValue: string; disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const modes = PAYMENT_MODES.map(value => ({ value, label: PAYMENT_MODE_LABELS[value] }))
</script>

<template>
  <div class="payment-mode-selector" role="radiogroup">
    <button
      v-for="mode in modes"
      :key="mode.value"
      type="button"
      role="radio"
      class="payment-mode-selector__card"
      :class="{ 'is-active': props.modelValue === mode.value }"
      :aria-checked="props.modelValue === mode.value"
      :disabled="props.disabled"
      @click="emit('update:modelValue', mode.value)"
    >
      {{ mode.label }}
    </button>
  </div>
</template>

<style scoped>
.payment-mode-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.payment-mode-selector__card {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.payment-mode-selector__card:hover:not(:disabled) {
  border-color: var(--color-primary, var(--status-blue));
}

.payment-mode-selector__card.is-active {
  border-color: var(--color-primary, var(--status-blue));
  color: var(--color-primary, var(--status-blue));
  font-weight: 600;
}

.payment-mode-selector__card:disabled {
  cursor: not-allowed;
  color: var(--text-secondary);
}
</style>
