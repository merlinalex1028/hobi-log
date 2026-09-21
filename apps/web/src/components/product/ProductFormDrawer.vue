<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { z } from 'zod'
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, SUPPORTED_CURRENCIES } from '@hobilog/shared'
import { createProduct, updateProduct, type CreateProductPayload } from '@/api/product.api'
import type { ProductFormState } from '@/types/forms'
import type { ProductVo } from '@/types/models'

const props = withDefaults(defineProps<{ modelValue: boolean; product?: ProductVo | null }>(), { product: null })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [product: ProductVo] }>()

const saving = ref(false)
const errors = ref<string[]>([])

function createEmptyForm(): ProductFormState {
  return {
    name: '',
    originalName: '',
    coverUrl: '',
    category: 'SCALE_FIGURE',
    ipName: '',
    characterName: '',
    manufacturer: '',
    seriesName: '',
    scale: '',
    version: '',
    sku: '',
    officialPrice: null,
    officialCurrency: 'CNY',
    announcedAt: '',
    originalReleaseDate: '',
    releaseDatePrecision: 'MONTH',
    description: '',
    tagNames: [],
  }
}

const form = reactive<ProductFormState>(createEmptyForm())

const categoryOptions = PRODUCT_CATEGORIES.map(value => ({ value, label: PRODUCT_CATEGORY_LABELS[value] }))
const currencyOptions = SUPPORTED_CURRENCIES.map(value => ({ value, label: value }))

const title = computed(() => (props.product ? '编辑商品' : '新建商品'))
const releaseDatePickerType = computed(() => (form.releaseDatePrecision === 'MONTH' ? 'month' : 'date'))
const releaseDateValueFormat = computed(() => (form.releaseDatePrecision === 'MONTH' ? 'YYYY-MM' : 'YYYY-MM-DD'))

const productFormSchema = z.object({
  name: z.string().min(1),
  officialPrice: z.number().min(0).nullable(),
})

const FIELD_MESSAGES: Record<string, string> = {
  name: '商品名称必填',
  officialPrice: '官方价格不能为负',
}

function fillFromProduct(product: ProductVo | null): void {
  Object.assign(form, createEmptyForm())
  errors.value = []
  if (!product) return
  Object.assign(form, {
    name: product.name,
    originalName: product.originalName ?? '',
    coverUrl: product.coverUrl ?? '',
    category: product.category,
    ipName: product.ipName ?? '',
    characterName: product.characterName ?? '',
    manufacturer: product.manufacturer ?? '',
    seriesName: product.seriesName ?? '',
    scale: product.scale ?? '',
    version: product.version ?? '',
    sku: product.sku ?? '',
    officialPrice: product.officialPrice,
    officialCurrency: product.officialCurrency ?? 'CNY',
    announcedAt: product.announcedAt ? product.announcedAt.slice(0, 10) : '',
    originalReleaseDate: product.originalReleaseDate ?? '',
    releaseDatePrecision: product.releaseDatePrecision === 'DAY' ? 'DAY' : 'MONTH',
    description: product.description ?? '',
  })
}

watch(
  () => props.modelValue,
  visible => {
    if (visible) fillFromProduct(props.product ?? null)
  },
  { immediate: true },
)

const officialPrice = computed({
  get: () => form.officialPrice,
  set: (value: number | undefined) => {
    form.officialPrice = value ?? null
  },
})

function validate(): boolean {
  const result = productFormSchema.safeParse({ name: form.name.trim(), officialPrice: form.officialPrice })
  if (result.success) {
    errors.value = []
    return true
  }
  errors.value = result.error.issues.map(issue => FIELD_MESSAGES[String(issue.path[0] ?? '')] ?? '表单校验失败')
  return false
}

