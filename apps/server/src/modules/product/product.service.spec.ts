import { ProductService } from './product.service'
import type { ProductWithTags } from './mapper/product.mapper'

const baseRow = (patch: Partial<ProductWithTags> = {}): ProductWithTags => ({
  id: 'p1',
  userId: 'u1',
  name: 'x',
  originalName: null,
  coverUrl: null,
  category: 'OTHER',
  ipName: null,
  characterName: null,
  manufacturer: null,
  seriesName: null,
  scale: null,
  version: null,
  sku: null,
  officialPrice: null,
  officialCurrency: null,
  announcedAt: null,
  originalReleaseDate: null,
  releaseDatePrecision: null,
  description: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  productTags: [],
  ...patch,
})

const prismaMock = () => ({
  product: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tag: { upsert: vi.fn().mockResolvedValue({ id: 't1' }) },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
})

describe('ProductService', () => {
  it('list 强制带 userId 且返回分页形状', async () => {
    const prisma = prismaMock()
    const service = new ProductService(prisma as never)
    const result = await service.list('u1', { page: 2, pageSize: 10, keyword: '芙' })
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
    )
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 })
  })

  it('list 默认只取 ACTIVE，显式状态可覆盖', async () => {
    const prisma = prismaMock()
    const service = new ProductService(prisma as never)
    await service.list('u1', { page: 1, pageSize: 20 })
    expect(prisma.product.findMany.mock.calls[0]?.[0]).toMatchObject({ where: { status: 'ACTIVE' } })
    await service.list('u1', { page: 1, pageSize: 20, status: 'ARCHIVED' })
    expect(prisma.product.findMany.mock.calls[1]?.[0]).toMatchObject({ where: { status: 'ARCHIVED' } })
  })

  it('getOwnedProductIds 只返回命中项', async () => {
    const prisma = prismaMock()
    prisma.product.findMany.mockResolvedValue([{ id: 'p1' }])
    const service = new ProductService(prisma as never)
    await expect(service.getOwnedProductIds('u1', ['p1', 'p2'])).resolves.toEqual(['p1'])
  })

  it('getOwnedProductIds 空数组不发查询', async () => {
    const prisma = prismaMock()
    const service = new ProductService(prisma as never)
    await expect(service.getOwnedProductIds('u1', [])).resolves.toEqual([])
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })

  it('archive 找不到归属时抛 404', async () => {
    const prisma = prismaMock()
    prisma.product.count.mockResolvedValue(0)
    const service = new ProductService(prisma as never)
    await expect(service.archive('u1', 'p1')).rejects.toMatchObject({
      status: 404,
      response: { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: '商品不存在' },
    })
    expect(prisma.product.update).not.toHaveBeenCalled()
  })

  it('archive 成功返回归档后的 VO', async () => {
    const prisma = prismaMock()
    prisma.product.count.mockResolvedValue(1)
    prisma.product.update.mockResolvedValue(baseRow({ status: 'ARCHIVED' }))
    const service = new ProductService(prisma as never)
    await expect(service.archive('u1', 'p1')).resolves.toMatchObject({ id: 'p1', status: 'ARCHIVED' })
  })

  it('create 为 tagNames 建 tag 并连接', async () => {
    const prisma = prismaMock()
    prisma.product.create.mockResolvedValue(baseRow({ id: 'p9', productTags: [{ tagId: 't1' }] }))
    const service = new ProductService(prisma as never)
    const vo = await service.create('u1', { name: 'x', category: 'OTHER', tagNames: ['限定'] })
    expect(prisma.tag.upsert).toHaveBeenCalledWith({
      where: { userId_name: { userId: 'u1', name: '限定' } },
      create: { userId: 'u1', name: '限定' },
      update: {},
      select: { id: true },
    })
    expect(vo.tagIds).toEqual(['t1'])
  })

  it('update 时刷新标签（先删后插）', async () => {
    const prisma = prismaMock()
    prisma.product.count.mockResolvedValue(1)
    prisma.product.update.mockResolvedValue(baseRow({ productTags: [{ tagId: 't1' }] }))
    const service = new ProductService(prisma as never)
    await service.update('u1', 'p1', { tagNames: ['限定'] })
    expect(prisma.product.update.mock.calls[0]?.[0]).toMatchObject({
      data: { productTags: { deleteMany: {}, create: [{ tagId: 't1' }] } },
    })
  })

  it('update 不传 tagNames 时不动标签', async () => {
    const prisma = prismaMock()
    prisma.product.count.mockResolvedValue(1)
    prisma.product.update.mockResolvedValue(baseRow())
    const service = new ProductService(prisma as never)
    await service.update('u1', 'p1', { name: 'y' })
    const data = prisma.product.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(data.data).not.toHaveProperty('productTags')
  })
})
