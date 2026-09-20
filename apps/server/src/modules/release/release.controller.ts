import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import type { OrderDetailVo } from '../order/mapper/order.mapper'
import { BalanceOpenDto } from './dto/balance-open.dto'
import { DelayReleaseDto } from './dto/delay-release.dto'
import { ReleaseEventDto } from './dto/release-event.dto'
import { ReleaseService } from './release.service'

@ApiTags('release')
@ApiBearerAuth()
@Controller('orders/:orderId/release')
export class ReleaseController {
  constructor(private readonly releaseService: ReleaseService) {}

  @Post('delay')
  delay(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: DelayReleaseDto,
  ): Promise<OrderDetailVo> {
    return this.releaseService.delay(user.id, orderId, dto)
  }

  @Post('released')
  released(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: ReleaseEventDto,
  ): Promise<OrderDetailVo> {
    return this.releaseService.markReleased(user.id, orderId, dto)
  }

  @Post('store-arrived')
  storeArrived(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: ReleaseEventDto,
  ): Promise<OrderDetailVo> {
    return this.releaseService.markStoreArrived(user.id, orderId, dto)
  }

  @Post('balance-open')
  balanceOpen(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: BalanceOpenDto,
  ): Promise<OrderDetailVo> {
    return this.releaseService.openBalance(user.id, orderId, dto)
  }
}
