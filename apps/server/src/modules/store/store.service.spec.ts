import { StoreService } from './store.service'
import type { StoreWithPlatform } from './mapper/store.mapper'

const baseRow = (patch: Partial<StoreWithPlatform> = {}): StoreWithPlatform => ({
  id: 's1',
  userId: 'u1',
  platformId: 'pf1',
  name: 'XXX手办店',
  url: null,
  contact: null,
  note: null,
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  platform: { name: '淘宝' },
  ...patch,
})

const prismaMock = () => ({
  store: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue({ id: 's1' }),
  },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
})

const platformMock = () => ({ assertOwned: vi.fn().mockResolvedValue(undefined) })

describe('StoreService', () => {
  it('创建店铺时校验平台归属', async () => {
    const prisma = prismaMock()
    const platformService = platformMock()
    const service = new StoreService(prisma as never, platformService as never)
    prisma.store.create.mockResolvedValue(baseRow())
    const vo = await service.create('u1', { name: 'XXX手办店', platformId: 'pf1' })
    expect(platformService.assertOwned).toHaveBeenCalledWith('u1', 'pf1')
    expect(vo.platformName).toBe('淘宝')
  })

  it('不传 platformId 时跳过校验', async () => {
    const prisma = prismaMock()
    const platformService = platformMock()
    const service = new StoreService(prisma as never, platformService as never)
    prisma.store.create.mockResolvedValue(baseRow({ id: 's2', platformId: null, platform: null }))
    await service.create('u1', { name: '线下店' })
    expect(platformService.assertOwned).not.toHaveBeenCalled()
    expect(prisma.store.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ platformId: null }) }),
    )
  })

  it('平台校验失败时不写库', async () => {
    const prisma = prismaMock()
    const platformService = platformMock()
    platformService.assertOwned.mockRejectedValue(new Error('PLATFORM_NOT_FOUND'))
    const service = new StoreService(prisma as never, platformService as never)
    await expect(service.create('u1', { name: 'x', platformId: 'pf9' })).rejects.toThrow(
      'PLATFORM_NOT_FOUND',
    )
    expect(prisma.store.create).not.toHaveBeenCalled()
  })

  it('list 强制带 userId 并支持平台过滤', async () => {
    const prisma = prismaMock()
    const service = new StoreService(prisma as never, platformMock() as never)
    const result = await service.list('u1', { page: 1, pageSize: 20, platformId: 'pf1' })
    expect(prisma.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', platformId: 'pf1' } }),
    )
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
  })

  it('assertOwned 不存在时抛 404 STORE_NOT_FOUND', async () => {
    const prisma = prismaMock()
    const service = new StoreService(prisma as never, platformMock() as never)
    prisma.store.count.mockResolvedValue(0)
    await expect(service.assertOwned('u1', 's1')).rejects.toMatchObject({ status: 404 })
  })

  it('update 校验店铺归属后刷新平台', async () => {
    const prisma = prismaMock()
    const platformService = platformMock()
    prisma.store.count.mockResolvedValue(1)
    prisma.store.update.mockResolvedValue(baseRow({ name: '新店名' }))
    const service = new StoreService(prisma as never, platformService as never)
    const vo = await service.update('u1', 's1', { name: '新店名', platformId: 'pf1' })
    expect(platformService.assertOwned).toHaveBeenCalledWith('u1', 'pf1')
    expect(vo.name).toBe('新店名')
  })

  it('remove 校验归属后删除', async () => {
    const prisma = prismaMock()
    prisma.store.count.mockResolvedValue(1)
    const service = new StoreService(prisma as never, platformMock() as never)
    await expect(service.remove('u1', 's1')).resolves.toEqual({ id: 's1' })
    expect(prisma.store.delete).toHaveBeenCalledWith({ where: { id: 's1' } })
  })
})
