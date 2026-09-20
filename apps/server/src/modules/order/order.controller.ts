import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Paginated } from '@hobilog/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import { CancelOrderDto } from './dto/cancel-order.dto'
import { CreateOrderDto } from './dto/create-order.dto'
import { QueryOrderDto } from './dto/query-order.dto'
import { UpdateOrderDto } from './dto/update-order.dto'
import { OrderService } from './order.service'
import type { OrderDetailVo, OrderListItemVo } from './mapper/order.mapper'

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryOrderDto): Promise<Paginated<OrderListItemVo>> {
    return this.orderService.list(user.id, query)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto): Promise<OrderDetailVo> {
    return this.orderService.create(user.id, dto)
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderDetailVo> {
    return this.orderService.getDetail(user.id, id)
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderDto): Promise<OrderDetailVo> {
    return this.orderService.update(user.id, id, dto)
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelOrderDto): Promise<OrderDetailVo> {
    return this.orderService.cancel(user.id, id, dto)
  }
}
