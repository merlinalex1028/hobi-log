import { Module } from '@nestjs/common'
import { OrderModule } from '../order/order.module'
import { ProductModule } from '../product/product.module'
import { AttachmentController } from './attachment.controller'
import { AttachmentService } from './attachment.service'

@Module({
  imports: [OrderModule, ProductModule],
  controllers: [AttachmentController],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentModule {}
