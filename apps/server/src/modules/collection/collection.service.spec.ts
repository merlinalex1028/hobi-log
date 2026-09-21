import { CollectionService } from './collection.service'

interface CollectionPrismaMock {
  orderItem: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> }
  order: { count: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

const prismaMock = (): CollectionPrismaMock => ({
  orderItem: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  order: { count: vi.fn().mockResolvedValue(0) },
  $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
})

const build = (prisma: CollectionPrismaMock) => new CollectionService(prisma as never)

const DELIVERED_WHERE = {
  order: {
    userId: 'u1',
    archived: false,
    status: { not: 'CANCELLED' },
    shipments: { some: { status: 'DELIVERED' } },
  },
}

const itemRow = (patch: Record<string, unknown> = {}) => ({
  id: 'oi1',
  quantity: 1,
  subtotal: 1299,
  product: { id: 'pr1', name: '芙宁娜 1/7', coverUrl: 'https://cdn/cover.webp' },
  order: { id: 'o1', orderedAt: new Date('2026-09-01T00:00:00.000Z'), currency: 'CNY' },
  shipmentItems: [
    { shipment: { status: 'DELIVERED', deliveredAt: new Date('2027-02-01T00:00:00.000Z') } },
  ],
  ...patch,
})

describe('CollectionService.list', () => {
  it('只收录已签收订单的 OrderItem，并显式过滤 userId 与 archived', async () => {
    const prisma = prismaMock()
    prisma.orderItem.findMany.mockResolvedValue([itemRow()])
    prisma.orderItem.count.mockResolvedValue(1)

    await build(prisma).list('u1', 1, 20)

    expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: DELIVERED_WHERE,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      }),
    )
    expect(prisma.orderItem.count).toHaveBeenCalledWith({ where: DELIVERED_WHERE })
  })

  it('分页参数换算为 skip/take，total 来自 count', async () => {
    const prisma = prismaMock()
    prisma.orderItem.findMany.mockResolvedValue([])
    prisma.orderItem.count.mockResolvedValue(42)

    const result = await build(prisma).list('u1', 3, 10)

    expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    )
    expect(result).toEqual({ items: [], total: 42, page: 3, pageSize: 10 })
  })

  it('映射订单项字段并按 YYYY-MM-DD 输出日期', async () => {
    const prisma = prismaMock()
    prisma.orderItem.findMany.mockResolvedValue([itemRow({ quantity: 2, subtotal: 2598 })])
    prisma.orderItem.count.mockResolvedValue(1)

    const result = await build(prisma).list('u1', 1, 20)

    expect(result.items[0]).toEqual({
      orderItemId: 'oi1',
      orderId: 'o1',
      productId: 'pr1',
      name: '芙宁娜 1/7',
      coverUrl: 'https://cdn/cover.webp',
      quantity: 2,
      purchasePrice: 2598,
      currency: 'CNY',
      purchasedAt: '2026-09-01',
      deliveredAt: '2027-02-01',
    })
  })

  it('多包裹时取最早一次签收时间', async () => {
    const prisma = prismaMock()
    prisma.orderItem.findMany.mockResolvedValue([
      itemRow({
        shipmentItems: [
          { shipment: { status: 'DELIVERED', deliveredAt: new Date('2027-02-10T00:00:00.000Z') } },
          { shipment: { status: 'DELIVERED', deliveredAt: new Date('2027-02-03T00:00:00.000Z') } },
        ],
      }),
    ])
    prisma.orderItem.count.mockResolvedValue(1)

    const result = await build(prisma).list('u1', 1, 20)

    expect(result.items[0]?.deliveredAt).toBe('2027-02-03')
  })

  it('无已签收包裹时 deliveredAt 为 null', async () => {
    const prisma = prismaMock()
    prisma.orderItem.findMany.mockResolvedValue([
      itemRow({
        shipmentItems: [
          { shipment: { status: 'SHIPPED', deliveredAt: null } },
          { shipment: { status: 'DELIVERED', deliveredAt: null } },
        ],
      }),
    ])
    prisma.orderItem.count.mockResolvedValue(1)

    const result = await build(prisma).list('u1', 1, 20)

    expect(result.items[0]?.deliveredAt).toBeNull()
  })
})

describe('CollectionService.stats', () => {
  it('按币种分开汇总，不跨币种相加', async () => {
    const prisma = prismaMock()
    prisma.orderItem.findMany.mockResolvedValue([
      { quantity: 2, subtotal: 100, order: { currency: 'CNY' } },
      { quantity: 1, subtotal: 50.5, order: { currency: 'CNY' } },
      { quantity: 3, subtotal: 12000, order: { currency: 'JPY' } },
    ])
    prisma.order.count.mockResolvedValue(2)

    const result = await build(prisma).stats('u1')

    expect(result).toEqual({
      totalItems: 6,
      deliveredOrders: 2,
      byCurrency: [
        { currency: 'CNY', amount: 150.5 },
        { currency: 'JPY', amount: 12000 },
      ],
    })
  })

  it('汇总显式过滤 userId 与 archived，且只算已签收订单', async () => {
    const prisma = prismaMock()
    await build(prisma).stats('u1')

    expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: DELIVERED_WHERE }),
    )
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        archived: false,
        status: { not: 'CANCELLED' },
        shipments: { some: { status: 'DELIVERED' } },
      },
    })
  })

  it('无收藏时返回空币种汇总', async () => {
    const prisma = prismaMock()
    const result = await build(prisma).stats('u1')
    expect(result).toEqual({ totalItems: 0, deliveredOrders: 0, byCurrency: [] })
  })
})
