import { Module } from '@nestjs/common'
import { PlatformModule } from '../platform/platform.module'
import { StoreController } from './store.controller'
import { StoreService } from './store.service'

@Module({
  imports: [PlatformModule],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
