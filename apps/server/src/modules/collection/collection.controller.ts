import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Paginated } from '@hobilog/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto'
import type { AuthUser } from '../auth/auth.types'
import { CollectionService } from './collection.service'
import type { CollectionItemVo, CollectionStatsVo } from './mapper/collection.mapper'

@ApiTags('collection')
@ApiBearerAuth()
@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<CollectionItemVo>> {
    return this.collectionService.list(user.id, query.page, query.pageSize)
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser): Promise<CollectionStatsVo> {
    return this.collectionService.stats(user.id)
  }
}
