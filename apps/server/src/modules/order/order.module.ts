import { Module } from '@nestjs/common'
import { PlatformModule } from '../platform/platform.module'
import { ProductModule } from '../product/product.module'
import { StoreModule } from '../store/store.module'
import { OrderController } from './order.controller'
import { OrderService } from './order.service'

@Module({
  imports: [ProductModule, PlatformModule, StoreModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
