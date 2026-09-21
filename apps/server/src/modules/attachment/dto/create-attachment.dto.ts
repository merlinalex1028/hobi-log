import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator'
import { ATTACHMENT_TYPES } from '@hobilog/shared'
import type { AttachmentType } from '@hobilog/shared'
import { STORAGE_BUCKETS, type StorageBucket } from './upload-url.dto'

export class CreateAttachmentDto {
  @ApiProperty({ enum: STORAGE_BUCKETS })
  @IsIn(STORAGE_BUCKETS)
  bucket!: StorageBucket

  @ApiProperty({ description: 'upload-url 返回的 path' })
  @IsString()
  storagePath!: string

  @ApiProperty({ enum: ATTACHMENT_TYPES })
  @IsIn(ATTACHMENT_TYPES)
  type!: AttachmentType

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  fileName!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSize?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string
}
