import { HttpStatus, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { BusinessException } from '../src/common/exceptions/business.exception'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { createValidationPipe } from '../src/common/pipes/create-validation-pipe'
import { PrismaService } from '../src/database/prisma.service'
import { SupabaseService } from '../src/modules/auth/supabase.service'

const USER_A = '33333333-3333-4333-8333-333333333333'
const USER_B = '44444444-4444-4444-8444-444444444444'

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 })

const storageMock = {
  admin: {
    storage: {
      from: () => ({
        createSignedUploadUrl: async () => ({
          data: { token: 'signed-token', signedUrl: 'https://signed.example/upload' },
          error: null,
        }),
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://signed.example/${path}` },
          error: null,
        }),
        remove: async () => ({ data: [{ name: 'x' }], error: null }),
      }),
    },
  },
  getUserFromToken: async (token: string) => {
    if (token === 'token-a') return { id: USER_A, email: 'a@hobilog.dev' }
    if (token === 'token-b') return { id: USER_B, email: 'b@hobilog.dev' }
    throw new BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', '令牌无效或已过期')
  },
}

describe('Read models (e2e, real postgres)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let archivedOrderId: string

  const authed = (req: request.Test, token = 'token-a') =>
    req.set('Authorization', `Bearer ${token}`)

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue(storageMock)
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

    const cnyProduct = await prisma.product.create({
      data: {
        userId: USER_A,
        name: '芙宁娜 1/7',
        category: 'SCALE_FIGURE',
        ipName: '原神',
        manufacturer: 'ALTER',
        officialCurrency: 'CNY',
      },
      select: { id: true },
    })
    const jpyProduct = await prisma.product.create({
      data: {
        userId: USER_A,
        name: 'Saber 1/7',
        category: 'SCALE_FIGURE',
        ipName: 'Fate',
        manufacturer: 'ALTER',
        officialCurrency: 'JPY',
      },
      select: { id: true },
    })

    const cnyOrder = await prisma.order.create({
      data: {
        userId: USER_A,
        orderedAt: new Date('2026-09-01'),
        currency: 'CNY',
        paymentMode: 'FULL',
        goodsAmount: 1000,
        totalAmount: 1000,
        items: { create: [{ productId: cnyProduct.id, quantity: 2, unitPrice: 500, subtotal: 1000 }] },
        payments: {
          create: [
            {
              type: 'FULL',
              amount: 1000,
              status: 'PAID',
              paidAt: new Date('2026-09-10T10:00:00.000Z'),
              sortOrder: 0,
            },
          ],
        },
        releaseEvents: {
          create: [
            { type: 'EXPECTED_RELEASE', newDate: new Date('2026-09-30'), datePrecision: 'MONTH' },
            { type: 'RELEASED', newDate: new Date('2026-09-25'), datePrecision: 'DAY' },
          ],
        },
        shipments: {
          create: [
            {
              carrier: '顺丰',
              trackingNo: 'SF-READ-1',
              status: 'DELIVERED',
              shippedAt: new Date('2026-09-18T10:00:00.000Z'),
              deliveredAt: new Date('2026-09-20T10:00:00.000Z'),
            },
          ],
        },
      },
      select: { id: true },
    })

    const jpyOrder = await prisma.order.create({
      data: {
        userId: USER_A,
        orderedAt: new Date('2026-10-02'),
        currency: 'JPY',
        paymentMode: 'FULL',
        goodsAmount: 20000,
        totalAmount: 20000,
        items: { create: [{ productId: jpyProduct.id, quantity: 1, unitPrice: 20000, subtotal: 20000 }] },
        payments: {
          create: [
            {
              type: 'FULL',
              amount: 20000,
              currency: 'JPY',
              status: 'PAID',
              paidAt: new Date('2026-10-05T10:00:00.000Z'),
              sortOrder: 0,
            },
          ],
        },
        releaseEvents: {
          create: [
            { type: 'EXPECTED_RELEASE', newDate: new Date('2027-01-15'), datePrecision: 'MONTH' },
          ],
        },
      },
      select: { id: true },
    })

    const pendingOrder = await prisma.order.create({
      data: {
        userId: USER_A,
        orderedAt: new Date('2026-09-15'),
        currency: 'CNY',
        paymentMode: 'DEPOSIT_BALANCE',
        goodsAmount: 800,
        totalAmount: 800,
        items: { create: [{ productId: cnyProduct.id, quantity: 1, unitPrice: 800, subtotal: 800 }] },
        payments: {
          create: [
            {
              type: 'DEPOSIT',
              amount: 300,
              status: 'PAID',
              paidAt: new Date('2026-09-18T10:00:00.000Z'),
              sortOrder: 0,
            },
            {
              type: 'BALANCE',
              amount: 500,
              status: 'PENDING',
              dueAt: new Date('2026-11-20'),
              sortOrder: 1,
            },
          ],
        },
        releaseEvents: {
          create: [
            { type: 'EXPECTED_RELEASE', newDate: new Date('2027-01-01'), datePrecision: 'MONTH' },
            {
              type: 'DELAY',
              oldDate: new Date('2027-01-01'),
              newDate: new Date('2027-05-01'),
              datePrecision: 'MONTH',
            },
          ],
        },
      },
      select: { id: true },
    })

    const archivedOrder = await prisma.order.create({
      data: {
        userId: USER_A,
        orderedAt: new Date('2026-09-05'),
        currency: 'CNY',
        paymentMode: 'FULL',
        goodsAmount: 500,
        totalAmount: 500,
        archived: true,
        items: { create: [{ productId: cnyProduct.id, quantity: 1, unitPrice: 500, subtotal: 500 }] },
        payments: {
          create: [
            {
              type: 'FULL',
              amount: 500,
              status: 'PAID',
              paidAt: new Date('2026-09-15T10:00:00.000Z'),
              sortOrder: 0,
            },
          ],
        },
      },
      select: { id: true },
    })

    archivedOrderId = archivedOrder.id
    expect(cnyOrder.id).toBeTruthy()
    expect(jpyOrder.id).toBeTruthy()
    expect(pendingOrder.id).toBeTruthy()
  })

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
    await prisma.product.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
    await prisma.userProfile.deleteMany({ where: { id: { in: [USER_A, USER_B] } } })
    await app.close()
  })

  it('GET /api/statistics/dashboard 返回 KPI 与待办', async () => {
    const res = await authed(request(app.getHttpServer()).get('/api/statistics/dashboard'))
    expect(res.status).toBe(200)
    expect(res.body.kpis).toHaveProperty('pendingPaymentAmount')
    expect(res.body.kpis.pendingPaymentAmount).toEqual([{ currency: 'CNY', amount: 500 }])
    expect(res.body.kpis.collectionCount).toBe(2)
    expect(Array.isArray(res.body.todos)).toBe(true)
  })

  it('GET /api/statistics/payments/monthly 按 paidAt 归月并排除归档订单', async () => {
    const res = await authed(
      request(app.getHttpServer()).get('/api/statistics/payments/monthly?from=2026-09-01&to=2026-10-31'),
    )
    expect(res.status).toBe(200)
    const rows = res.body as Array<{
      month: string
      currency: string
      paidAmount: number
      orderAmount: number
    }>
    const cnySeptember = rows.find(row => row.month === '2026-09' && row.currency === 'CNY')
    expect(cnySeptember?.paidAmount).toBe(1300)
    expect(cnySeptember?.orderAmount).toBe(1800)
    const jpyOctober = rows.find(row => row.month === '2026-10' && row.currency === 'JPY')
    expect(jpyOctober?.paidAmount).toBe(20000)
  })

  it('GET /api/statistics/payments/future 按月份返回', async () => {
    const res = await authed(
      request(app.getHttpServer()).get('/api/statistics/payments/future?months=12'),
    )
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it.each(['categories', 'platforms', 'manufacturers', 'ips'])(
    'GET /api/statistics/%s 不跨币种相加且排除归档订单',
    async dimension => {
      const res = await authed(
        request(app.getHttpServer()).get(`/api/statistics/${dimension}?from=2026-01-01&to=2026-12-31`),
      )
      expect(res.status).toBe(200)
      const rows = res.body as Array<{
        key: string
        amount: Array<{ currency: string; amount: number }>
      }>
      const currencies = new Set<string>()
      let cnyTotal = 0
      let jpyTotal = 0
      for (const row of rows) {
        for (const item of row.amount) {
          expect(currencies.has(item.currency)).toBe(false)
          currencies.add(item.currency)
          if (item.currency === 'CNY') cnyTotal += item.amount
          if (item.currency === 'JPY') jpyTotal += item.amount
        }
      }
      expect(cnyTotal).toBe(1300)
      expect(jpyTotal).toBe(20000)
    },
  )

  it('归档订单不出现在日历事件里', async () => {
    const res = await authed(
      request(app.getHttpServer()).get('/api/calendar/events?from=2026-09-01&to=2026-09-30'),
    )
    expect(res.status).toBe(200)
    const orderIds = (res.body as Array<{ orderId: string }>).map(event => event.orderId)
    expect(orderIds).not.toContain(archivedOrderId)
    expect(orderIds.length).toBeGreaterThan(0)
  })

  it('GET /api/collection 与 /stats 口径一致（件数）', async () => {
    const list = await authed(request(app.getHttpServer()).get('/api/collection'))
    const stats = await authed(request(app.getHttpServer()).get('/api/collection/stats'))
    expect(list.status).toBe(200)
    expect(stats.status).toBe(200)
    expect(list.body.items).toHaveLength(1)
    expect(stats.body.totalItems).toBe(2)
    expect(stats.body.deliveredOrders).toBe(1)
    expect(stats.body.byCurrency).toEqual([{ currency: 'CNY', amount: 1000 }])
  })

  it('GET /api/notifications/todos 返回提醒数组', async () => {
    const res = await authed(request(app.getHttpServer()).get('/api/notifications/todos'))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('POST /api/attachments/upload-url 返回 userId 前缀路径', async () => {
    const dashboard = await authed(
      request(app.getHttpServer()).get('/api/calendar/events?from=2026-09-01&to=2026-11-30'),
    )
    const targetId = (dashboard.body as Array<{ orderId: string }>)[0]?.orderId

    const res = await authed(request(app.getHttpServer()).post('/api/attachments/upload-url')).send({
      bucket: 'attachments',
      targetType: 'ORDER',
      targetId,
      fileName: 'invoice.png',
      mimeType: 'image/png',
      fileSize: 1024,
    })
    expect(res.status).toBe(201)
    expect(String(res.body.path).startsWith(`${USER_A}/`)).toBe(true)
    expect(res.body.bucket).toBe('attachments')
  })

  it('越权隔离：B 看不到 A 的读侧数据', async () => {
    const dashboard = await authed(request(app.getHttpServer()).get('/api/statistics/dashboard'), 'token-b')
    expect(dashboard.status).toBe(200)
    expect(dashboard.body.kpis.pendingPaymentAmount).toEqual([])
    expect(dashboard.body.kpis.collectionCount).toBe(0)

    const collection = await authed(request(app.getHttpServer()).get('/api/collection'), 'token-b')
    expect(collection.body.items).toHaveLength(0)
  })
})
