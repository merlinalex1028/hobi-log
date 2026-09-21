import { randomUUID } from 'node:crypto'
import { HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { PrismaService } from '../../database/prisma.service'
import { SupabaseService } from '../auth/supabase.service'
import { OrderService } from '../order/order.service'
import { ProductService } from '../product/product.service'
import type { CreateAttachmentDto } from './dto/create-attachment.dto'
import { STORAGE_BUCKETS, type StorageBucket, type UploadUrlDto } from './dto/upload-url.dto'
import { toAttachmentVo, type AttachmentVo, type UploadUrlVo } from './mapper/attachment.mapper'

function isStorageBucket(value: string | undefined): value is StorageBucket {
  return STORAGE_BUCKETS.includes(value as StorageBucket)
}

function splitStoragePath(storagePath: string): { bucket: StorageBucket; path: string } | null {
  const [bucket, ...rest] = storagePath.split('/')
  if (!isStorageBucket(bucket)) return null
  const path = rest.join('/')
  return path.length === 0 ? null : { bucket, path }
}

@Injectable()
export class AttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly orderService: OrderService,
    private readonly productService: ProductService,
  ) {}

  async createUploadUrl(userId: string, dto: UploadUrlDto): Promise<UploadUrlVo> {
    await this.assertTargetOwned(userId, dto.targetType, dto.targetId)

    const safeName = dto.fileName.replace(/[^\w.\-]+/g, '_')
    const path = `${userId}/${dto.targetId}/${randomUUID()}-${safeName}`

    const { data, error } = await this.supabase.admin.storage
      .from(dto.bucket)
      .createSignedUploadUrl(path)
    if (error || !data) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, 'STORAGE_UNAVAILABLE', '文件上传地址生成失败')
    }

    return { bucket: dto.bucket, path, token: data.token, signedUrl: data.signedUrl }
  }

  async create(userId: string, dto: CreateAttachmentDto): Promise<AttachmentVo> {
    if (dto.orderId) await this.orderService.assertOwned(userId, dto.orderId)
    if (dto.productId) await this.assertProductOwned(userId, dto.productId)
    if (!dto.storagePath.startsWith(`${userId}/`)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'INVALID_STORAGE_PATH', '文件路径不合法')
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        userId,
        orderId: dto.orderId ?? null,
        productId: dto.productId ?? null,
        type: dto.type,
        fileName: dto.fileName,
        storagePath: `${dto.bucket}/${dto.storagePath}`,
        mimeType: dto.mimeType ?? null,
        fileSize: dto.fileSize === undefined ? null : BigInt(dto.fileSize),
      },
    })

    return toAttachmentVo(attachment)
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    const attachment = await this.prisma.attachment.findFirst({ where: { id, userId } })
    if (!attachment) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ATTACHMENT_NOT_FOUND', '附件不存在')
    }

    const target = splitStoragePath(attachment.storagePath)
    if (target) {
      await this.supabase.admin.storage.from(target.bucket).remove([target.path])
    }

    await this.prisma.attachment.delete({ where: { id } })
    return { id }
  }

  async createDownloadUrl(
    userId: string,
    id: string,
    expiresIn: number,
  ): Promise<{ signedUrl: string }> {
    const attachment = await this.prisma.attachment.findFirst({ where: { id, userId } })
    if (!attachment) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ATTACHMENT_NOT_FOUND', '附件不存在')
    }

    const target = splitStoragePath(attachment.storagePath)
    if (!target) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, 'STORAGE_UNAVAILABLE', '文件地址生成失败')
    }

    const { data, error } = await this.supabase.admin.storage
      .from(target.bucket)
      .createSignedUrl(target.path, expiresIn)
    if (error || !data) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, 'STORAGE_UNAVAILABLE', '文件地址生成失败')
    }

    return { signedUrl: data.signedUrl }
  }

  private async assertProductOwned(userId: string, productId: string): Promise<void> {
    const owned = await this.productService.getOwnedProductIds(userId, [productId])
    if (owned.length === 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', '商品不存在')
    }
  }

  private async assertTargetOwned(
    userId: string,
    targetType: UploadUrlDto['targetType'],
    targetId: string,
  ): Promise<void> {
    if (targetType === 'ORDER') {
      await this.orderService.assertOwned(userId, targetId)
      return
    }
    await this.assertProductOwned(userId, targetId)
  }
}
