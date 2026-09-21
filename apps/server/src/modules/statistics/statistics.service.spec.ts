import { StatisticsService } from './statistics.service'

const prismaMock = () => ({
  payment: { findMany: vi.fn().mockResolvedValue([]) },
  order: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  $queryRaw: vi.fn().mockResolvedValue([]),
})

const repositoryMock = () => ({
  dimension: vi.fn().mockResolvedValue([]),
  countCollectionItems: vi.fn().mockResolvedValue(0),
})

const build = (prisma: ReturnType<typeof prismaMock>, repository = repositoryMock()) =>
  new StatisticsService(prisma as never, repository as never)

const dateBefore = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

const paymentRow = (patch: Record<string, unknown> = {}) => ({
  id: 'p1',
  type: 'DEPOSIT',
  name: null,
  amount: 300,
  status: 'PENDING',
  expectedAt: null,
  dueAt: new Date('2027-05-20T00:00:00.000Z'),
  paidAt: null,
  sortOrder: 0,
  ...patch,
})

const orderRow = (patch: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNo: null,
  orderedAt: new Date('2026-09-01T00:00:00.000Z'),
  currency: 'CNY',
  totalAmount: 1000,
  status: 'ACTIVE',
  archived: false,
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  items: [{ product: { name: '芙宁娜 1/7' } }],
  payments: [],
  releaseEvents: [],
  shipments: [],
  ...patch,
})

describe('StatisticsService.getDashboard', () => {
  it('待付款按币种分开聚合，不跨币种相加', async () => {
    const prisma = prismaMock()
    prisma.payment.findMany
      .mockResolvedValueOnce([
        { amount: 300, currency: 'CNY', dueAt: null },
        { amount: 999, currency: 'CNY', dueAt: null },
        { amount: 12000, currency: 'JPY', dueAt: null },
      ])
      .mockResolvedValueOnce([])
    const result = await build(prisma).getDashboard('u1')
    expect(result.kpis.pendingPaymentAmount).toEqual([
      { currency: 'CNY', amount: 1299 },
      { currency: 'JPY', amount: 12000 },
    ])
  })

  it('amount = null 的待付款不参与金额汇总', async () => {
    const prisma = prismaMock()
    prisma.payment.findMany
      .mockResolvedValueOnce([{ amount: null, currency: 'CNY', dueAt: null }])
      .mockResolvedValueOnce([])
    const result = await build(prisma).getDashboard('u1')
    expect(result.kpis.pendingPaymentAmount).toEqual([])
  })

  it('所有聚合显式过滤 userId 并排除 archived', async () => {
    const prisma = prismaMock()
    await build(prisma).getDashboard('u1')
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING', order: { userId: 'u1', archived: false, status: 'ACTIVE' } },
      }),
    )
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', archived: false, status: 'ACTIVE' } }),
    )
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { userId: 'u1', archived: false } })
  })

  it('收藏数量来自已签收订单的 OrderItem 数', async () => {
    const prisma = prismaMock()
    const repository = repositoryMock()
    repository.countCollectionItems.mockResolvedValue(7)
    const result = await build(prisma, repository).getDashboard('u1')
    expect(repository.countCollectionItems).toHaveBeenCalledWith('u1')
    expect(result.kpis.collectionCount).toBe(7)
  })

  it('futurePayments 按到期月份分桶，忽略无到期日与已逾期', async () => {
    const prisma = prismaMock()
    const dueAt = new Date(Date.now() + 40 * 86_400_000)
    prisma.payment.findMany
      .mockResolvedValueOnce([
        { amount: 100, currency: 'CNY', dueAt },
        { amount: 50, currency: 'CNY', dueAt: null },
        { amount: 70, currency: 'CNY', dueAt: new Date(Date.now() - 5 * 86_400_000) },
      ])
      .mockResolvedValueOnce([])
    const result = await build(prisma).getDashboard('u1')
    expect(result.futurePayments).toEqual([
      { month: dueAt.toISOString().slice(0, 7), byCurrency: [{ currency: 'CNY', amount: 100 }] },
    ])
  })

  it('待办按 逾期 > 1天内 > 3天内 > 7天内 > 其他 排序', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        id: 'o-soon',
        payments: [paymentRow({ id: 'p-soon', dueAt: new Date(`${dateBefore(2)}T00:00:00.000Z`) })],
      }),
      orderRow({
        id: 'o-overdue',
        payments: [paymentRow({ id: 'p-overdue', dueAt: new Date(`${dateBefore(-3)}T00:00:00.000Z`) })],
      }),
      orderRow({
        id: 'o-later',
        payments: [paymentRow({ id: 'p-later', dueAt: new Date(`${dateBefore(20)}T00:00:00.000Z`) })],
      }),
    ])
    const result = await build(prisma).getDashboard('u1')
    expect(result.todos.map(todo => todo.orderId)).toEqual(['o-overdue', 'o-soon', 'o-later'])
    expect(result.todos.map(todo => todo.priority)).toEqual([0, 2, 4])
    expect(result.todos[0]?.overdueDays).toBe(3)
    expect(result.todos[0]?.title).toBe('芙宁娜 1/7')
  })
})

