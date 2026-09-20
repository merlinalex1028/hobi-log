import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { HealthService } from './health.service'

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '存活探针' })
  @ApiOkResponse({ schema: { example: { status: 'ok', uptime: 1.23 } } })
  check(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() }
  }

  @Get('db')
  @ApiOperation({ summary: '数据库连通性探针' })
  @ApiOkResponse({ schema: { example: { status: 'ok', database: 'up' } } })
  checkDatabase(): Promise<{ status: string; database: string }> {
    return this.healthService.checkDatabase()
  }
}
