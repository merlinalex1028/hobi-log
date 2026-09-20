import { HttpStatus } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { PaymentService } from './payment.service'

const prismaMock = () => ({
  payment: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 1 } }),
  },
  $transaction: vi.fn(),
})

const orderServiceMock = () => ({
  assertOwned: vi.fn().mockResolvedValue(undefined),
  refreshStatus: vi.fn().mockResolvedValue('ACTIVE'),
  getDetail: vi.fn().mockResolvedValue({ id: 'o1' }),
})

const buildService = (
  prisma: ReturnType<typeof prismaMock>,
  orders: ReturnType<typeof orderServiceMock> = orderServiceMock(),
) => new PaymentService(prisma as never, orders as never)

interface TxMock {
  payment: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
}

const withTx = (prisma: ReturnType<typeof prismaMock>, tx: TxMock): TxMock => {
  prisma.$transaction.mockImplementation(async (arg: never) =>
    (arg as unknown as (t: TxMock) => Promise<unknown>)(tx),
  )
  return tx
}

const txMock = (): TxMock => ({ payment: { create: vi.fn(), update: vi.fn() } })

describe('PaymentService.create', () => {
  it('未显式指定 sortOrder 时追加到末尾', async () => {
    const prisma = prismaMock()
    prisma.payment.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } })
    const orders = orderServiceMock()
    const result = await buildService(prisma, orders).create('u1', 'o1', { type: 'BALANCE' })

    expect(orders.assertOwned).toHaveBeenCalledWith('u1', 'o1')
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'o1', type: 'BALANCE', status: 'PENDING', sortOrder: 5 }),
    })
    expect(orders.getDetail).toHaveBeenCalledWith('u1', 'o1')
    expect(result).toEqual({ id: 'o1' })
  })

  it('显式指定 sortOrder 时优先生效', async () => {
    const prisma = prismaMock()
    await buildService(prisma).create('u1', 'o1', { type: 'BALANCE', sortOrder: 0 })
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sortOrder: 0 }),
    })
  })

  it('订单不属于当前用户 → 404 且不写库', async () => {
    const prisma = prismaMock()
    const orders = orderServiceMock()
    orders.assertOwned.mockRejectedValue(
      new BusinessException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', '订单不存在'),
    )
    await expect(buildService(prisma, orders).create('u1', 'o1', { type: 'BALANCE' })).rejects.toMatchObject({
      status: 404,
      response: { code: 'ORDER_NOT_FOUND' },
    })
    expect(prisma.payment.create).not.toHaveBeenCalled()
  })
})

describe('PaymentService.update', () => {
  it('传 paidAt 且原节点 PENDING → 自动置 PAID 并刷新订单状态', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', amount: 999 })
    const orders = orderServiceMock()
    await buildService(prisma, orders).update('u1', 'pay1', { paidAt: '2026-09-20T10:00:00.000Z' })

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID', paidAt: new Date('2026-09-20T10:00:00.000Z') }),
    })
    expect(orders.refreshStatus).toHaveBeenCalledWith('u1', 'o1')
  })

  it('已 PAID 节点只改 paidAt 时状态不变', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PAID', amount: 999 })
    await buildService(prisma).update('u1', 'pay1', { paidAt: '2026-09-20T10:00:00.000Z' })
    const call = prisma.payment.update.mock.calls[0]?.[0] as { data: { status?: unknown } }
    expect(call.data.status).toBeUndefined()
  })

  it('节点不属于当前用户 → 404 PAYMENT_NOT_FOUND', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue(null)
    await expect(buildService(prisma).update('u1', 'pay1', { note: 'x' })).rejects.toMatchObject({
      status: 404,
      response: { code: 'PAYMENT_NOT_FOUND' },
    })
    expect(prisma.payment.update).not.toHaveBeenCalled()
  })
})

