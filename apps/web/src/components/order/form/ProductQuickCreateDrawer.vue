<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, SUPPORTED_CURRENCIES } from '@hobilog/shared'
import { createProduct } from '@/api/product.api'
import type { ProductVo } from '@/types/models'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [product: ProductVo] }>()

interface QuickCreateForm {
  name: string
  coverUrl: string
  category: string
  ipName: string
  characterName: string
  manufacturer: string
  scale: string
  version: string
  officialPrice: number | null
  officialCurrency: string
}

function createEmptyForm(): QuickCreateForm {
  return {
    name: '',
    coverUrl: '',
    category: PRODUCT_CATEGORIES[0],
    ipName: '',
    characterName: '',
    manufacturer: '',
    scale: '',
    version: '',
    officialPrice: null,
    officialCurrency: SUPPORTED_CURRENCIES[0],
  }
}

const form = reactive<QuickCreateForm>(createEmptyForm())
const saving = ref(false)
const error = ref('')

const categoryOptions = PRODUCT_CATEGORIES.map(value => ({ value, label: PRODUCT_CATEGORY_LABELS[value] }))
const currencyOptions = SUPPORTED_CURRENCIES.map(value => ({ value, label: value }))

const officialPrice = computed({
  get: () => form.officialPrice ?? undefined,
  set: (value: number | undefined) => {
    form.officialPrice = value ?? null
  },
})

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    error.value = '商品名称必填'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const created = await createProduct({
      name: form.name.trim(),
      coverUrl: form.coverUrl || undefined,
      category: form.category as ProductVo['category'],
      ipName: form.ipName || undefined,
      characterName: form.characterName || undefined,
      manufacturer: form.manufacturer || undefined,
      scale: form.scale || undefined,
      version: form.version || undefined,
      officialPrice: form.officialPrice ?? undefined,
      officialCurrency: form.officialCurrency || undefined,
    })
    ElMessage.success('商品已创建并加入订单')
    Object.assign(form, createEmptyForm())
    emit('created', created)
    emit('update:modelValue', false)
  } catch (caught) {
    error.value = caught instanceof Error && caught.message ? caught.message : '创建失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer
    :model-value="props.modelValue"
    title="快速创建商品"
    size="460px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert v-if="error" class="quick-create__error" type="error" :closable="false" :title="error" />

    <el-form label-position="top">
      <el-form-item label="商品名称" required>
        <el-input v-model="form.name" placeholder="必填" />
      </el-form-item>
      <el-form-item label="商品图片 URL">
        <el-input v-model="form.coverUrl" placeholder="V0.1 直接粘贴图片直链" />
      </el-form-item>
      <el-form-item label="商品类型">
        <el-select v-model="form.category" class="quick-create__control">
          <el-option v-for="option in categoryOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
      <el-form-item label="IP">
        <el-input v-model="form.ipName" />
      </el-form-item>
      <el-form-item label="角色">
        <el-input v-model="form.characterName" />
      </el-form-item>
      <el-form-item label="厂商">
        <el-input v-model="form.manufacturer" />
      </el-form-item>
      <el-form-item label="比例">
        <el-input v-model="form.scale" placeholder="例如 1/7" />
      </el-form-item>
      <el-form-item label="版本">
        <el-input v-model="form.version" />
      </el-form-item>
      <el-form-item label="官方价格">
        <div class="quick-create__inline">
          <el-input-number v-model="officialPrice" :min="0" :controls="false" placeholder="留空表示待定" />
          <el-select v-model="form.officialCurrency" class="quick-create__currency">
            <el-option v-for="option in currencyOptions" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">创建并加入订单</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.quick-create__error {
  margin-bottom: 12px;
}

.quick-create__control {
  width: 100%;
}

.quick-create__inline {
  display: flex;
  gap: 8px;
  width: 100%;
}

.quick-create__currency {
  width: 110px;
  flex-shrink: 0;
}
</style>
