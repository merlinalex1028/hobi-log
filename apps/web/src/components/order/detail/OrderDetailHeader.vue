<script setup lang="ts">
import { computed, ref } from 'vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import type { OrderDetail } from '@/types/models'

const props = withDefaults(defineProps<{ order: OrderDetail; canceling?: boolean }>(), { canceling: false })

const emit = defineEmits<{ edit: []; cancel: [payload: { refund: boolean; note?: string }] }>()

const confirming = ref(false)
const refund = ref(false)
const note = ref('')

const title = computed(() => props.order.productSummaries[0]?.name ?? '订单')
const canCancel = computed(() => props.order.status === 'ACTIVE')

function openCancel(): void {
  refund.value = false
  note.value = ''
  confirming.value = true
}

function confirmCancel(): void {
  emit('cancel', { refund: refund.value, note: note.value || undefined })
  confirming.value = false
}
</script>

<template>
  <header class="order-detail-header">
    <div class="order-detail-header__main">
      <div>
        <div class="order-detail-header__title">
          <h1>{{ title }}</h1>
          <AppStatusTag :status="props.order.displayStatus" :label="props.order.displayStatusLabel" />
        </div>
        <p class="text-secondary order-detail-header__meta">
          {{ props.order.platformName ?? '未指定平台' }} · {{ props.order.storeName ?? '未指定店铺' }}
          <span v-if="props.order.orderNo"> · 订单号 {{ props.order.orderNo }}</span>
        </p>
        <p v-if="props.order.displayStatusHint" class="text-secondary order-detail-header__hint">
          {{ props.order.displayStatusHint }}
        </p>
      </div>

      <div class="order-detail-header__actions">
        <el-button @click="emit('edit')">编辑</el-button>
        <el-dropdown>
          <el-button>更多</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="!canCancel" @click="openCancel">取消订单</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <AppConfirm
      v-model="confirming"
      title="取消订单"
      message="取消后订单不再计入待付款与待出货统计。"
      confirm-text="确认取消"
      danger
      @confirm="confirmCancel"
    >
      <el-switch v-model="refund" active-text="按已付款净额自动生成退款记录" />
      <el-input v-model="note" class="order-detail-header__cancel-note" placeholder="取消原因（可选）" />
    </AppConfirm>
  </header>
</template>

<style scoped>
.order-detail-header__title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-detail-header__title h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.order-detail-header__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.order-detail-header__meta {
  margin: 6px 0 0;
}

.order-detail-header__hint {
  margin: 4px 0 0;
  font-size: 12px;
}

.order-detail-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.order-detail-header__cancel-note {
  margin-top: 8px;
}
</style>
