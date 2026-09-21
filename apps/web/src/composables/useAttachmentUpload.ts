import { ref, type Ref } from 'vue'
import type { AttachmentType } from '@hobilog/shared'
import { createAttachment, deleteAttachment, getAttachmentUrl, getUploadUrl } from '@/api/attachment.api'
import { supabase } from '@/lib/supabase'
import type { AttachmentVo } from '@/types/models'

export interface UploadAttachmentInput {
  orderId: string
  file: File
  type?: AttachmentType
}

export interface UseAttachmentUploadReturn {
  uploading: Ref<boolean>
  uploadOrderAttachment: (input: UploadAttachmentInput) => Promise<AttachmentVo>
  removeAttachment: (id: string) => Promise<void>
  signedUrlOf: (id: string) => Promise<string>
}

export function useAttachmentUpload(): UseAttachmentUploadReturn {
  const uploading = ref(false)

  async function uploadOrderAttachment(input: UploadAttachmentInput): Promise<AttachmentVo> {
    uploading.value = true
    try {
      const target = await getUploadUrl({
        bucket: 'attachments',
        targetType: 'ORDER',
        targetId: input.orderId,
        fileName: input.file.name,
        mimeType: input.file.type,
        fileSize: input.file.size,
      })

      const { error } = await supabase.storage
        .from(target.bucket)
        .uploadToSignedUrl(target.path, target.token, input.file)
      if (error) throw new Error(error.message)

      return await createAttachment({
        bucket: 'attachments',
        storagePath: target.path,
        type: input.type ?? 'OTHER',
        fileName: input.file.name,
        mimeType: input.file.type,
        fileSize: input.file.size,
        orderId: input.orderId,
      })
    } finally {
      uploading.value = false
    }
  }

  async function removeAttachment(id: string): Promise<void> {
    await deleteAttachment(id)
  }

  async function signedUrlOf(id: string): Promise<string> {
    const result = await getAttachmentUrl(id)
    return result.signedUrl
  }

  return { uploading, uploadOrderAttachment, removeAttachment, signedUrlOf }
}
