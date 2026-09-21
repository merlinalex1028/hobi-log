<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    message?: string
    confirmText?: string
    danger?: boolean
  }>(),
  { confirmText: '确定' },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [] }>()

function setVisible(value: boolean): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <el-dialog
    class="app-confirm"
    :model-value="props.modelValue"
    :title="props.title"
    width="420px"
    @update:model-value="setVisible"
  >
    <p v-if="props.message" class="app-confirm__message">{{ props.message }}</p>
    <div class="app-confirm__body">
      <slot />
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button :type="props.danger ? 'danger' : 'primary'" @click="emit('confirm')">
        {{ props.confirmText }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.app-confirm__message {
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.app-confirm__body:not(:empty) {
  margin-top: 12px;
}
</style>
