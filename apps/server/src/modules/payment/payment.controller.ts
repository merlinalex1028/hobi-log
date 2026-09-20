import { Body, Controller, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import type { OrderDetailVo } from '../order/mapper/order.mapper'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { MarkPaidDto } from './dto/mark-paid.dto'
import { RefundPaymentDto } from './dto/refund-payment.dto'
import { UpdatePaymentDto } from './dto/update-payment.dto'
import { PaymentService } from './payment.service'

@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('orders/:orderId/payments')
  create(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: CreatePaymentDto,
  ): Promise<OrderDetailVo> {
    return this.paymentService.create(user.id, orderId, dto)
  }

  @Patch('payments/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ): Promise<OrderDetailVo> {
    return this.paymentService.update(user.id, id, dto)
  }

  @Post('payments/:id/paid')
  markPaid(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
  ): Promise<OrderDetailVo> {
    return this.paymentService.markPaid(user.id, id, dto)
  }

  @Post('payments/:id/refund')
  refund(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
  ): Promise<OrderDetailVo> {
    return this.paymentService.refund(user.id, id, dto)
  }
}
