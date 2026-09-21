export interface AttachmentVo {
  id: string
  type: string
  fileName: string
  storagePath: string
  mimeType: string | null
  fileSize: string | null
  createdAt: string
}

export interface UploadUrlVo {
  bucket: string
  path: string
  token: string
  signedUrl: string
}

export function toAttachmentVo(attachment: {
  id: string
  type: string
  fileName: string
  storagePath: string
  mimeType: string | null
  fileSize: bigint | null
  createdAt: Date
}): AttachmentVo {
  return {
    id: attachment.id,
    type: attachment.type,
    fileName: attachment.fileName,
    storagePath: attachment.storagePath,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize === null ? null : attachment.fileSize.toString(),
    createdAt: attachment.createdAt.toISOString(),
  }
}
