import { ShipmentService } from './shipment.service'

const prismaMock = () => ({
  shipment: { create: vi.fn().mockResolvedValue({ id: 'sh1' }), update: vi.fn(), findFirst: vi.fn() },
  shipmentItem: { createMany: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
  $transaction: vi.fn(),
})

const orderRow = (patch: Record<string, unknown> = {}) => ({
  id: 'o1',
  status: 'ACTIVE',
  items: [
    { id: 'oi1', quantity: 1 },
    { id: 'oi2', quantity: 2 },
  ],
  ...patch,
})

const buildService = (prisma: ReturnType<typeof prismaMock>, order = orderRow()) =>
  new ShipmentService(prisma as never, {
    findOwnedWithRelations: vi.fn().mockResolvedValue(order),
    refreshStatus: vi.fn().mockResolvedValue('ACTIVE'),
    getDetail: vi.fn().mockResolvedValue({ id: 'o1' }),
  } as never)

interface TxMock {
  shipment: { create: ReturnType<typeof vi.fn> }
  shipmentItem: { createMany: ReturnType<typeof vi.fn> }
}

const txMock = (id: string): TxMock => ({
  shipment: { create: vi.fn().mockResolvedValue({ id }) },
  shipmentItem: { createMany: vi.fn() },
})

const withTx = (prisma: ReturnType<typeof prismaMock>, tx: TxMock): TxMock => {
  prisma.$transaction.mockImplementation(async (arg: never) =>
    (arg as unknown as (t: TxMock) => Promise<unknown>)(tx),
  )
  return tx
}

describe('ShipmentService.create', () => {
  it('明细包含非本订单商品 → 400 INVALID_SHIPMENT_ITEMS', async () => {
    const prisma = prismaMock()
    await expect(
      buildService(prisma).create('u1', 'o1', { items: [{ orderItemId: 'other', quantity: 1 }] }),
    ).rejects.toMatchObject({ status: 400, response: { code: 'INVALID_SHIPMENT_ITEMS' } })
  })

  it('拆单超量 → 400 SHIPMENT_QUANTITY_EXCEEDED', async () => {
    const prisma = prismaMock()
    prisma.shipmentItem.groupBy.mockResolvedValue([{ orderItemId: 'oi2', _sum: { quantity: 2 } }])
    await expect(
      buildService(prisma).create('u1', 'o1', { items: [{ orderItemId: 'oi2', quantity: 1 }] }),
    ).rejects.toMatchObject({ status: 400, response: { code: 'SHIPMENT_QUANTITY_EXCEEDED' } })
  })

  it('合法拆单：A×1 + B×1 后 B 仍可再发 1 件', async () => {
    const prisma = prismaMock()
    prisma.shipmentItem.groupBy.mockResolvedValue([{ orderItemId: 'oi2', _sum: { quantity: 1 } }])
    const tx = withTx(prisma, txMock('sh2'))
    await buildService(prisma).create('u1', 'o1', {
      items: [
        { orderItemId: 'oi1', quantity: 1 },
        { orderItemId: 'oi2', quantity: 1 },
      ],
    })
    expect(tx.shipmentItem.createMany).toHaveBeenCalledWith({
      data: [
        { shipmentId: 'sh2', orderItemId: 'oi1', quantity: 1 },
        { shipmentId: 'sh2', orderItemId: 'oi2', quantity: 1 },
      ],
    })
  })

  it('无单号 → WAITING', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, txMock('sh3'))
    await buildService(prisma).create('u1', 'o1', { items: [{ orderItemId: 'oi1', quantity: 1 }] })
    expect(tx.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'WAITING', shippedAt: null }),
      select: { id: true },
    })
  })

  it('有单号 → SHIPPED 且带发货时间', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, txMock('sh4'))
    await buildService(prisma).create('u1', 'o1', {
      trackingNo: 'SF123',
      shippedAt: '2027-05-18T10:00:00.000Z',
      items: [{ orderItemId: 'oi1', quantity: 1 }],
    })
    expect(tx.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'SHIPPED',
        trackingNo: 'SF123',
        shippedAt: new Date('2027-05-18T10:00:00.000Z'),
      }),
      select: { id: true },
    })
  })

  it('订单已取消 → 400 ORDER_NOT_ACTIVE', async () => {
    const prisma = prismaMock()
    await expect(
      buildService(prisma, orderRow({ status: 'CANCELLED' })).create('u1', 'o1', {
        items: [{ orderItemId: 'oi1', quantity: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400, response: { code: 'ORDER_NOT_ACTIVE' } })
  })
})

describe('ShipmentService.markDelivered', () => {
  it('WAITING 物流不可签收 → 400 SHIPMENT_NOT_DELIVERABLE', async () => {
    const prisma = prismaMock()
    prisma.shipment.findFirst.mockResolvedValue({ id: 'sh1', orderId: 'o1', status: 'WAITING', note: null })
    await expect(buildService(prisma).markDelivered('u1', 'sh1', {})).rejects.toMatchObject({
      status: 400,
      response: { code: 'SHIPMENT_NOT_DELIVERABLE' },
    })
  })

  it('IN_TRANSIT → DELIVERED 并刷新订单状态', async () => {
    const prisma = prismaMock()
    prisma.shipment.findFirst.mockResolvedValue({ id: 'sh1', orderId: 'o1', status: 'IN_TRANSIT', note: null })
    const orderService = {
      findOwnedWithRelations: vi.fn(),
      refreshStatus: vi.fn().mockResolvedValue('COMPLETED'),
      getDetail: vi.fn().mockResolvedValue({ id: 'o1' }),
    }
    const service = new ShipmentService(prisma as never, orderService as never)

    await service.markDelivered('u1', 'sh1', { deliveredAt: '2027-05-21T00:00:00.000Z' })

    expect(prisma.shipment.update).toHaveBeenCalledWith({
      where: { id: 'sh1' },
      data: { status: 'DELIVERED', deliveredAt: new Date('2027-05-21T00:00:00.000Z'), note: null },
    })
    expect(orderService.refreshStatus).toHaveBeenCalledWith('u1', 'o1')
  })
})
