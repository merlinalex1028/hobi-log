import type { AttachmentType } from '@hobilog/shared'
import type { AttachmentVo, UploadUrlVo } from '@/types/models'
import { http } from './http'

export type StorageBucket = 'attachments' | 'product-images'

export interface UploadUrlPayload {
  bucket: StorageBucket
  targetType: 'ORDER' | 'PRODUCT'
  targetId: string
  fileName: string
  mimeType: string
  fileSize: number
}

export interface CreateAttachmentPayload {
  bucket: StorageBucket
  storagePath: string
  type: AttachmentType
  fileName: string
  mimeType?: string
  fileSize?: number
  orderId?: string
  productId?: string
}

export function getUploadUrl(payload: UploadUrlPayload): Promise<UploadUrlVo> {
  return http.post<UploadUrlVo>('/attachments/upload-url', payload).then(res => res.data)
}

export function createAttachment(payload: CreateAttachmentPayload): Promise<AttachmentVo> {
  return http.post<AttachmentVo>('/attachments', payload).then(res => res.data)
}

export function getAttachmentUrl(id: string, expiresIn?: number): Promise<{ signedUrl: string }> {
  return http
    .get<{ signedUrl: string }>(`/attachments/${id}/url`, { params: expiresIn ? { expiresIn } : undefined })
    .then(res => res.data)
}

export function deleteAttachment(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/attachments/${id}`).then(res => res.data)
}
