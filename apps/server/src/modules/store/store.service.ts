import { HttpStatus, Injectable } from '@nestjs/common'
import type { Paginated } from '@hobilog/shared'
import type { Prisma } from '../../generated/prisma/client'
import { BusinessException } from '../../common/exceptions/business.exception'
import { toPaginated } from '../../common/types/paginated'
import { PrismaService } from '../../database/prisma.service'
import { PlatformService } from '../platform/platform.service'
import type { CreateStoreDto } from './dto/create-store.dto'
import type { QueryStoreDto } from './dto/query-store.dto'
import type { UpdateStoreDto } from './dto/update-store.dto'
import { toStoreVo, type StoreVo } from './mapper/store.mapper'

const STORE_INCLUDE = { platform: { select: { name: true } } } satisfies Prisma.StoreInclude

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformService: PlatformService,
  ) {}

  async list(userId: string, query: QueryStoreDto): Promise<Paginated<StoreVo>> {
    const where: Prisma.StoreWhereInput = {
      userId,
      ...(query.platformId ? { platformId: query.platformId } : {}),
      ...(query.keyword ? { name: { contains: query.keyword, mode: 'insensitive' as const } } : {}),
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        include: STORE_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.store.count({ where }),
    ])

    return toPaginated(rows.map(toStoreVo), total, query.page, query.pageSize)
  }

  async create(userId: string, dto: CreateStoreDto): Promise<StoreVo> {
    if (dto.platformId) {
      await this.platformService.assertOwned(userId, dto.platformId)
    }

    const store = await this.prisma.store.create({
      data: {
        userId,
        name: dto.name,
        platformId: dto.platformId ?? null,
        url: dto.url,
        contact: dto.contact,
        note: dto.note,
      },
      include: STORE_INCLUDE,
    })
    return toStoreVo(store)
  }

  async update(userId: string, id: string, dto: UpdateStoreDto): Promise<StoreVo> {
    await this.assertOwned(userId, id)
    if (dto.platformId) {
      await this.platformService.assertOwned(userId, dto.platformId)
    }

    const store = await this.prisma.store.update({
      where: { id },
      data: {
        name: dto.name,
        platformId: dto.platformId,
        url: dto.url,
        contact: dto.contact,
        note: dto.note,
      },
      include: STORE_INCLUDE,
    })
    return toStoreVo(store)
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.assertOwned(userId, id)
    await this.prisma.store.delete({ where: { id } })
    return { id }
  }

  async assertOwned(userId: string, storeId: string): Promise<void> {
    const found = await this.prisma.store.count({ where: { id: storeId, userId } })
    if (found === 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'STORE_NOT_FOUND', '店铺不存在')
    }
  }
}
