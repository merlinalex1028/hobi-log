import { HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkDatabase(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, 'DATABASE_UNAVAILABLE', '数据库不可用')
    }
    return { status: 'ok', database: 'up' }
  }
}
