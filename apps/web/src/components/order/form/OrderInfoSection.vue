<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { SUPPORTED_CURRENCIES } from '@hobilog/shared'
import AppSection from '@/components/common/AppSection.vue'
import { usePlatformStoreOptions } from '@/composables/usePlatformStoreOptions'
import type { OrderFormModel } from '@/types/forms'

const props = withDefaults(defineProps<{ modelValue: OrderFormModel; mode?: 'create' | 'edit' }>(), {
  mode: 'create',
})

const emit = defineEmits<{ change: [Partial<OrderFormModel>] }>()

const { platforms, stores, createStoreInline, storesLoading } = usePlatformStoreOptions(
  () => props.modelValue.platformId,
)

const currencyOptions = SUPPORTED_CURRENCIES.map(value => ({ value, label: value }))
const creatingStore = ref(false)
const savingStore = ref(false)
const storeForm = reactive({ name: '', url: '' })

const storeOptions = computed(() =>
  stores.value.map(store => ({
    value: store.id,
    label: store.platformName ? `${store.name}（${store.platformName}）` : store.name,
  })),
)

const platformId = computed({
  get: () => props.modelValue.platformId,
  set: (value: string) => emit('change', { platformId: value ?? '', storeId: '' }),
})
const storeId = computed({
  get: () => props.modelValue.storeId,
  set: (value: string) => emit('change', { storeId: value ?? '' }),
})
const orderNo = computed({
  get: () => props.modelValue.orderNo,
  set: (value: string) => emit('change', { orderNo: value ?? '' }),
})
const orderUrl = computed({
  get: () => props.modelValue.orderUrl,
  set: (value: string) => emit('change', { orderUrl: value ?? '' }),
})
const orderedAt = computed({
  get: () => props.modelValue.orderedAt,
  set: (value: string) => emit('change', { orderedAt: value ?? '' }),
})
const currency = computed({
  get: () => props.modelValue.currency,
  set: (value: string) => emit('change', { currency: value ?? 'CNY' }),
})

async function saveStore(): Promise<void> {
  if (!storeForm.name.trim()) {
    ElMessage.error('店铺名称必填')
    return
  }
  savingStore.value = true
  try {
    const created = await createStoreInline({
      name: storeForm.name.trim(),
      platformId: props.modelValue.platformId || undefined,
      url: storeForm.url || undefined,
    })
    emit('change', { storeId: created.id })
    storeForm.name = ''
    storeForm.url = ''
    creatingStore.value = false
    ElMessage.success('店铺已创建')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建店铺失败')
  } finally {
    savingStore.value = false
  }
}
</script>

<template>
  <AppSection title="订单信息" description="平台 / 店铺决定订单归属，订单号与链接方便回查">
    <el-form label-position="top" class="order-info__form">
      <el-form-item label="平台">
        <el-select v-model="platformId" class="order-info__control" clearable placeholder="选择平台">
          <el-option
            v-for="platform in platforms"
            :key="platform.id"
            :value="platform.id"
            :label="platform.name"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="店铺">
        <div class="order-info__store">
          <el-select
            v-model="storeId"
            class="order-info__control"
            clearable
            filterable
            :loading="storesLoading"
            placeholder="选择店铺"
          >
            <el-option v-for="option in storeOptions" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
          <el-button link @click="creatingStore = !creatingStore">快速创建店铺</el-button>
        </div>
      </el-form-item>

      <div v-if="creatingStore" class="order-info__inline">
        <el-input v-model="storeForm.name" placeholder="店铺名称" />
        <el-input v-model="storeForm.url" placeholder="店铺链接（可选）" />
        <el-button type="primary" :loading="savingStore" @click="saveStore">保存店铺</el-button>
      </div>

      <el-form-item label="订单号">
        <el-input v-model="orderNo" class="order-info__control" placeholder="平台订单号" />
      </el-form-item>

      <el-form-item label="订单链接">
        <el-input v-model="orderUrl" class="order-info__control" placeholder="https://" />
      </el-form-item>

      <el-form-item label="下单日期">
        <el-date-picker v-model="orderedAt" class="order-info__control" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>

      <el-form-item label="币种">
        <el-select v-model="currency" class="order-info__control" :disabled="props.mode === 'edit'">
          <el-option v-for="option in currencyOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
    </el-form>
  </AppSection>
</template>

<style scoped>
.order-info__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0 16px;
}

.order-info__control {
  width: 100%;
}

.order-info__store {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.order-info__inline {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
</style>
