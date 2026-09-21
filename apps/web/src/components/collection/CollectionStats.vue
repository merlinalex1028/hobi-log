<script setup lang="ts">
import AppCurrency from '@/components/common/AppCurrency.vue'
import type { CollectionStatsVo } from '@/types/models'

const props = defineProps<{ stats: CollectionStatsVo }>()
</script>

<template>
  <div class="collection-stats">
    <div class="collection-stats__card app-card">
      <p class="collection-stats__label">收藏件数</p>
      <p class="collection-stats__value">{{ props.stats.totalItems }}</p>
    </div>
    <div class="collection-stats__card app-card">
      <p class="collection-stats__label">已签收订单</p>
      <p class="collection-stats__value">{{ props.stats.deliveredOrders }}</p>
    </div>
    <div class="collection-stats__card app-card">
      <p class="collection-stats__label">购入金额（按币种）</p>
      <div class="collection-stats__amounts">
        <AppCurrency
          v-for="item in props.stats.byCurrency"
          :key="item.currency"
          :amount="item.amount"
          :currency="item.currency"
        />
        <span v-if="props.stats.byCurrency.length === 0" class="text-secondary">暂无金额</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.collection-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.collection-stats__label {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.collection-stats__value {
  margin: 6px 0 0;
  font-size: 20px;
  font-weight: 600;
}

.collection-stats__amounts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
  font-size: 16px;
  font-weight: 600;
}
</style>
