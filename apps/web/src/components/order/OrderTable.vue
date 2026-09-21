<script setup lang="ts">
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import PaymentProgress from '@/components/payment/PaymentProgress.vue'
import ReleaseSummary from '@/components/release/ReleaseSummary.vue'
import ShipmentSummary from '@/components/shipment/ShipmentSummary.vue'
import OrderProductSummary from './OrderProductSummary.vue'
import type { OrderListItem } from '@/types/models'

const props = withDefaults(defineProps<{ items: OrderListItem[]; loading?: boolean }>(), { loading: false })

const emit = defineEmits<{
  view: [id: string]
  edit: [id: string]
  'mark-payment': [id: string]
  'update-release': [id: string]
  'add-shipment': [id: string]
}>()

function onCommand(command: string, id: string): void {
  if (command === 'mark-payment') emit('mark-payment', id)
  else if (command === 'update-release') emit('update-release', id)
  else if (command === 'add-shipment') emit('add-shipment', id)
}
</script>

<template>
  <el-table
    v-loading="props.loading"
    :data="props.items"
    row-key="id"
    @row-click="(row: OrderListItem) => emit('view', row.id)"
  >
    <el-table-column label="商品" min-width="220">
      <template #default="{ row }">
        <OrderProductSummary :order="row as OrderListItem" />
      </template>
    </el-table-column>

    <el-table-column label="平台 / 店铺" min-width="160">
      <template #default="{ row }">
        <div>{{ row.platformName ?? '—' }}</div>
        <div class="text-secondary">{{ row.storeName ?? '—' }}</div>
      </template>
    </el-table-column>

    <el-table-column label="订单金额" width="140">
      <template #default="{ row }">
        <AppCurrency :amount="row.totalAmount" :currency="row.currency" />
      </template>
    </el-table-column>

    <el-table-column label="付款" min-width="200">
      <template #default="{ row }">
        <PaymentProgress
          :total-amount="row.totalAmount"
          :paid-amount="row.paymentSummary.paidAmount"
          :pending-amount="row.paymentSummary.pendingAmount"
          :refunded-amount="row.paymentSummary.refundAmount"
          :currency="row.currency"
          :next-payment="row.paymentSummary.nextPayment"
        />
      </template>
    </el-table-column>

    <el-table-column label="预计出货" min-width="150">
      <template #default="{ row }">
        <ReleaseSummary :summary="row.releaseSummary" />
      </template>
    </el-table-column>

    <el-table-column label="物流" min-width="150">
      <template #default="{ row }">
        <ShipmentSummary :summary="row.shipmentSummary" />
      </template>
    </el-table-column>

    <el-table-column label="下单时间" width="120">
      <template #default="{ row }">
        <AppDate :value="row.orderedAt" />
      </template>
    </el-table-column>

    <el-table-column label="操作" width="200" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary" @click.stop="emit('view', row.id)">详情</el-button>
        <el-button link @click.stop="emit('edit', row.id)">编辑</el-button>
        <el-dropdown @command="(command: string) => onCommand(command, row.id)">
          <el-button link @click.stop>更多</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="mark-payment">标记付款</el-dropdown-item>
              <el-dropdown-item command="update-release">更新出货</el-dropdown-item>
              <el-dropdown-item command="add-shipment">添加物流</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </el-table-column>
  </el-table>
</template>
