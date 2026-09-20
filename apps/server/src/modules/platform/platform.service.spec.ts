import { PlatformService } from './platform.service'
import type { PlatformWithCount } from './mapper/platform.mapper'

const baseRow = (patch: Partial<PlatformWithCount> = {}): PlatformWithCount => ({
  id: 'pf1',
  userId: 'u1',
  name: '淘宝',
  logoUrl: null,
  website: null,
  region: null,
  defaultCurrency: 'CNY',
  note: null,
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  _count: { stores: 0 },
  ...patch,
})

const prismaMock = () => ({
  platform: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue({ id: 'pf1' }),
    createMany: vi.fn().mockResolvedValue({ count: 7 }),
  },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
})

describe('PlatformService', () => {
  it('list 带 userId 且返回分页形状', async () => {
    const prisma = prismaMock()
    const service = new PlatformService(prisma as never)
    const result = await service.list('u1', { page: 1, pageSize: 20 })
    expect(prisma.platform.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    )
    expect(result.pageSize).toBe(20)
  })

  it('list 支持 keyword 模糊匹配名称', async () => {
    const prisma = prismaMock()
    const service = new PlatformService(prisma as never)
    await service.list('u1', { page: 1, pageSize: 20, keyword: '淘' })
    expect(prisma.platform.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', name: { contains: '淘', mode: 'insensitive' } },
      }),
    )
  })

  it('createPresets 只创建缺失名称', async () => {
    const prisma = prismaMock()
    prisma.platform.findMany.mockResolvedValue([{ name: '淘宝' }])
    const service = new PlatformService(prisma as never)
    const result = await service.createPresets('u1')
    expect(prisma.platform.createMany).toHaveBeenCalledWith({
      data: ['京东', 'Bilibili 会员购', 'Hpoi', 'AmiAmi', 'Good Smile', '闲鱼', '其他'].map(name => ({
        userId: 'u1',
        name,
      })),
      skipDuplicates: true,
    })
    expect(result.created).toBe(7)
  })

  it('createPresets 全部已存在时不写库', async () => {
    const prisma = prismaMock()
    prisma.platform.findMany.mockResolvedValue([
      { name: '淘宝' },
      { name: '京东' },
      { name: 'Bilibili 会员购' },
      { name: 'Hpoi' },
      { name: 'AmiAmi' },
      { name: 'Good Smile' },
      { name: '闲鱼' },
      { name: '其他' },
    ])
    const service = new PlatformService(prisma as never)
    await expect(service.createPresets('u1')).resolves.toEqual({ created: 0 })
    expect(prisma.platform.createMany).not.toHaveBeenCalled()
  })

  it('assertOwned 不存在时抛 404 PLATFORM_NOT_FOUND', async () => {
    const prisma = prismaMock()
    prisma.platform.count.mockResolvedValue(0)
    const service = new PlatformService(prisma as never)
    await expect(service.assertOwned('u1', 'pf1')).rejects.toMatchObject({ status: 404 })
  })

  it('update 校验归属后再写库', async () => {
    const prisma = prismaMock()
    prisma.platform.count.mockResolvedValue(1)
    prisma.platform.update.mockResolvedValue(baseRow({ name: '淘宝网' }))
    const service = new PlatformService(prisma as never)
    const vo = await service.update('u1', 'pf1', { name: '淘宝网' })
    expect(prisma.platform.count).toHaveBeenCalledWith({ where: { id: 'pf1', userId: 'u1' } })
    expect(vo.name).toBe('淘宝网')
  })

  it('update 归属校验失败时不写库', async () => {
    const prisma = prismaMock()
    prisma.platform.count.mockResolvedValue(0)
    const service = new PlatformService(prisma as never)
    await expect(service.update('u1', 'pf1', { name: '淘宝网' })).rejects.toMatchObject({
      status: 404,
    })
    expect(prisma.platform.update).not.toHaveBeenCalled()
  })

  it('remove 校验归属后删除', async () => {
    const prisma = prismaMock()
    prisma.platform.count.mockResolvedValue(1)
    const service = new PlatformService(prisma as never)
    await expect(service.remove('u1', 'pf1')).resolves.toEqual({ id: 'pf1' })
    expect(prisma.platform.delete).toHaveBeenCalledWith({ where: { id: 'pf1' } })
  })
})
