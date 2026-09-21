import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import configuration from './config/configuration'
import { validateEnv } from './config/env.validation'
import { PrismaModule } from './database/prisma.module'
import { AttachmentModule } from './modules/attachment/attachment.module'
import { AuthModule } from './modules/auth/auth.module'
import { CalendarModule } from './modules/calendar/calendar.module'
import { CollectionModule } from './modules/collection/collection.module'
import { HealthModule } from './modules/health/health.module'
import { NotificationModule } from './modules/notification/notification.module'
import { OrderModule } from './modules/order/order.module'
import { PaymentModule } from './modules/payment/payment.module'
import { PlatformModule } from './modules/platform/platform.module'
import { ProductModule } from './modules/product/product.module'
import { ReleaseModule } from './modules/release/release.module'
import { ShipmentModule } from './modules/shipment/shipment.module'
import { StatisticsModule } from './modules/statistics/statistics.module'
import { StoreModule } from './modules/store/store.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    PrismaModule,
    AuthModule,
    HealthModule,
    ProductModule,
    PlatformModule,
    StoreModule,
    OrderModule,
    PaymentModule,
    ReleaseModule,
    ShipmentModule,
    StatisticsModule,
    CalendarModule,
    CollectionModule,
    AttachmentModule,
    NotificationModule,
  ],
})
export class AppModule {}
