import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get<string>('DATABASE_URL') as string,
        max: 5,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 15_000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 30_000,
        // Supavisor may retire idle sockets; rotate clients before stale connections linger.
        maxLifetimeSeconds: 300,
      }),
    })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
