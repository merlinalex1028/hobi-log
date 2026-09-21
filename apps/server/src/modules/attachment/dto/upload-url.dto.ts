import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'

export const STORAGE_BUCKETS = ['product-images', 'attachments'] as const
export type StorageBucket = (typeof STORAGE_BUCKETS)[number]

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export const MAX_FILE_SIZE = 10 * 1024 * 1024

export const ATTACHMENT_TARGET_TYPES = ['ORDER', 'PRODUCT'] as const
export type AttachmentTargetType = (typeof ATTACHMENT_TARGET_TYPES)[number]

export class UploadUrlDto {
  @ApiProperty({ enum: STORAGE_BUCKETS })
  @IsIn(STORAGE_BUCKETS)
  bucket!: StorageBucket

  @ApiProperty({ enum: ATTACHMENT_TARGET_TYPES })
  @IsIn(ATTACHMENT_TARGET_TYPES)
  targetType!: AttachmentTargetType

  @ApiProperty()
  @IsUUID()
  targetId!: string

  @ApiProperty({ example: 'invoice.png' })
  @IsString()
  @MaxLength(200)
  fileName!: string

  @ApiProperty({ enum: ALLOWED_MIME_TYPES })
  @IsIn(ALLOWED_MIME_TYPES)
  mimeType!: AllowedMimeType

  @ApiProperty({ example: 245_760 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE)
  fileSize!: number
}
