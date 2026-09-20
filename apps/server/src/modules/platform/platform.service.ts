import { HttpStatus, Injectable } from '@nestjs/common'
import type { Paginated } from '@hobilog/shared'
import type { Prisma } from '../../generated/prisma/client'
import { BusinessException } from '../../common/exceptions/business.exception'
import { toPaginated } from '../../common/types/paginated'
import { PrismaService } from '../../database/prisma.service'
import type { CreatePlatformDto } from './dto/create-platform.dto'
import type { QueryPlatformDto } from './dto/query-platform.dto'
import type { UpdatePlatformDto } from './dto/update-platform.dto'
import { toPlatformVo, type PlatformVo } from './mapper/platform.mapper'

const PLATFORM_INCLUDE = { _count: { select: { stores: true } } } satisfies Prisma.PlatformInclude

const PRESET_PLATFORM_NAMES = [
  '淘宝',
  '京东',
  'Bilibili 会员购',
  'Hpoi',
  'AmiAmi',
  'Good Smile',
  '闲鱼',
  '其他',
] as const

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: QueryPlatformDto): Promise<Paginated<PlatformVo>> {
    const where: Prisma.PlatformWhereInput = {
      userId,
      ...(query.keyword ? { name: { contains: query.keyword, mode: 'insensitive' as const } } : {}),
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.platform.findMany({
        where,
        include: PLATFORM_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.platform.count({ where }),
    ])

    return toPaginated(rows.map(toPlatformVo), total, query.page, query.pageSize)
  }

  async create(userId: string, dto: CreatePlatformDto): Promise<PlatformVo> {
    const platform = await this.prisma.platform.create({
      data: {
        userId,
        name: dto.name,
        logoUrl: dto.logoUrl,
        website: dto.website,
        region: dto.region,
        defaultCurrency: dto.defaultCurrency,
        note: dto.note,
      },
      include: PLATFORM_INCLUDE,
    })
    return toPlatformVo(platform)
  }

  async update(userId: string, id: string, dto: UpdatePlatformDto): Promise<PlatformVo> {
    await this.assertOwned(userId, id)
    const platform = await this.prisma.platform.update({
      where: { id },
      data: {
        name: dto.name,
        logoUrl: dto.logoUrl,
        website: dto.website,
        region: dto.region,
        defaultCurrency: dto.defaultCurrency,
        note: dto.note,
      },
      include: PLATFORM_INCLUDE,
    })
    return toPlatformVo(platform)
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.assertOwned(userId, id)
    await this.prisma.platform.delete({ where: { id } })
    return { id }
  }

  async assertOwned(userId: string, platformId: string): Promise<void> {
    const found = await this.prisma.platform.count({ where: { id: platformId, userId } })
    if (found === 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'PLATFORM_NOT_FOUND', '平台不存在')
    }
  }

  async createPresets(userId: string): Promise<{ created: number }> {
    const existing = await this.prisma.platform.findMany({
      where: { userId },
      select: { name: true },
    })
    const existingNames = new Set(existing.map(item => item.name))
    const missing = PRESET_PLATFORM_NAMES.filter(name => !existingNames.has(name))
    if (missing.length === 0) return { created: 0 }

    await this.prisma.platform.createMany({
      data: missing.map(name => ({ userId, name })),
      skipDuplicates: true,
    })
    return { created: missing.length }
  }
}
