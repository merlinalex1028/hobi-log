import { HealthService } from './health.service'

describe('HealthService', () => {
  it('数据库可用时返回 up', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const service = new HealthService(prisma as never)
    await expect(service.checkDatabase()).resolves.toEqual({ status: 'ok', database: 'up' })
  })

  it('数据库不可用时抛 DATABASE_UNAVAILABLE', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('connect refused')) }
    const service = new HealthService(prisma as never)
    await expect(service.checkDatabase()).rejects.toMatchObject({ status: 503 })
  })
})
