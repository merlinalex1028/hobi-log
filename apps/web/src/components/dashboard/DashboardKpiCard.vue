<script setup lang="ts">
import type { CurrencyAmountVo } from '@/types/models'
import AppCurrency from '@/components/common/AppCurrency.vue'

const props = withDefaults(
  defineProps<{
    title: string
    value?: string | number
    amounts?: CurrencyAmountVo[]
    description?: string
    currency?: string
    clickable?: boolean
  }>(),
  { currency: 'CNY' },
)

const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <div
    class="dashboard-kpi-card app-card"
    :class="{ 'is-clickable': props.clickable }"
    :role="props.clickable ? 'button' : undefined"
    :tabindex="props.clickable ? 0 : undefined"
    @click="props.clickable && emit('click')"
  >
    <p class="dashboard-kpi-card__title">{{ props.title }}</p>
    <div class="dashboard-kpi-card__value">
      <template v-if="props.amounts && props.amounts.length > 0">
        <AppCurrency
          v-for="item in props.amounts"
          :key="item.currency"
          class="dashboard-kpi-card__amount"
          :amount="item.amount"
          :currency="item.currency"
        />
      </template>
      <AppCurrency
        v-else-if="props.amounts"
        class="dashboard-kpi-card__amount"
        :amount="0"
        :currency="props.currency"
      />
      <span v-else>{{ props.value ?? '—' }}</span>
    </div>
    <p v-if="props.description" class="dashboard-kpi-card__description">{{ props.description }}</p>
  </div>
</template>

<style scoped>
.dashboard-kpi-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 96px;
}

.dashboard-kpi-card.is-clickable {
  cursor: pointer;
}

.dashboard-kpi-card.is-clickable:hover {
  border-color: var(--el-color-primary);
}

.dashboard-kpi-card__title {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.dashboard-kpi-card__value {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 20px;
  font-weight: 600;
}

.dashboard-kpi-card__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
