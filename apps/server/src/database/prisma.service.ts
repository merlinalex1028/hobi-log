import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get<string>('DATABASE_URL') as string,
        // The Supabase pooler connection is unreliable when several new sockets
        // are opened concurrently from the local development network.
        max: 1,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 15_000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 30_000,
        // Supavisor may retire idle sockets; rotate clients before stale connections linger.
        maxLifetimeSeconds: 300,
      }, {
        onPoolError: error => this.logger.error(`数据库连接池错误：${error.message}`),
        onConnectionError: error => this.logger.error(`数据库连接错误：${error.message}`),
      }),
    })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
    try {
      await this.$queryRaw`SELECT 1`
    } catch (error) {
      this.logger.warn(`数据库预热失败，首个请求可能需要重新建连：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
