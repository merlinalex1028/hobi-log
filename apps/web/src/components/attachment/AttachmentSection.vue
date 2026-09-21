<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ATTACHMENT_TYPE_LABELS } from '@hobilog/shared'
import AppDate from '@/components/common/AppDate.vue'
import AppSection from '@/components/common/AppSection.vue'
import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import type { OrderDetail } from '@/types/models'

const props = defineProps<{ orderId: string; attachments: OrderDetail['attachments'] }>()
const emit = defineEmits<{ changed: [] }>()

const { uploading, uploadOrderAttachment, removeAttachment, signedUrlOf } = useAttachmentUpload()
const fileInput = ref<HTMLInputElement | null>(null)

function pickFile(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    await uploadOrderAttachment({ orderId: props.orderId, file })
    ElMessage.success('附件已上传')
    emit('changed')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传失败')
  }
}

async function openAttachment(id: string): Promise<void> {
  try {
    const url = await signedUrlOf(id)
    window.open(url, '_blank', 'noreferrer')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '获取附件链接失败')
  }
}

async function remove(id: string): Promise<void> {
  try {
    await removeAttachment(id)
    ElMessage.success('附件已删除')
    emit('changed')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

function typeLabel(type: string): string {
  return ATTACHMENT_TYPE_LABELS[type as keyof typeof ATTACHMENT_TYPE_LABELS] ?? type
}
</script>

<template>
  <AppSection title="附件" description="订单截图、补款截图、付款凭证">
    <template #extra>
      <el-button size="small" :loading="uploading" @click="pickFile">上传附件</el-button>
      <input ref="fileInput" class="attachment-section__input" type="file" @change="onFileChange" />
    </template>

    <div v-if="props.attachments.length === 0" class="text-secondary">还没有附件。</div>
    <div v-else class="attachment-section__list">
      <div v-for="attachment in props.attachments" :key="attachment.id" class="attachment-section__item">
        <div>
          <div class="attachment-section__name">{{ attachment.fileName }}</div>
          <div class="text-secondary attachment-section__meta">
            {{ typeLabel(attachment.type) }} · <AppDate :value="attachment.createdAt" />
          </div>
        </div>
        <div class="attachment-section__actions">
          <el-button link type="primary" @click="openAttachment(attachment.id)">查看</el-button>
          <el-button link type="danger" @click="remove(attachment.id)">删除</el-button>
        </div>
      </div>
    </div>
  </AppSection>
</template>

<style scoped>
.attachment-section__input {
  display: none;
}

.attachment-section__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-section__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.attachment-section__name {
  font-weight: 600;
}

.attachment-section__meta {
  font-size: 12px;
}

.attachment-section__actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
</style>
