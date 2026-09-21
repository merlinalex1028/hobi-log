import { ORDER_INCLUDE } from '../order/order.service'
import { NotificationService } from './notification.service'

interface NotificationPrismaMock {
  order: { findMany: ReturnType<typeof vi.fn> }
}

const prismaMock = (): NotificationPrismaMock => ({
  order: { findMany: vi.fn().mockResolvedValue([]) },
})

const build = (prisma: NotificationPrismaMock) => new NotificationService(prisma as never)

const ONE_DAY_MS = 86_400_000

const today = () => new Date().toISOString().slice(0, 10)

const dayString = (days: number) =>
  new Date(Date.now() + days * ONE_DAY_MS).toISOString().slice(0, 10)

const dateAt = (days: number) => new Date(`${dayString(days)}T00:00:00.000Z`)

const daysUntil = (date: string) =>
  Math.round(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${today()}T00:00:00.000Z`)) / ONE_DAY_MS,
  )

const paymentRow = (patch: Record<string, unknown> = {}) => ({
  id: 'pay1',
  type: 'BALANCE',
  name: '尾款',
  amount: 500,
  currency: 'CNY',
  status: 'PENDING',
  expectedAt: null,
  dueAt: null,
  paidAt: null,
  sortOrder: 0,
  ...patch,
})

const orderRow = (patch: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNo: null,
  orderedAt: dateAt(-30),
  currency: 'CNY',
  totalAmount: 1000,
  status: 'ACTIVE',
  archived: false,
  updatedAt: new Date(),
  items: [{ product: { name: '芙宁娜 1/7' } }],
  payments: [],
  releaseEvents: [],
  shipments: [],
  ...patch,
})

const expectedRelease = (newDate: string, occurredAt: string) => ({
  id: 're1',
  type: 'EXPECTED_RELEASE',
  oldDate: null,
  newDate: new Date(`${newDate}T00:00:00.000Z`),
  datePrecision: 'DAY',
  occurredAt: new Date(occurredAt),
})

const delayEvent = (newDate: string, occurredAt: string) => ({
  id: 're2',
  type: 'DELAY',
  oldDate: null,
  newDate: new Date(`${newDate}T00:00:00.000Z`),
  datePrecision: 'DAY',
  occurredAt: new Date(occurredAt),
})

const releasedEvent = (newDate: string, occurredAt: string) => ({
  id: 're3',
  type: 'RELEASED',
  oldDate: null,
  newDate: new Date(`${newDate}T00:00:00.000Z`),
  datePrecision: 'DAY',
  occurredAt: new Date(occurredAt),
})

describe('NotificationService.getTodos 查询范围', () => {
  it('显式过滤 userId、archived 与 status=ACTIVE，并限制条数', async () => {
    const prisma = prismaMock()
    await build(prisma).getTodos('u1')

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', archived: false, status: 'ACTIVE' },
      include: ORDER_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })
  })

  it('取消 / 归档的订单不在查询结果中，因此不出提醒', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([])
    await expect(build(prisma).getTodos('u1')).resolves.toEqual([])
  })
})

describe('NotificationService.getTodos 付款提醒', () => {
  it('尾款 3 天后截止 → PAYMENT_DUE_SOON 且 daysLeft = 3', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({ payments: [paymentRow({ dueAt: dateAt(3) })] }),
    ])

    const reminders = await build(prisma).getTodos('u1')

    expect(reminders).toEqual([
      expect.objectContaining({
        id: 'payment-soon:pay1',
        kind: 'PAYMENT_DUE_SOON',
        orderId: 'o1',
        title: '芙宁娜 1/7 · 尾款',
        dueAt: dayString(3),
        daysLeft: 3,
        overdueDays: null,
        amount: 500,
        currency: 'CNY',
        priority: 3,
      }),
    ])
  })

  it('尾款已过截止 → PAYMENT_OVERDUE 且 overdueDays 为正、优先级最高', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({ payments: [paymentRow({ dueAt: dateAt(-5) })] }),
    ])

    const reminders = await build(prisma).getTodos('u1')

    expect(reminders).toEqual([
      expect.objectContaining({
        id: 'payment-overdue:pay1',
        kind: 'PAYMENT_OVERDUE',
        dueAt: dayString(-5),
        daysLeft: -5,
        overdueDays: 5,
        priority: 0,
      }),
    ])
  })

  it('9 天后截止不触发（不在 7/3/1/0 集合内）', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({ payments: [paymentRow({ dueAt: dateAt(9) })] }),
    ])

    const reminders = await build(prisma).getTodos('u1')

    expect(reminders).toEqual([])
  })

  it('没有截止日的 PENDING 付款不出时间型提醒', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([orderRow({ payments: [paymentRow({ dueAt: null })] })])

    await expect(build(prisma).getTodos('u1')).resolves.toEqual([])
  })

  it('已付款 / 已取消 / 已退款节点不出提醒', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        payments: [
          paymentRow({ id: 'paid', status: 'PAID', dueAt: dateAt(1) }),
          paymentRow({ id: 'cancelled', status: 'CANCELLED', dueAt: dateAt(-3) }),
          paymentRow({ id: 'refunded', status: 'REFUNDED', dueAt: dateAt(-3) }),
        ],
      }),
    ])

    await expect(build(prisma).getTodos('u1')).resolves.toEqual([])
  })

  it('amount 为空的付款出口仍为 null', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({ payments: [paymentRow({ amount: null, dueAt: dateAt(0) })] }),
    ])

    const reminders = await build(prisma).getTodos('u1')

    expect(reminders).toEqual([
      expect.objectContaining({ kind: 'PAYMENT_DUE_SOON', daysLeft: 0, amount: null, priority: 1 }),
    ])
  })
})

describe('NotificationService.getTodos 出货提醒', () => {
  const monthPrefix = () => today().slice(0, 7)

  it('计划出货日期落在本月 → RELEASE_THIS_MONTH', async () => {
    const prisma = prismaMock()
    const plannedDate = `${monthPrefix()}-28`
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        releaseEvents: [expectedRelease(plannedDate, new Date('2026-01-01T00:00:00.000Z').toISOString())],
      }),
    ])

    const reminders = await build(prisma).getTodos('u1')

    expect(reminders).toEqual([
      expect.objectContaining({
        id: 'release-month:o1',
        kind: 'RELEASE_THIS_MONTH',
        title: '芙宁娜 1/7',
        dueAt: plannedDate,
        daysLeft: daysUntil(plannedDate),
        amount: null,
        currency: null,
        priority: 5,
      }),
    ])
  })

  it('计划出货日期不在本月 → 不出 RELEASE_THIS_MONTH', async () => {
    const prisma = prismaMock()
    const nextMonthFirst = new Date(`${monthPrefix()}-01T00:00:00.000Z`)
    nextMonthFirst.setUTCMonth(nextMonthFirst.getUTCMonth() + 1)
    const plannedDate = nextMonthFirst.toISOString().slice(0, 10)
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        releaseEvents: [expectedRelease(plannedDate, new Date('2026-01-01T00:00:00.000Z').toISOString())],
      }),
    ])

    await expect(build(prisma).getTodos('u1')).resolves.toEqual([])
  })

  it('延期后仍在等待出货 → RELEASE_DELAYED', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        releaseEvents: [
          expectedRelease('2026-05-01', '2026-01-01T00:00:00.000Z'),
          delayEvent('2026-08-01', '2026-02-01T00:00:00.000Z'),
        ],
      }),
    ])

    const reminders = await build(prisma).getTodos('u1')

    expect(reminders).toEqual([
      expect.objectContaining({
        id: 'release-delayed:o1',
        kind: 'RELEASE_DELAYED',
        dueAt: '2026-08-01',
        overdueDays: null,
        priority: 6,
      }),
    ])
  })

  it('延期但已出货 → 不出 RELEASE_DELAYED', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        releaseEvents: [
          expectedRelease('2026-05-01', '2026-01-01T00:00:00.000Z'),
          delayEvent('2026-08-01', '2026-02-01T00:00:00.000Z'),
          releasedEvent('2026-08-20', '2026-08-20T00:00:00.000Z'),
        ],
      }),
    ])

    const reminders = await build(prisma).getTodos('u1')

    expect(reminders.map(reminder => reminder.kind)).not.toContain('RELEASE_DELAYED')
  })
})

describe('NotificationService.getTodos 长期未更新', () => {
  it('超过 30 天未更新 → STALE_ORDER', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({ updatedAt: new Date(Date.now() - 40 * ONE_DAY_MS) }),
    ])

    const reminders = await build(prisma).getTodos('u1')

    expect(reminders).toEqual([
      expect.objectContaining({
        id: 'stale:o1',
        kind: 'STALE_ORDER',
        dueAt: null,
        daysLeft: null,
        amount: null,
        priority: 9,
      }),
    ])
  })

  it('30 天内更新过 → 不出 STALE_ORDER', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({ updatedAt: new Date(Date.now() - 10 * ONE_DAY_MS) }),
    ])

    await expect(build(prisma).getTodos('u1')).resolves.toEqual([])
  })
})

describe('NotificationService.getTodos 排序', () => {
  it('逾期 > 当天 > 1 天 > 3 天 > 7 天 > 本月出货 > 延期 > 长期未更新', async () => {
    const prisma = prismaMock()
    const plannedDate = `${today().slice(0, 7)}-28`
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        id: 'o1',
        payments: [
          paymentRow({ id: 'p7', dueAt: dateAt(7) }),
          paymentRow({ id: 'p0', dueAt: dateAt(0) }),
          paymentRow({ id: 'p3', dueAt: dateAt(3) }),
          paymentRow({ id: 'p1', dueAt: dateAt(1) }),
          paymentRow({ id: 'pminus', dueAt: dateAt(-2) }),
        ],
        releaseEvents: [
          expectedRelease('2026-05-01', '2026-01-01T00:00:00.000Z'),
          delayEvent(plannedDate, '2026-02-01T00:00:00.000Z'),
        ],
      }),
      orderRow({ id: 'o2', updatedAt: new Date(Date.now() - 40 * ONE_DAY_MS) }),
    ])

    const reminders = await build(prisma).getTodos('u1')

    expect(reminders.map(reminder => reminder.id)).toEqual([
      'payment-overdue:pminus',
      'payment-soon:p0',
      'payment-soon:p1',
      'payment-soon:p3',
      'payment-soon:p7',
      'release-month:o1',
      'release-delayed:o1',
      'stale:o2',
    ])
  })
})
