import { CalendarService } from './calendar.service'

interface CalendarPrismaMock {
  order: { findMany: ReturnType<typeof vi.fn> }
}

const prismaMock = (): CalendarPrismaMock => ({
  order: { findMany: vi.fn().mockResolvedValue([]) },
})

const build = (prisma: CalendarPrismaMock) => new CalendarService(prisma as never)

const FROM = '2027-05-01'
const TO = '2027-05-31'
const FROM_DATE = new Date('2027-05-01T00:00:00.000Z')
const TO_DATE = new Date('2027-06-01T00:00:00.000Z')

const orderRow = (patch: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNo: null,
  status: 'ACTIVE',
  archived: false,
  currency: 'CNY',
  totalAmount: 1000,
  items: [{ product: { name: '芙宁娜 1/7' } }],
  payments: [],
  releaseEvents: [],
  shipments: [],
  ...patch,
})

const paymentRow = (patch: Record<string, unknown> = {}) => ({
  id: 'pay1',
  type: 'BALANCE',
  name: null,
  amount: 300,
  currency: 'CNY',
  status: 'PENDING',
  expectedAt: null,
  dueAt: new Date('2027-05-20T00:00:00.000Z'),
  paidAt: null,
  sortOrder: 0,
  ...patch,
})

const releaseRow = (patch: Record<string, unknown> = {}) => ({
  id: 'rel1',
  type: 'EXPECTED_RELEASE',
  oldDate: null,
  newDate: new Date('2027-05-20T00:00:00.000Z'),
  datePrecision: 'MONTH',
  occurredAt: new Date('2027-01-05T00:00:00.000Z'),
  ...patch,
})

const shipmentRow = (patch: Record<string, unknown> = {}) => ({
  id: 'shp1',
  status: 'WAITING',
  carrier: null,
  trackingNo: null,
  shippedAt: null,
  estimatedDeliveryAt: null,
  deliveredAt: null,
  ...patch,
})

