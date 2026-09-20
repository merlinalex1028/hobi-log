import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Paginated } from '@hobilog/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import { CreatePlatformDto } from './dto/create-platform.dto'
import { QueryPlatformDto } from './dto/query-platform.dto'
import { UpdatePlatformDto } from './dto/update-platform.dto'
import type { PlatformVo } from './mapper/platform.mapper'
import { PlatformService } from './platform.service'

@ApiTags('platforms')
@ApiBearerAuth()
@Controller('platforms')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryPlatformDto,
  ): Promise<Paginated<PlatformVo>> {
    return this.platformService.list(user.id, query)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePlatformDto): Promise<PlatformVo> {
    return this.platformService.create(user.id, dto)
  }

  @Post('presets')
  createPresets(@CurrentUser() user: AuthUser): Promise<{ created: number }> {
    return this.platformService.createPresets(user.id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlatformDto,
  ): Promise<PlatformVo> {
    return this.platformService.update(user.id, id, dto)
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ id: string }> {
    return this.platformService.remove(user.id, id)
  }
}
