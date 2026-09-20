import { Module } from '@nestjs/common'
import { OrderModule } from '../order/order.module'
import { ShipmentController } from './shipment.controller'
import { ShipmentService } from './shipment.service'

@Module({
  imports: [OrderModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
  exports: [ShipmentService],
})
export class ShipmentModule {}
