import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Paginated } from '@hobilog/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import { CreateStoreDto } from './dto/create-store.dto'
import { QueryStoreDto } from './dto/query-store.dto'
import { UpdateStoreDto } from './dto/update-store.dto'
import type { StoreVo } from './mapper/store.mapper'
import { StoreService } from './store.service'

@ApiTags('stores')
@ApiBearerAuth()
@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryStoreDto): Promise<Paginated<StoreVo>> {
    return this.storeService.list(user.id, query)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStoreDto): Promise<StoreVo> {
    return this.storeService.create(user.id, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
  ): Promise<StoreVo> {
    return this.storeService.update(user.id, id, dto)
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ id: string }> {
    return this.storeService.remove(user.id, id)
  }
}
