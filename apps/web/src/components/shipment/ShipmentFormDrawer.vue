<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { OrderDetail } from '@/types/models'
import { remainingQuantities, validateShipmentSelection, type ShipmentAllocation } from '@/utils/shipment'

type ShipmentNode = OrderDetail['shipments'][number]

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    orderItems?: OrderDetail['items']
    shipments?: OrderDetail['shipments']
    shipment?: ShipmentNode | null
    saving?: boolean
  }>(),
  { orderItems: () => [], shipments: () => [], shipment: null, saving: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [
    payload: {
      carrier?: string
      trackingNo?: string
      status?: 'WAITING' | 'SHIPPED'
      shippedAt?: string
      estimatedDeliveryAt?: string
      note?: string
      items: ShipmentAllocation[]
    },
  ]
  update: [
    payload: {
      carrier?: string
      trackingNo?: string
      shippedAt?: string
      estimatedDeliveryAt?: string
      note?: string
    },
  ]
}>()

const editing = computed(() => props.shipment !== null)

const form = reactive<{
  carrier: string
  trackingNo: string
  status: 'WAITING' | 'SHIPPED'
  shippedAt: string
  estimatedDeliveryAt: string
  note: string
}>({ carrier: '', trackingNo: '', status: 'WAITING', shippedAt: '', estimatedDeliveryAt: '', note: '' })

const allocations = reactive<Record<string, number>>({})
const errors = ref<string[]>([])

const orderItemLike = computed(() =>
  props.orderItems.map(item => ({ id: item.id, productName: item.productName, quantity: item.quantity })),
)

const existingShipments = computed(() => props.shipments.map(shipment => ({ items: shipment.items })))

const remaining = computed(() => remainingQuantities(orderItemLike.value, existingShipments.value))

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return
    errors.value = []
    Object.assign(form, {
      carrier: props.shipment?.carrier ?? '',
      trackingNo: props.shipment?.trackingNo ?? '',
      status: props.shipment?.status === 'SHIPPED' ? 'SHIPPED' : 'WAITING',
      shippedAt: props.shipment?.shippedAt ? props.shipment.shippedAt.slice(0, 10) : '',
      estimatedDeliveryAt: props.shipment?.estimatedDeliveryAt
        ? props.shipment.estimatedDeliveryAt.slice(0, 10)
        : '',
      note: props.shipment?.note ?? '',
    })
    for (const key of Object.keys(allocations)) delete allocations[key]
  },
  { immediate: true },
)

function toggled(orderItemId: string): boolean {
  return allocations[orderItemId] !== undefined
}

function toggleItem(orderItemId: string): void {
  if (toggled(orderItemId)) delete allocations[orderItemId]
  else allocations[orderItemId] = 1
}

function selectAll(): void {
  for (const item of orderItemLike.value) {
    if (!toggled(item.id)) allocations[item.id] = 1
  }
}

function selectedPayload(): ShipmentAllocation[] {
  return Object.entries(allocations).map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
}

function submit(): void {
  if (editing.value) {
    emit('update', {
      carrier: form.carrier || undefined,
      trackingNo: form.trackingNo || undefined,
      shippedAt: form.shippedAt || undefined,
      estimatedDeliveryAt: form.estimatedDeliveryAt || undefined,
      note: form.note || undefined,
    })
    return
  }

  const selected = selectedPayload()
  const validation = validateShipmentSelection(selected, orderItemLike.value, existingShipments.value)
  if (validation.length > 0) {
    errors.value = validation
    return
  }

  emit('submit', {
    carrier: form.carrier || undefined,
    trackingNo: form.trackingNo || undefined,
    status: form.status,
    shippedAt: form.shippedAt || undefined,
    estimatedDeliveryAt: form.estimatedDeliveryAt || undefined,
    note: form.note || undefined,
    items: selected,
  })
}
</script>

<template>
  <el-drawer
    :model-value="props.modelValue"
    :title="editing ? '编辑物流' : '添加物流'"
    size="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert v-if="errors.length > 0" type="error" :closable="false" class="shipment-form__errors">
      <p v-for="message in errors" :key="message">{{ message }}</p>
    </el-alert>

    <el-form label-position="top">
      <el-form-item label="物流公司">
        <el-input v-model="form.carrier" placeholder="顺丰 / EMS / DHL" />
      </el-form-item>
      <el-form-item label="物流单号">
        <el-input v-model="form.trackingNo" />
      </el-form-item>
      <el-form-item label="发货时间">
        <el-date-picker v-model="form.shippedAt" class="shipment-form__control" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="预计到货">
        <el-date-picker
          v-model="form.estimatedDeliveryAt"
          class="shipment-form__control"
          type="date"
          value-format="YYYY-MM-DD"
        />
      </el-form-item>
      <el-form-item v-if="!editing" label="发货状态">
        <el-select v-model="form.status" class="shipment-form__control">
          <el-option value="WAITING" label="未发货" />
          <el-option value="SHIPPED" label="已发货" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.note" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>

    <template v-if="!editing">
      <div class="shipment-form__items-header">
        <span class="shipment-form__items-title">包含商品</span>
        <el-button link @click="selectAll">全选</el-button>
      </div>
      <div class="shipment-form__items">
        <div v-for="item in orderItemLike" :key="item.id" class="shipment-form__item">
          <el-checkbox :model-value="toggled(item.id)" @update:model-value="toggleItem(item.id)">
            {{ item.productName }}
          </el-checkbox>
          <span class="text-secondary shipment-form__remaining">
            剩余 {{ remaining[item.id] ?? 0 }} / {{ item.quantity }}
          </span>
          <el-input-number
            v-if="toggled(item.id)"
            v-model="allocations[item.id]"
            :min="1"
            :max="Math.max(1, remaining[item.id] ?? 1)"
            size="small"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="props.saving" @click="submit">
        {{ editing ? '保存' : '添加物流' }}
      </el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.shipment-form__errors {
  margin-bottom: 12px;
}

.shipment-form__control {
  width: 100%;
}

.shipment-form__items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.shipment-form__items-title {
  font-weight: 600;
}

.shipment-form__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shipment-form__item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shipment-form__remaining {
  font-size: 12px;
}
</style>
