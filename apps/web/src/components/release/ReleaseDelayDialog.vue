<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import AppDate from '@/components/common/AppDate.vue'
import { delayMonthsBetween } from '@/utils/release'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    currentDate?: string | null
    currentPrecision?: 'DAY' | 'MONTH'
    saving?: boolean
  }>(),
  { currentDate: null, currentPrecision: 'MONTH', saving: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [
    payload: {
      newDate: string
      precision: 'DAY' | 'MONTH'
      oldDate?: string
      source?: string
      sourceUrl?: string
      note?: string
    },
  ]
}>()

const form = reactive<{ newDate: string; precision: 'DAY' | 'MONTH'; source: string; sourceUrl: string; note: string }>({
  newDate: '',
  precision: 'MONTH',
  source: '',
  sourceUrl: '',
  note: '',
})

const error = ref('')

const pickerType = computed(() => (form.precision === 'MONTH' ? 'month' : 'date'))
const valueFormat = computed(() => (form.precision === 'MONTH' ? 'YYYY-MM' : 'YYYY-MM-DD'))

const delayMonths = computed(() => {
  if (!props.currentDate || !form.newDate) return 0
  const newDate = form.precision === 'MONTH' ? `${form.newDate}-01` : form.newDate
  return delayMonthsBetween(props.currentDate, newDate)
})

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return
    error.value = ''
    Object.assign(form, {
      newDate: '',
      precision: props.currentPrecision,
      source: '',
      sourceUrl: '',
      note: '',
    })
  },
  { immediate: true },
)

function submit(): void {
  if (!form.newDate) {
    error.value = '请选择新的预计出货日期'
    return
  }
  emit('submit', {
    newDate: form.newDate,
    precision: form.precision,
    oldDate: props.currentDate ?? undefined,
    source: form.source || undefined,
    sourceUrl: form.sourceUrl || undefined,
    note: form.note || undefined,
  })
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    title="更新预计出货"
    width="480px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
      <el-form-item label="当前预计">
        <AppDate :value="props.currentDate" :precision="props.currentPrecision" />
      </el-form-item>
      <el-form-item label="新预计" required>
        <el-date-picker v-model="form.newDate" class="release-delay__control" :type="pickerType" :value-format="valueFormat" />
      </el-form-item>
      <el-form-item label="精度">
        <el-select v-model="form.precision" class="release-delay__control" @change="form.newDate = ''">
          <el-option value="MONTH" label="精确到月" />
          <el-option value="DAY" label="精确到日" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源">
        <el-input v-model="form.source" placeholder="官方公告 / 店铺通知" />
      </el-form-item>
      <el-form-item label="来源链接">
        <el-input v-model="form.sourceUrl" placeholder="https://" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.note" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>

    <el-alert v-if="delayMonths > 0" type="warning" :closable="false" show-icon>
      本次延期 {{ delayMonths }} 个月
    </el-alert>
    <el-alert v-else-if="delayMonths < 0" type="success" :closable="false" show-icon>
      比原计划提前 {{ Math.abs(delayMonths) }} 个月
    </el-alert>

    <p v-if="error" class="text-danger release-delay__error">{{ error }}</p>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="props.saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.release-delay__control {
  width: 100%;
}

.release-delay__error {
  margin: 8px 0 0;
}
</style>