describe('CalendarService.getEvents', () => {
  it('付款截止日落在区间内才产出 PAYMENT_DUE', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        payments: [
          paymentRow({ id: 'pay-in', dueAt: new Date('2027-05-20T00:00:00.000Z') }),
          paymentRow({ id: 'pay-out', dueAt: new Date('2027-07-01T00:00:00.000Z') }),
        ],
      }),
    ])

    const events = await build(prisma).getEvents('u1', FROM, TO)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      id: 'payment:pay-in',
      type: 'PAYMENT_DUE',
      date: '2027-05-20',
      orderId: 'o1',
      title: '芙宁娜 1/7 · BALANCE',
      amount: 300,
      currency: 'CNY',
      precision: 'DAY',
    })
    expect(events[0]?.displayStatus).toBeTruthy()
  })

  it('查询显式过滤 userId 与 archived，并按 [from, to+1天) 取数', async () => {
    const prisma = prismaMock()
    await build(prisma).getEvents('u1', FROM, TO)

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u1',
          archived: false,
          OR: [
            { payments: { some: { dueAt: { gte: FROM_DATE, lt: TO_DATE } } } },
            { releaseEvents: { some: { newDate: { gte: FROM_DATE, lt: TO_DATE } } } },
            { shipments: { some: { shippedAt: { gte: FROM_DATE, lt: TO_DATE } } } },
            { shipments: { some: { estimatedDeliveryAt: { gte: FROM_DATE, lt: TO_DATE } } } },
            { shipments: { some: { deliveredAt: { gte: FROM_DATE, lt: TO_DATE } } } },
          ],
        },
      }),
    )
  })

  it('同一天事件按 PAYMENT_DUE > DELIVERY > EXPECTED_RELEASE 排序', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        payments: [paymentRow({ id: 'pay1' })],
        releaseEvents: [releaseRow({ id: 'rel1' })],
        shipments: [
          shipmentRow({ id: 'shp1', estimatedDeliveryAt: new Date('2027-05-20T00:00:00.000Z') }),
        ],
      }),
    ])

    const events = await build(prisma).getEvents('u1', FROM, TO)

    expect(events.map(event => event.type)).toEqual(['PAYMENT_DUE', 'DELIVERY', 'EXPECTED_RELEASE'])
  })

  it('同一天 RELEASED 事件排在 EXPECTED_RELEASE 之后', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        releaseEvents: [
          releaseRow({ id: 'rel-expected' }),
          releaseRow({ id: 'rel-released', type: 'RELEASED', datePrecision: 'DAY' }),
        ],
      }),
    ])

    const events = await build(prisma).getEvents('u1', FROM, TO)

    expect(events.map(event => event.type)).toEqual(['EXPECTED_RELEASE', 'RELEASED'])
    expect(events[1]).toMatchObject({ id: 'release:rel-released', title: '芙宁娜 1/7 · 厂商出货' })
  })

  it('DELAY 事件映射为 EXPECTED_RELEASE 类型并标注延期后出货', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({ releaseEvents: [releaseRow({ id: 'rel-delay', type: 'DELAY' })] }),
    ])

    const events = await build(prisma).getEvents('u1', FROM, TO)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'EXPECTED_RELEASE',
      date: '2027-05-20',
      title: '芙宁娜 1/7 · 延期后出货',
      precision: 'MONTH',
      amount: null,
      currency: null,
    })
  })

  it('已签收包裹优先用 deliveredAt 并标注已签收', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        shipments: [
          shipmentRow({
            id: 'shp-delivered',
            status: 'DELIVERED',
            deliveredAt: new Date('2027-05-10T00:00:00.000Z'),
            estimatedDeliveryAt: new Date('2027-05-15T00:00:00.000Z'),
          }),
        ],
      }),
    ])

    const events = await build(prisma).getEvents('u1', FROM, TO)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      id: 'delivery:shp-delivered',
      type: 'DELIVERY',
      date: '2027-05-10',
      title: '芙宁娜 1/7 · 已签收',
    })
  })

  it('仅有预计到货时用 estimatedDeliveryAt 并标注预计到货', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        shipments: [
          shipmentRow({ id: 'shp-eta', estimatedDeliveryAt: new Date('2027-05-15T00:00:00.000Z') }),
        ],
      }),
    ])

    const events = await build(prisma).getEvents('u1', FROM, TO)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'DELIVERY', date: '2027-05-15', title: '芙宁娜 1/7 · 预计到货' })
  })

  it('已取消付款与非白名单 release 事件不产出事件', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        payments: [
          paymentRow({ id: 'pay-cancelled', status: 'CANCELLED' }),
          paymentRow({ id: 'pay-refunded', status: 'REFUNDED' }),
        ],
        releaseEvents: [
          releaseRow({ id: 'rel-store', type: 'STORE_ARRIVED' }),
          releaseRow({ id: 'rel-balance', type: 'BALANCE_OPEN' }),
        ],
      }),
    ])

    const events = await build(prisma).getEvents('u1', FROM, TO)

    expect(events).toEqual([])
  })

  it('已付款项仍产出事件，金额为空时返回 null', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({
        payments: [
          paymentRow({
            id: 'pay-paid',
            status: 'PAID',
            name: '定金',
            amount: null,
            paidAt: new Date('2027-05-20T08:00:00.000Z'),
          }),
        ],
      }),
    ])

    const events = await build(prisma).getEvents('u1', FROM, TO)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'PAYMENT_DUE', title: '芙宁娜 1/7 · 定金', amount: null })
  })

  it('订单无商品且无订单号时标题回退为「订单」', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      orderRow({ items: [], orderNo: null, payments: [paymentRow({ id: 'pay1' })] }),
    ])

    const events = await build(prisma).getEvents('u1', FROM, TO)

    expect(events[0]?.title).toBe('订单 · BALANCE')
  })

  it('无匹配订单时返回空数组', async () => {
    const prisma = prismaMock()
    const events = await build(prisma).getEvents('u1', FROM, TO)
    expect(events).toEqual([])
  })
})
