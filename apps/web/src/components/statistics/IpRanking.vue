<script setup lang="ts">
import { computed } from 'vue'
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppEmpty from '@/components/common/AppEmpty.vue'
import type { DimensionStatVo } from '@/types/models'
import { uniqueCurrencies, sortDimensionStats } from '@/utils/statistics'

const props = defineProps<{ rows: DimensionStatVo[]; currency: string }>()

const currencies = computed(() => uniqueCurrencies(props.rows.map(row => row.amount)))
const sorted = computed(() => sortDimensionStats(props.rows, props.currency))
</script>

<template>
  <AppEmpty v-if="props.rows.length === 0" title="区间内没有 IP 数据" description="订单关联 IP 后这里会排名。" />
  <table v-else class="ip-ranking">
    <thead>
      <tr>
        <th class="ip-ranking__rank">#</th>
        <th>IP</th>
        <th class="ip-ranking__number">订单数</th>
        <th class="ip-ranking__number">件数</th>
        <th v-for="currency in currencies" :key="currency" class="ip-ranking__number">
          {{ currency }} 金额
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in sorted" :key="row.key">
        <td class="ip-ranking__rank">{{ index + 1 }}</td>
        <td>{{ row.label }}</td>
        <td class="ip-ranking__number">{{ row.orderCount }}</td>
        <td class="ip-ranking__number">{{ row.itemCount }}</td>
        <td v-for="currency in currencies" :key="currency" class="ip-ranking__number">
          <AppCurrency
            :amount="row.amount.find(item => item.currency === currency)?.amount ?? 0"
            :currency="currency"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.ip-ranking {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.ip-ranking th,
.ip-ranking td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
}

.ip-ranking__rank {
  width: 48px;
  color: var(--text-secondary);
}

.ip-ranking__number {
  text-align: right;
}
</style>
