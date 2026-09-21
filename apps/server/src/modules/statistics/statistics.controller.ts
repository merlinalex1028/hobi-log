import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import { FuturePaymentQueryDto, RangeQueryDto } from './dto/statistics-query.dto'
import type {
  DashboardVo,
  DimensionStatVo,
  FuturePaymentVo,
  MonthlyPaymentVo,
} from './mapper/statistics.mapper'
import { StatisticsService } from './statistics.service'

@ApiTags('statistics')
@ApiBearerAuth()
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser): Promise<DashboardVo> {
    return this.statisticsService.getDashboard(user.id)
  }

  @Get('payments/monthly')
  monthly(
    @CurrentUser() user: AuthUser,
    @Query() query: RangeQueryDto,
  ): Promise<MonthlyPaymentVo[]> {
    return this.statisticsService.getMonthlyPayments(user.id, query.from, query.to, query.currency)
  }

  @Get('payments/future')
  future(
    @CurrentUser() user: AuthUser,
    @Query() query: FuturePaymentQueryDto,
  ): Promise<FuturePaymentVo[]> {
    return this.statisticsService.getFuturePayments(user.id, query.months, query.currency)
  }

  @Get('categories')
  categories(
    @CurrentUser() user: AuthUser,
    @Query() query: RangeQueryDto,
  ): Promise<DimensionStatVo[]> {
    return this.statisticsService.getDimension('category', user.id, query.from, query.to, query.currency)
  }

  @Get('platforms')
  platforms(
    @CurrentUser() user: AuthUser,
    @Query() query: RangeQueryDto,
  ): Promise<DimensionStatVo[]> {
    return this.statisticsService.getDimension('platform', user.id, query.from, query.to, query.currency)
  }

  @Get('manufacturers')
  manufacturers(
    @CurrentUser() user: AuthUser,
    @Query() query: RangeQueryDto,
  ): Promise<DimensionStatVo[]> {
    return this.statisticsService.getDimension('manufacturer', user.id, query.from, query.to, query.currency)
  }

  @Get('ips')
  ips(
    @CurrentUser() user: AuthUser,
    @Query() query: RangeQueryDto,
  ): Promise<DimensionStatVo[]> {
    return this.statisticsService.getDimension('ip', user.id, query.from, query.to, query.currency)
  }
}
