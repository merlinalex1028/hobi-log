import { OrderService, buildTabWhere } from './order.service'

const prismaMock = () => ({
  order: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  orderItem: { createMany: vi.fn() },
  payment: { createMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
  releaseEvent: { create: vi.fn() },
  orderEvent: { create: vi.fn() },
  $transaction: vi.fn(),
})

const buildService = (prisma: ReturnType<typeof prismaMock>, overrides: Record<string, unknown> = {}) =>
  new OrderService(
    prisma as never,
    { getOwnedProductIds: vi.fn().mockResolvedValue([]), ...overrides } as never,
    { assertOwned: vi.fn().mockResolvedValue(undefined) } as never,
    { assertOwned: vi.fn().mockResolvedValue(undefined) } as never,
  )

describe('buildTabWhere', () => {
  it('ALL → 仅排除归档', () => {
    expect(buildTabWhere('ALL', '2027-03-20')).toEqual({ archived: false })
  })
  it('ARCHIVED → archived true', () => {
    expect(buildTabWhere('ARCHIVED', '2027-03-20')).toEqual({ archived: true })
  })
  it('WAITING_PAYMENT → ACTIVE 且存在 PENDING 付款', () => {
    expect(buildTabWhere('WAITING_PAYMENT', '2027-03-20')).toEqual({
      status: 'ACTIVE',
      payments: { some: { status: 'PENDING' } },
    })
  })
  it('PAYMENT_OVERDUE → dueAt 早于今天', () => {
    expect(buildTabWhere('PAYMENT_OVERDUE', '2027-03-20')).toEqual({
      status: 'ACTIVE',
      payments: { some: { status: 'PENDING', dueAt: { lt: new Date('2027-03-20T00:00:00.000Z') } } },
    })
  })
  it('IN_TRANSIT → 存在 SHIPPED / IN_TRANSIT 物流', () => {
    expect(buildTabWhere('IN_TRANSIT', '2027-03-20')).toEqual({
      shipments: { some: { status: { in: ['SHIPPED', 'IN_TRANSIT'] } } },
    })
  })
  it('COMPLETED → status COMPLETED', () => {
    expect(buildTabWhere('COMPLETED', '2027-03-20')).toEqual({ status: 'COMPLETED' })
  })
})

describe('OrderService.create', () => {
  it('商品不属于当前用户 → 400 INVALID_PRODUCTS', async () => {
    const prisma = prismaMock()
    const service = buildService(prisma, { getOwnedProductIds: vi.fn().mockResolvedValue(['p1']) })
    await expect(
      service.create('u1', {
        items: [
          { productId: 'p1', quantity: 1, unitPrice: 100 },
          { productId: 'p2', quantity: 1, unitPrice: 100 },
        ],
        orderedAt: '2026-09-18',
        currency: 'CNY',
        paymentMode: 'FULL',
        autoCalculateGoodsAmount: true,
        goodsAmount: 0,
        discountAmount: 0,
        shippingAmount: 0,
        taxAmount: 0,
        extraAmount: 0,
        payments: [{ type: 'FULL', amount: 200 }],
      }),
    ).rejects.toMatchObject({ status: 400, response: { code: 'INVALID_PRODUCTS' } })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('自动计算商品金额与订单总额，并写入 Payments 与预计出货', async () => {
    const prisma = prismaMock()
    const tx = {
      order: { create: vi.fn().mockResolvedValue({ id: 'o1' }) },
      orderItem: { createMany: vi.fn() },
      payment: { createMany: vi.fn() },
      releaseEvent: { create: vi.fn() },
      orderEvent: { create: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    const service = buildService(prisma, { getOwnedProductIds: vi.fn().mockResolvedValue(['p1']) })
    service.getDetail = vi.fn().mockResolvedValue({ id: 'o1' } as never)

    await service.create('u1', {
      items: [{ productId: 'p1', quantity: 2, unitPrice: 649.5 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'FULL',
      autoCalculateGoodsAmount: true,
      goodsAmount: 0,
      discountAmount: 100,
      shippingAmount: 20,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'FULL', amount: 1199 }],
      expectedRelease: { date: '2027-05-01', precision: 'MONTH' },
    })

    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', goodsAmount: 1299, totalAmount: 1219 }),
      select: { id: true },
    })
    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: [{ orderId: 'o1', productId: 'p1', quantity: 2, unitPrice: 649.5, subtotal: 1299, note: undefined }],
    })
    expect(tx.payment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: 'o1',
          type: 'FULL',
          amount: 1199,
          status: 'PENDING',
          currency: 'CNY',
          sortOrder: 0,
        }),
      ],
    })
    expect(tx.releaseEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: 'o1',
        type: 'EXPECTED_RELEASE',
        newDate: new Date('2027-05-01T00:00:00.000Z'),
        datePrecision: 'MONTH',
      },
    })
  })

  it('关闭自动计算时使用传入的商品金额', async () => {
    const prisma = prismaMock()
    const tx = {
      order: { create: vi.fn().mockResolvedValue({ id: 'o2' }) },
      orderItem: { createMany: vi.fn() },
      payment: { createMany: vi.fn() },
      releaseEvent: { create: vi.fn() },
      orderEvent: { create: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    const service = buildService(prisma, { getOwnedProductIds: vi.fn().mockResolvedValue(['p1']) })
    service.getDetail = vi.fn().mockResolvedValue({ id: 'o2' } as never)

    await service.create('u1', {
      items: [{ productId: 'p1', quantity: 1, unitPrice: 100 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'CUSTOM',
      autoCalculateGoodsAmount: false,
      goodsAmount: 500,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'OTHER', amount: 500 }],
    })

    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ goodsAmount: 500, totalAmount: 500 }),
      select: { id: true },
    })
  })
})

