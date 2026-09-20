import { HttpStatus, Injectable } from '@nestjs/common'
import type { Paginated } from '@hobilog/shared'
import type { Prisma } from '../../generated/prisma/client'
import { BusinessException } from '../../common/exceptions/business.exception'
import { toPaginated } from '../../common/types/paginated'
import { PrismaService } from '../../database/prisma.service'
import type { CreateProductDto } from './dto/create-product.dto'
import type { QueryProductDto } from './dto/query-product.dto'
import type { UpdateProductDto } from './dto/update-product.dto'
import { toProductVo, type ProductVo } from './mapper/product.mapper'

const PRODUCT_INCLUDE = { productTags: true } satisfies Prisma.ProductInclude

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: QueryProductDto): Promise<Paginated<ProductVo>> {
    const where: Prisma.ProductWhereInput = {
      userId,
      status: query.status ?? 'ACTIVE',
      ...(query.category ? { category: query.category } : {}),
      ...(query.ipName ? { ipName: query.ipName } : {}),
      ...(query.characterName ? { characterName: query.characterName } : {}),
      ...(query.manufacturer ? { manufacturer: query.manufacturer } : {}),
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword, mode: 'insensitive' as const } },
              { originalName: { contains: query.keyword, mode: 'insensitive' as const } },
              { sku: { contains: query.keyword, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ])

    return toPaginated(rows.map(toProductVo), total, query.page, query.pageSize)
  }

  async getDetail(userId: string, id: string): Promise<ProductVo> {
    const product = await this.prisma.product.findFirst({
      where: { id, userId },
      include: PRODUCT_INCLUDE,
    })
    if (!product) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', '商品不存在')
    }
    return toProductVo(product)
  }

  async create(userId: string, dto: CreateProductDto): Promise<ProductVo> {
    const tagIds = await this.resolveTagIds(userId, dto.tagNames)
    const product = await this.prisma.product.create({
      data: {
        userId,
        name: dto.name,
        originalName: dto.originalName,
        coverUrl: dto.coverUrl,
        category: dto.category,
        ipName: dto.ipName,
        characterName: dto.characterName,
        manufacturer: dto.manufacturer,
        seriesName: dto.seriesName,
        scale: dto.scale,
        version: dto.version,
        sku: dto.sku,
        officialPrice: dto.officialPrice,
        officialCurrency: dto.officialCurrency,
        announcedAt: dto.announcedAt ? new Date(dto.announcedAt) : null,
        originalReleaseDate: dto.originalReleaseDate ? new Date(dto.originalReleaseDate) : null,
        releaseDatePrecision: dto.releaseDatePrecision,
        description: dto.description,
        ...(tagIds.length > 0 ? { productTags: { create: tagIds.map(tagId => ({ tagId })) } } : {}),
      },
      include: PRODUCT_INCLUDE,
    })
    return toProductVo(product)
  }

  async update(userId: string, id: string, dto: UpdateProductDto): Promise<ProductVo> {
    await this.assertOwned(userId, id)
    const tagIds = dto.tagNames ? await this.resolveTagIds(userId, dto.tagNames) : undefined

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        originalName: dto.originalName,
        coverUrl: dto.coverUrl,
        category: dto.category,
        ipName: dto.ipName,
        characterName: dto.characterName,
        manufacturer: dto.manufacturer,
        seriesName: dto.seriesName,
        scale: dto.scale,
        version: dto.version,
        sku: dto.sku,
        officialPrice: dto.officialPrice,
        officialCurrency: dto.officialCurrency,
        announcedAt: dto.announcedAt ? new Date(dto.announcedAt) : undefined,
        originalReleaseDate: dto.originalReleaseDate
          ? new Date(dto.originalReleaseDate)
          : undefined,
        releaseDatePrecision: dto.releaseDatePrecision,
        description: dto.description,
        ...(tagIds
          ? { productTags: { deleteMany: {}, create: tagIds.map(tagId => ({ tagId })) } }
          : {}),
      },
      include: PRODUCT_INCLUDE,
    })
    return toProductVo(product)
  }

  async archive(userId: string, id: string): Promise<ProductVo> {
    await this.assertOwned(userId, id)
    const product = await this.prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      include: PRODUCT_INCLUDE,
    })
    return toProductVo(product)
  }

  async getOwnedProductIds(userId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return []
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true },
    })
    return rows.map(row => row.id)
  }

  private async assertOwned(userId: string, id: string): Promise<void> {
    const found = await this.prisma.product.count({ where: { id, userId } })
    if (found === 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', '商品不存在')
    }
  }

  private async resolveTagIds(userId: string, tagNames?: string[]): Promise<string[]> {
    if (!tagNames || tagNames.length === 0) return []
    const names = [...new Set(tagNames.map(name => name.trim()).filter(Boolean))]
    const tags = await Promise.all(
      names.map(name =>
        this.prisma.tag.upsert({
          where: { userId_name: { userId, name } },
          create: { userId, name },
          update: {},
          select: { id: true },
        }),
      ),
    )
    return tags.map(tag => tag.id)
  }
}