describe('PaymentService.markPaid', () => {
  it('已付款节点 → 400 PAYMENT_NOT_PAYABLE', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PAID', type: 'BALANCE', amount: 999 })
    await expect(buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 999, createSupplement: true })).rejects.toMatchObject({
      status: 400,
      response: { code: 'PAYMENT_NOT_PAYABLE' },
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('实付等于计划 → 按原金额入账且不建补差价', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999 })
    const tx = withTx(prisma, txMock())
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 999, createSupplement: true })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID', amount: 999 }),
    })
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it('实付高于计划 → 原金额不变 + 新建 SUPPLEMENT', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999, currency: 'CNY' })
    const tx = withTx(prisma, txMock())
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 1029, createSupplement: true })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID', amount: 999 }),
    })
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'o1', type: 'SUPPLEMENT', amount: 30, status: 'PAID' }),
    })
  })

  it('createSupplement = false 时不建补差价', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999, currency: 'CNY' })
    const tx = withTx(prisma, txMock())
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 1029, createSupplement: false })
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it('实付低于计划 → 按实付修正并记录原计划', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999 })
    const tx = withTx(prisma, txMock())
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 900, note: '店家优惠', createSupplement: true })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID', amount: 900, note: '店家优惠; 原计划 ¥999' }),
    })
  })

  it('金额待定（amount = null）→ 按实付入账', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'SHIPPING', amount: null })
    const tx = withTx(prisma, txMock())
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 20, createSupplement: true })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID', amount: 20 }),
    })
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it('逾期节点（PENDING 且 dueAt 已过）仍可标记付款', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay1',
      orderId: 'o1',
      status: 'PENDING',
      type: 'BALANCE',
      amount: 999,
      dueAt: new Date('2020-01-01T00:00:00.000Z'),
    })
    const tx = withTx(prisma, txMock())
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 999, createSupplement: true })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID' }),
    })
  })
})

describe('PaymentService.refund', () => {
  it('未付款节点 → 400 PAYMENT_NOT_REFUNDABLE', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999 })
    await expect(buildService(prisma).refund('u1', 'pay1', { amount: 300, markOriginal: true })).rejects.toMatchObject({
      status: 400,
      response: { code: 'PAYMENT_NOT_REFUNDABLE' },
    })
  })

  it('全额退款 → 原节点 REFUNDED，退款金额为正数', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PAID', type: 'DEPOSIT', amount: 300, currency: 'CNY', name: '定金' })
    const tx = withTx(prisma, txMock())
    await buildService(prisma).refund('u1', 'pay1', { amount: 300, markOriginal: true })
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'o1', type: 'REFUND', amount: 300, status: 'PAID' }),
    })
    expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 'pay1' }, data: { status: 'REFUNDED' } })
  })

  it('部分退款 → 原节点 PARTIALLY_REFUNDED', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PAID', type: 'DEPOSIT', amount: 300, currency: 'CNY', name: '定金' })
    const tx = withTx(prisma, txMock())
    await buildService(prisma).refund('u1', 'pay1', { amount: 100, markOriginal: true })
    expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 'pay1' }, data: { status: 'PARTIALLY_REFUNDED' } })
  })

  it('已有历史退款时累计判断', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PARTIALLY_REFUNDED', type: 'DEPOSIT', amount: 300, currency: 'CNY', name: '定金' })
    prisma.payment.findMany.mockResolvedValue([{ amount: 100 }])
    const tx = withTx(prisma, txMock())
    await buildService(prisma).refund('u1', 'pay1', { amount: 200, markOriginal: true })
    expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 'pay1' }, data: { status: 'REFUNDED' } })
  })

  it('markOriginal = false 时不改原节点状态', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PAID', type: 'DEPOSIT', amount: 300, currency: 'CNY', name: '定金' })
    const tx = withTx(prisma, txMock())
    await buildService(prisma).refund('u1', 'pay1', { amount: 100, markOriginal: false })
    expect(tx.payment.create).toHaveBeenCalled()
    expect(tx.payment.update).not.toHaveBeenCalled()
  })

  it('节点不属于当前用户 → 404 PAYMENT_NOT_FOUND', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue(null)
    await expect(buildService(prisma).refund('u1', 'pay1', { amount: 100, markOriginal: true })).rejects.toMatchObject({
      status: 404,
      response: { code: 'PAYMENT_NOT_FOUND' },
    })
  })
})