describe('OrderService.list', () => {
  it('始终带 userId 并返回分页形状', async () => {
    const prisma = prismaMock()
    prisma.$transaction.mockImplementation(async (arg: never) => Promise.all(arg as Promise<unknown>[]))
    const service = buildService(prisma)
    const result = await service.list('u1', { page: 2, pageSize: 10, tab: 'ALL' } as never)
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', archived: false }) }),
    )
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 })
  })
})

describe('OrderService.cancel', () => {
  const orderRow = { status: 'ACTIVE' }

  it('非 ACTIVE 订单 → 400 ORDER_NOT_CANCELLABLE', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue({ status: 'COMPLETED' })
    const service = buildService(prisma)
    await expect(service.cancel('u1', 'o1', { refund: false })).rejects.toMatchObject({
      status: 400,
      response: { code: 'ORDER_NOT_CANCELLABLE' },
    })
  })

  it('取消时把 PENDING 付款改为 CANCELLED 并写事件', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue(orderRow)
    const tx = {
      order: { update: vi.fn() },
      payment: { updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([{ amount: 300 }]), create: vi.fn() },
      orderEvent: { create: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    const service = buildService(prisma)
    service.getDetail = vi.fn().mockResolvedValue({ id: 'o1' } as never)

    await service.cancel('u1', 'o1', { refund: true, note: '店家取消' })

    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'CANCELLED' } })
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    })
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'REFUND', amount: 300, status: 'PAID' }),
    })
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: { orderId: 'o1', type: 'ORDER_CANCELLED', title: '取消订单', description: '店家取消' },
    })
  })

  it('refund = false 时不创建退款记录', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue(orderRow)
    const tx = {
      order: { update: vi.fn() },
      payment: { updateMany: vi.fn(), findMany: vi.fn(), create: vi.fn() },
      orderEvent: { create: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    const service = buildService(prisma)
    service.getDetail = vi.fn().mockResolvedValue({ id: 'o1' } as never)

    await service.cancel('u1', 'o1', { refund: false })

    expect(tx.payment.findMany).not.toHaveBeenCalled()
    expect(tx.payment.create).not.toHaveBeenCalled()
  })
})

describe('OrderService.refreshStatus', () => {
  it('全部签收且无待付款 → COMPLETED', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue({
      id: 'o1',
      status: 'ACTIVE',
      archived: false,
      currency: 'CNY',
      totalAmount: 1299,
      payments: [
        {
          id: 'p1', type: 'FULL', name: null, amount: 1299, status: 'PAID',
          expectedAt: null, dueAt: null, paidAt: new Date('2026-09-18'), sortOrder: 0,
        },
      ],
      shipments: [
        {
          id: 's1', status: 'DELIVERED', carrier: null, trackingNo: null,
          shippedAt: new Date('2027-05-18'), estimatedDeliveryAt: null, deliveredAt: new Date('2027-05-21'),
        },
      ],
      releaseEvents: [],
    })
    const service = buildService(prisma)
    await expect(service.refreshStatus('u1', 'o1')).resolves.toBe('COMPLETED')
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'COMPLETED' } })
  })

  it('已取消订单不回头改状态', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue({
      id: 'o1', status: 'CANCELLED', archived: false, currency: 'CNY', totalAmount: 0,
      payments: [], shipments: [], releaseEvents: [],
    })
    const service = buildService(prisma)
    await expect(service.refreshStatus('u1', 'o1')).resolves.toBe('CANCELLED')
    expect(prisma.order.update).not.toHaveBeenCalled()
  })
})