function toPayload(): CreateProductPayload {
  return {
    name: form.name.trim(),
    originalName: form.originalName || undefined,
    coverUrl: form.coverUrl || undefined,
    category: form.category,
    ipName: form.ipName || undefined,
    characterName: form.characterName || undefined,
    manufacturer: form.manufacturer || undefined,
    seriesName: form.seriesName || undefined,
    scale: form.scale || undefined,
    version: form.version || undefined,
    sku: form.sku || undefined,
    officialPrice: form.officialPrice === null ? undefined : form.officialPrice,
    officialCurrency: form.officialCurrency || undefined,
    announcedAt: form.announcedAt || undefined,
    originalReleaseDate: form.originalReleaseDate || undefined,
    releaseDatePrecision: form.releaseDatePrecision,
    description: form.description || undefined,
    tagNames: form.tagNames.length > 0 ? form.tagNames : undefined,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '保存失败，请稍后重试'
}

async function submit(): Promise<void> {
  if (!validate()) return
  saving.value = true
  try {
    const payload = toPayload()
    const saved = props.product ? await updateProduct(props.product.id, payload) : await createProduct(payload)
    ElMessage.success(props.product ? '商品已更新' : '商品已创建')
    emit('saved', saved)
    emit('update:modelValue', false)
  } catch (error) {
    errors.value = [errorMessage(error)]
  } finally {
    saving.value = false
  }
}

function close(): void {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-drawer
    :model-value="props.modelValue"
    :title="title"
    size="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert v-if="errors.length > 0" type="error" :closable="false" class="product-form__errors">
      <p v-for="message in errors" :key="message">{{ message }}</p>
    </el-alert>

    <el-form label-position="top">
      <el-form-item label="商品名称" required>
        <el-input v-model="form.name" placeholder="必填，例如：芙宁娜 1/7 手办" />
      </el-form-item>
      <el-form-item label="别名 / 原名">
        <el-input v-model="form.originalName" />
      </el-form-item>
      <el-form-item label="封面图片 URL">
        <el-input v-model="form.coverUrl" placeholder="V0.1 直接粘贴图片直链" />
      </el-form-item>
      <el-form-item label="商品类型">
        <el-select v-model="form.category" class="product-form__control">
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
      <el-form-item label="系列">
        <el-input v-model="form.seriesName" />
      </el-form-item>
      <el-form-item label="比例">
        <el-input v-model="form.scale" placeholder="例如 1/7" />
      </el-form-item>
      <el-form-item label="版本">
        <el-input v-model="form.version" />
      </el-form-item>
      <el-form-item label="SKU">
        <el-input v-model="form.sku" />
      </el-form-item>
      <el-form-item label="官方价格">
        <div class="product-form__inline">
          <el-input-number v-model="officialPrice" :min="0" :controls="false" placeholder="留空表示待定" />
          <el-select v-model="form.officialCurrency" class="product-form__currency">
            <el-option v-for="option in currencyOptions" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
        </div>
      </el-form-item>
      <el-form-item label="官方公布时间">
        <el-date-picker v-model="form.announcedAt" type="date" value-format="YYYY-MM-DD" class="product-form__control" />
      </el-form-item>
      <el-form-item label="预计发售时间">
        <div class="product-form__inline">
          <el-date-picker
            v-model="form.originalReleaseDate"
            :type="releaseDatePickerType"
            :value-format="releaseDateValueFormat"
            placeholder="选择日期"
          />
          <el-select
            v-model="form.releaseDatePrecision"
            class="product-form__precision"
            @change="form.originalReleaseDate = ''"
          >
            <el-option value="DAY" label="精确到日" />
            <el-option value="MONTH" label="精确到月" />
          </el-select>
        </div>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="标签">
        <el-select
          v-model="form.tagNames"
          multiple
          filterable
          allow-create
          default-first-option
          :reserve-keyword="false"
          class="product-form__control"
          placeholder="输入后回车可新增标签"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.product-form__errors {
  margin-bottom: 12px;
}

.product-form__control {
  width: 100%;
}

.product-form__inline {
  display: flex;
  gap: 8px;
  width: 100%;
}

.product-form__currency {
  width: 110px;
  flex-shrink: 0;
}

.product-form__precision {
  width: 130px;
  flex-shrink: 0;
}
</style>