describe('StatisticsService.getFuturePayments', () => {
  it('按月份与币种聚合，月份升序', async () => {
    const prisma = prismaMock()
    prisma.payment.findMany.mockResolvedValue([
      { amount: 300, currency: 'CNY', dueAt: new Date('2027-05-20T00:00:00.000Z') },
      { amount: 900, currency: 'CNY', dueAt: new Date('2027-05-25T00:00:00.000Z') },
      { amount: 999, currency: 'CNY', dueAt: new Date('2027-06-20T00:00:00.000Z') },
    ])
    const result = await build(prisma).getFuturePayments('u1', 12)
    expect(result).toEqual([
      { month: '2027-05', byCurrency: [{ currency: 'CNY', amount: 1200 }] },
      { month: '2027-06', byCurrency: [{ currency: 'CNY', amount: 999 }] },
    ])
  })

  it('查询显式过滤 userId、排除归档订单并只看 PENDING', async () => {
    const prisma = prismaMock()
    await build(prisma).getFuturePayments('u1', 6, 'CNY')
    const args = prisma.payment.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(args.where.status).toBe('PENDING')
    expect(args.where.currency).toBe('CNY')
    expect(args.where.order).toMatchObject({ userId: 'u1', archived: false, status: 'ACTIVE' })
    expect(args.where.dueAt).toBeDefined()
  })
})

describe('StatisticsService.getMonthlyPayments', () => {
  it('净支出 = 已付 - 退款', async () => {
    const prisma = prismaMock()
    prisma.$queryRaw.mockResolvedValue([
      {
        month: new Date('2027-05-01T00:00:00.000Z'),
        currency: 'CNY',
        paidAmount: 1299,
        refundAmount: 300,
        orderAmount: 1599,
      },
    ])
    const result = await build(prisma).getMonthlyPayments('u1')
    expect(result).toEqual([
      {
        month: '2027-05',
        currency: 'CNY',
        paidAmount: 1299,
        refundAmount: 300,
        netPaidAmount: 999,
        orderAmount: 1599,
      },
    ])
  })

  it('现金流与下单规模分别查询后按 月份+币种 合并', async () => {
    const prisma = prismaMock()
    await build(prisma).getMonthlyPayments('u1')
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it('无数据时返回空数组', async () => {
    const prisma = prismaMock()
    await expect(build(prisma).getMonthlyPayments('u1')).resolves.toEqual([])
  })
})

describe('StatisticsService.getDimension', () => {
  it('把仓库行按 key 合并并保持多币种分离', async () => {
    const prisma = prismaMock()
    const repository = repositoryMock()
    repository.dimension.mockResolvedValue([
      { key: 'GK', currency: 'CNY', amount: 800, orderCount: 1, itemCount: 1 },
      { key: 'GK', currency: 'JPY', amount: 12000, orderCount: 1, itemCount: 1 },
    ])
    const result = await build(prisma, repository).getDimension('category', 'u1')
    expect(result).toEqual([
      {
        key: 'GK',
        label: 'GK',
        amount: [
          { currency: 'CNY', amount: 800 },
          { currency: 'JPY', amount: 12000 },
        ],
        orderCount: 2,
        itemCount: 2,
      },
    ])
  })

  it('key 为 null 时归入 UNKNOWN', async () => {
    const prisma = prismaMock()
    const repository = repositoryMock()
    repository.dimension.mockResolvedValue([
      { key: null, currency: 'CNY', amount: 100, orderCount: 1, itemCount: 1 },
    ])
    const result = await build(prisma, repository).getDimension('manufacturer', 'u1')
    expect(result[0]?.key).toBe('UNKNOWN')
  })

  it('默认区间为一年前到明天，并透传 userId 与币种', async () => {
    const prisma = prismaMock()
    const repository = repositoryMock()
    await build(prisma, repository).getDimension('ip', 'u1', undefined, undefined, 'JPY')
    const call = repository.dimension.mock.calls[0] as unknown as [string, string, Date, Date, string]
    expect(call[0]).toBe('u1')
    expect(call[1]).toBe('ip')
    expect(call[4]).toBe('JPY')
    expect(call[3].getTime() - call[2].getTime()).toBe(366 * 86_400_000)
  })
})
