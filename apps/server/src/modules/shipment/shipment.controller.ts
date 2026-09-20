import { Body, Controller, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import type { OrderDetailVo } from '../order/mapper/order.mapper'
import { CreateShipmentDto } from './dto/create-shipment.dto'
import { DeliverShipmentDto } from './dto/deliver-shipment.dto'
import { UpdateShipmentDto } from './dto/update-shipment.dto'
import { ShipmentService } from './shipment.service'

@ApiTags('shipments')
@ApiBearerAuth()
@Controller()
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post('orders/:orderId/shipments')
  create(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: CreateShipmentDto,
  ): Promise<OrderDetailVo> {
    return this.shipmentService.create(user.id, orderId, dto)
  }

  @Patch('shipments/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
  ): Promise<OrderDetailVo> {
    return this.shipmentService.update(user.id, id, dto)
  }

  @Post('shipments/:id/delivered')
  delivered(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DeliverShipmentDto,
  ): Promise<OrderDetailVo> {
    return this.shipmentService.markDelivered(user.id, id, dto)
  }
}
