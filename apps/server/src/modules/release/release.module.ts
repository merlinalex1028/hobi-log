import { Module } from '@nestjs/common'
import { OrderModule } from '../order/order.module'
import { ReleaseController } from './release.controller'
import { ReleaseService } from './release.service'

@Module({
  imports: [OrderModule],
  controllers: [ReleaseController],
  providers: [ReleaseService],
  exports: [ReleaseService],
})
export class ReleaseModule {}
