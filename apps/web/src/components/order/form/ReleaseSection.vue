<script setup lang="ts">
import { computed } from 'vue'
import AppSection from '@/components/common/AppSection.vue'
import type { OrderFormModel } from '@/types/forms'

const props = defineProps<{ modelValue: OrderFormModel }>()
const emit = defineEmits<{ change: [Partial<OrderFormModel>] }>()

const useExpectedRelease = computed({
  get: () => props.modelValue.useExpectedRelease,
  set: (value: boolean) => emit('change', { useExpectedRelease: value }),
})

const releaseDate = computed({
  get: () => props.modelValue.releaseDate,
  set: (value: string) => emit('change', { releaseDate: value ?? '' }),
})

const releaseDatePrecision = computed({
  get: () => props.modelValue.releaseDatePrecision,
  set: (value: 'DAY' | 'MONTH') => emit('change', { releaseDatePrecision: value, releaseDate: '' }),
})

const pickerType = computed(() => (props.modelValue.releaseDatePrecision === 'MONTH' ? 'month' : 'date'))
const valueFormat = computed(() => (props.modelValue.releaseDatePrecision === 'MONTH' ? 'YYYY-MM' : 'YYYY-MM-DD'))
</script>

<template>
  <AppSection title="预计出货" description="只记录“预计”，实际出货在详情页标记">
    <el-switch v-model="useExpectedRelease" active-text="记录预计出货" />

    <el-form v-if="props.modelValue.useExpectedRelease" label-position="top" class="release-section__form">
      <el-form-item label="预计日期">
        <el-date-picker
          v-model="releaseDate"
          class="release-section__control"
          :type="pickerType"
          :value-format="valueFormat"
          placeholder="选择日期"
        />
      </el-form-item>
      <el-form-item label="精度">
        <el-select v-model="releaseDatePrecision" class="release-section__control">
          <el-option value="MONTH" label="精确到月" />
          <el-option value="DAY" label="精确到日" />
        </el-select>
      </el-form-item>
    </el-form>
  </AppSection>
</template>

<style scoped>
.release-section__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0 16px;
  margin-top: 16px;
}

.release-section__control {
  width: 100%;
}
</style>
