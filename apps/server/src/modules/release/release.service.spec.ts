import { ReleaseService } from './release.service'

const releaseEventsOf = (events: Array<{ type: string; newDate: string | null }>) =>
  events.map((event, index) => ({
    id: `r${index}`,
    type: event.type,
    newDate: event.newDate,
    oldDate: null as string | null,
    datePrecision: 'MONTH' as string | null,
    occurredAt: '2026-09-18T00:00:00.000Z',
  }))

const orderRow = (patch: Record<string, unknown> = {}) => {
  const releaseEvents =
    (patch.releaseEvents as ReturnType<typeof releaseEventsOf> | undefined) ??
    releaseEventsOf([{ type: 'EXPECTED_RELEASE', newDate: '2027-01-01' }])
  return {
    id: 'o1',
    status: 'ACTIVE',
    payments: [] as Array<{ id: string; type: string; status: string; amount: number | null }>,
    releaseEvents,
    ...patch,
  }
}

const prismaMock = () => ({
  releaseEvent: { create: vi.fn() },
  payment: { update: vi.fn() },
  $transaction: vi.fn(),
})

interface TxMock {
  releaseEvent: { create: ReturnType<typeof vi.fn> }
  payment: { update: ReturnType<typeof vi.fn> }
}

const buildService = (prisma: ReturnType<typeof prismaMock>, order: ReturnType<typeof orderRow>) =>
  new ReleaseService(prisma as never, {
    assertOwned: vi.fn().mockResolvedValue(undefined),
    findOwnedWithRelations: vi.fn().mockResolvedValue(order),
    toDomain: vi.fn().mockReturnValue({
      id: order.id,
      status: order.status,
      archived: false,
      currency: 'CNY',
      totalAmount: 0,
      payments: [],
      releaseEvents: order.releaseEvents,
      shipments: [],
    }),
    getDetail: vi.fn().mockResolvedValue({ id: 'o1' }),
  } as never)

const txMock = (): TxMock => ({ releaseEvent: { create: vi.fn() }, payment: { update: vi.fn() } })

const withTx = (prisma: ReturnType<typeof prismaMock>, tx: TxMock): TxMock => {
  prisma.$transaction.mockImplementation(async (arg: never) =>
    (arg as unknown as (t: TxMock) => Promise<unknown>)(tx),
  )
  return tx
}

describe('ReleaseService.delay', () => {
  it('oldDate 缺省时自动取当前计划出货日', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, txMock())
    await buildService(prisma, orderRow()).delay('u1', 'o1', { newDate: '2027-05-01' })
    expect(tx.releaseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'DELAY',
        oldDate: new Date('2027-01-01T00:00:00.000Z'),
        newDate: new Date('2027-05-01T00:00:00.000Z'),
        datePrecision: 'MONTH',
      }),
    })
  })

  it('显式传入 oldDate 时以传入值为准', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, txMock())
    await buildService(prisma, orderRow()).delay('u1', 'o1', { newDate: '2027-05-01', oldDate: '2027-02-01' })
    expect(tx.releaseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ oldDate: new Date('2027-02-01T00:00:00.000Z') }),
    })
  })

  it('已厂商出货 → 400 RELEASE_NOT_DELAYABLE', async () => {
    const prisma = prismaMock()
    const order = orderRow({ releaseEvents: releaseEventsOf([{ type: 'RELEASED', newDate: '2027-05-16' }]) })
    await expect(buildService(prisma, order).delay('u1', 'o1', { newDate: '2027-07-01' })).rejects.toMatchObject({
      status: 400,
      response: { code: 'RELEASE_NOT_DELAYABLE' },
    })
  })

  it('已取消订单 → 400 RELEASE_NOT_DELAYABLE', async () => {
    const prisma = prismaMock()
    const order = orderRow({ status: 'CANCELLED' })
    await expect(buildService(prisma, order).delay('u1', 'o1', { newDate: '2027-07-01' })).rejects.toMatchObject({
      status: 400,
      response: { code: 'RELEASE_NOT_DELAYABLE' },
    })
  })

  it('延期只新增事件，不修改原计划事件', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, txMock())
    const order = orderRow()
    await buildService(prisma, order).delay('u1', 'o1', { newDate: '2027-05-01' })
    expect(order.releaseEvents).toHaveLength(1)
    expect(tx.releaseEvent.create).toHaveBeenCalledTimes(1)
  })
})

describe('ReleaseService.markReleased / markStoreArrived', () => {
  const cases = [
    ['markReleased', 'RELEASED'],
    ['markStoreArrived', 'STORE_ARRIVED'],
  ] as const

  it.each(cases)('%s 写入 %s 事件', async (method, type) => {
    const prisma = prismaMock()
    await buildService(prisma, orderRow())[method]('u1', 'o1', { date: '2027-05-16' })
    expect(prisma.releaseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type, datePrecision: 'DAY' }),
    })
  })

  it('已退款订单 → 400 ORDER_NOT_ACTIVE', async () => {
    const prisma = prismaMock()
    const order = orderRow({ status: 'REFUNDED' })
    await expect(buildService(prisma, order).markReleased('u1', 'o1', {})).rejects.toMatchObject({
      status: 400,
      response: { code: 'ORDER_NOT_ACTIVE' },
    })
  })
})

describe('ReleaseService.openBalance', () => {
  it('定位 BALANCE 待付款节点并回写 dueAt', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, txMock())
    const order = orderRow({
      payments: [{ id: 'p-balance', type: 'BALANCE', status: 'PENDING', amount: 999 }],
    })
    await buildService(prisma, order).openBalance('u1', 'o1', { dueAt: '2027-03-20' })
    expect(tx.releaseEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'BALANCE_OPEN' }) })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'p-balance' },
      data: { expectedAt: undefined, dueAt: new Date('2027-03-20T00:00:00.000Z') },
    })
  })

  it('没有待付款节点 → 400 BALANCE_NOT_FOUND', async () => {
    const prisma = prismaMock()
    await expect(
      buildService(prisma, orderRow()).openBalance('u1', 'o1', { dueAt: '2027-03-20' }),
    ).rejects.toMatchObject({ status: 400, response: { code: 'BALANCE_NOT_FOUND' } })
  })
})
