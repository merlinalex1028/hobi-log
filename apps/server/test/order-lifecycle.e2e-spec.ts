import { HttpStatus, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { BusinessException } from '../src/common/exceptions/business.exception'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { createValidationPipe } from '../src/common/pipes/create-validation-pipe'
import { PrismaService } from '../src/database/prisma.service'
import { SupabaseService } from '../src/modules/auth/supabase.service'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 })

describe('Order lifecycle (e2e, real postgres)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let productId: string
  let orderId: string

  const authed = (req: request.Test, token = 'token-a') =>
    req.set('Authorization', `Bearer ${token}`)

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({
        admin: {},
        getUserFromToken: async (token: string) => {
          if (token === 'token-a') return { id: USER_A, email: 'a@hobilog.dev' }
          if (token === 'token-b') return { id: USER_B, email: 'b@hobilog.dev' }
          throw new BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', '令牌无效或已过期')
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(createValidationPipe())
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
    prisma = app.get(PrismaService)

    await prisma.userProfile.upsert({ where: { id: USER_A }, create: { id: USER_A }, update: {} })
    await prisma.userProfile.upsert({ where: { id: USER_B }, create: { id: USER_B }, update: {} })
    await prisma.order.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
    await prisma.product.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })

    const product = await prisma.product.create({
      data: { userId: USER_A, name: '芙宁娜 1/7', category: 'SCALE_FIGURE', manufacturer: 'ALTER' },
      select: { id: true },
    })
    productId = product.id
  })

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
    await prisma.product.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
    await prisma.userProfile.deleteMany({ where: { id: { in: [USER_A, USER_B] } } })
    await app.close()
  })

  const createOrder = async (body: Record<string, unknown>) => {
    const res = await authed(request(app.getHttpServer()).post('/api/orders')).send(body)
    expect(res.status).toBe(201)
    return res.body as { id: string; displayStatus: string; displayStatusLabel: string }
  }

  it('B 全款预售：FULL PAID + EXPECTED_RELEASE → WAITING_RELEASE', async () => {
    const order = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'FULL',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'FULL', amount: 1299, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' }],
      expectedRelease: { date: '2027-05-01', precision: 'MONTH' },
    })
    expect(order.displayStatus).toBe('WAITING_RELEASE')
    orderId = order.id
  })

  it('D 尾款逾期：动态推导 PAYMENT_OVERDUE', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'DEPOSIT_BALANCE',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [
        { type: 'DEPOSIT', amount: 300, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' },
        { type: 'BALANCE', amount: 999, dueAt: '2020-01-01' },
      ],
    })
    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    expect(detail.body.displayStatus).toBe('PAYMENT_OVERDUE')
    expect(detail.body.paymentSummary.status).toBe('OVERDUE')
  })

  it('C + 标记付款：DEPOSIT PAID + BALANCE PENDING → WAITING_PAYMENT，付款后转 WAITING_RELEASE', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'DEPOSIT_BALANCE',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [
        { type: 'DEPOSIT', amount: 300, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' },
        { type: 'BALANCE', amount: 999, dueAt: '2027-03-20' },
      ],
      expectedRelease: { date: '2027-05-01', precision: 'MONTH' },
    })
    expect(created.displayStatus).toBe('WAITING_PAYMENT')

    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    const balance = detail.body.payments.find((item: { type: string }) => item.type === 'BALANCE')

    const paid = await authed(
      request(app.getHttpServer()).post(`/api/payments/${balance.id}/paid`),
    ).send({
      paidAmount: 999,
      paidAt: '2027-03-18T10:00:00.000Z',
      paymentMethod: '支付宝',
    })
    expect(paid.status).toBe(201)
    expect(paid.body.displayStatus).toBe('WAITING_RELEASE')
    expect(paid.body.paymentSummary.paidAmount).toBe(1299)
  })

  it('E 延期：保留 oldDate → newDate 且标签体现延期', async () => {
    const res = await authed(
      request(app.getHttpServer()).post(`/api/orders/${orderId}/release/delay`),
    ).send({
      newDate: '2027-07-01',
      precision: 'MONTH',
      source: '厂商公告',
    })
    expect(res.status).toBe(201)
    const events = res.body.releaseEvents as Array<{ type: string; oldDate: string; newDate: string }>
    const delay = events.find(event => event.type === 'DELAY')
    expect(delay?.oldDate).toBe('2027-05-01')
    expect(delay?.newDate).toBe('2027-07-01')
    expect(res.body.releaseSummary.delayMonths).toBe(2)
  })

  it('F + G + J 厂商出货 → 物流 → 签收 → COMPLETED', async () => {
    const released = await authed(
      request(app.getHttpServer()).post(`/api/orders/${orderId}/release/released`),
    ).send({ date: '2027-07-10' })
    expect(released.body.displayStatus).toBe('WAITING_SHIPMENT')

    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${orderId}`))
    const orderItemId = detail.body.items[0].id

    const shipped = await authed(
      request(app.getHttpServer()).post(`/api/orders/${orderId}/shipments`),
    ).send({
      carrier: '顺丰',
      trackingNo: 'SF123456789',
      shippedAt: '2027-07-12T10:00:00.000Z',
      items: [{ orderItemId, quantity: 1 }],
    })
    expect(shipped.body.displayStatus).toBe('IN_TRANSIT')

    const shipmentId = shipped.body.shipments[0].id
    const delivered = await authed(
      request(app.getHttpServer()).post(`/api/shipments/${shipmentId}/delivered`),
    ).send({})
    expect(delivered.body.displayStatus).toBe('COMPLETED')
    expect(delivered.body.status).toBe('COMPLETED')
  })

  it('H 物流异常：EXCEPTION 优先于运输中', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 100 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'FULL',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'FULL', amount: 100, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' }],
    })
    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    const orderItemId = detail.body.items[0].id

    const shipped = await authed(
      request(app.getHttpServer()).post(`/api/orders/${created.id}/shipments`),
    ).send({
      carrier: '顺丰',
      trackingNo: 'SF-EXC',
      items: [{ orderItemId, quantity: 1 }],
    })
    const shipmentId = shipped.body.shipments[0].id

    const exception = await authed(
      request(app.getHttpServer()).patch(`/api/shipments/${shipmentId}`),
    ).send({
      status: 'EXCEPTION',
      note: '包裹破损',
    })
    expect(exception.body.displayStatus).toBe('SHIPMENT_EXCEPTION')
  })

  it('I 多包裹：1 DELIVERED + 1 IN_TRANSIT → IN_TRANSIT，且超量拆单被拒', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 2, unitPrice: 100 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'FULL',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'FULL', amount: 200, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' }],
    })
    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    const orderItemId = detail.body.items[0].id

    const first = await authed(
      request(app.getHttpServer()).post(`/api/orders/${created.id}/shipments`),
    ).send({
      carrier: '顺丰',
      trackingNo: 'SF-A',
      items: [{ orderItemId, quantity: 1 }],
    })
    expect(first.body.displayStatus).toBe('IN_TRANSIT')

    const second = await authed(
      request(app.getHttpServer()).post(`/api/orders/${created.id}/shipments`),
    ).send({
      carrier: '圆通',
      trackingNo: 'YT-B',
      items: [{ orderItemId, quantity: 1 }],
    })
    expect(second.body.displayStatus).toBe('IN_TRANSIT')
    expect(second.body.shipmentSummary.inTransitCount).toBe(2)

    const overShip = await authed(
      request(app.getHttpServer()).post(`/api/orders/${created.id}/shipments`),
    ).send({
      carrier: '圆通',
      trackingNo: 'YT-C',
      items: [{ orderItemId, quantity: 1 }],
    })
    expect(overShip.status).toBe(400)
    expect(overShip.body.code).toBe('SHIPMENT_QUANTITY_EXCEEDED')

    const deliveredFirst = await authed(
      request(app.getHttpServer()).post(`/api/shipments/${first.body.shipments[0].id}/delivered`),
    ).send({})
    expect(deliveredFirst.body.displayStatus).toBe('IN_TRANSIT')
    expect(deliveredFirst.body.shipmentSummary.inTransitCount).toBe(1)

    const deliveredSecond = await authed(
      request(app.getHttpServer()).post(`/api/shipments/${second.body.shipments[1].id}/delivered`),
    ).send({})
    expect(deliveredSecond.body.displayStatus).toBe('COMPLETED')
  })

  it('金额待定补邮：amount = null 仍计入待付款', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'CUSTOM',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [
        { type: 'FULL', amount: 1299, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' },
        { type: 'SHIPPING', amount: null },
      ],
    })
    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    expect(detail.body.displayStatus).toBe('WAITING_PAYMENT')
    expect(detail.body.displayStatusHint).toBe('暂无截止日期')
    expect(detail.body.paymentSummary.pendingAmount).toBe(0)
    expect(detail.body.paymentSummary.nextPayment.type).toBe('SHIPPING')
  })

  it('退款取消：订单 CANCELLED + 未付节点 CANCELLED + 退款记录', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'DEPOSIT_BALANCE',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [
        { type: 'DEPOSIT', amount: 300, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' },
        { type: 'BALANCE', amount: 999, dueAt: '2027-03-20' },
      ],
    })

    const cancelled = await authed(
      request(app.getHttpServer()).post(`/api/orders/${created.id}/cancel`),
    ).send({
      refund: true,
      note: '店家取消发货',
    })
    expect(cancelled.body.status).toBe('CANCELLED')
    expect(cancelled.body.displayStatus).toBe('CANCELLED')
    const statuses = (cancelled.body.payments as Array<{ type: string; status: string }>).map(
      item => `${item.type}:${item.status}`,
    )
    expect(statuses).toContain('BALANCE:CANCELLED')
    expect(statuses).toContain('REFUND:PAID')
    expect(cancelled.body.paymentSummary.netPaidAmount).toBe(0)
  })

  it('越权隔离：用户 B 无法读取用户 A 的订单', async () => {
    const res = await authed(request(app.getHttpServer()).get(`/api/orders/${orderId}`), 'token-b')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('ORDER_NOT_FOUND')

    const list = await authed(request(app.getHttpServer()).get('/api/orders'), 'token-b')
    expect(list.body.items).toHaveLength(0)
  })
})
