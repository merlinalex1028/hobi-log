import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { toDateString, toNumber } from '../../common/utils/serialize'
import { PrismaService } from '../../database/prisma.service'
import {
  getDisplayStatus,
  getDisplayStatusHint,
  getDisplayStatusLabel,
} from '../order/domain/display-status'
import { getNextPayment, type NextPaymentInfo } from '../order/domain/payment-summary'
import { getDelayMonths, getPlannedReleaseDate } from '../order/domain/release'
import { toOrderDomain } from '../order/mapper/order-domain.mapper'
import type {
  CurrencyAmountVo,
  DashboardVo,
  DimensionStatVo,
  FuturePaymentVo,
  MonthlyPaymentVo,
} from './mapper/statistics.mapper'
import { StatisticsRepository, type DimensionField, type DimensionRow } from './statistics.repository'

const STATISTICS_ORDER_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true } } } },
  payments: true,
  releaseEvents: true,
  shipments: true,
} satisfies Prisma.OrderInclude


const ONE_DAY_MS = 86_400_000
const FUTURE_PAYMENT_WINDOW_DAYS = 30
const FUTURE_PAYMENT_MONTHS = 12
const RECENT_ORDER_LIMIT = 200

interface PaymentMonthRow {
  month: Date
  currency: string
  paidAmount: Prisma.Decimal | number | string | null
  refundAmount: Prisma.Decimal | number | string | null
}

interface OrderMonthRow {
  month: Date
  currency: string
  orderAmount: Prisma.Decimal | number | string | null
}

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: StatisticsRepository,
  ) {}

  today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private defaultRange(from?: string, to?: string): { from: Date; to: Date } {
    const today = new Date(`${this.today()}T00:00:00.000Z`)
    const defaultFrom = new Date(today.getTime() - 365 * ONE_DAY_MS)
    return {
      from: from ? new Date(`${from.slice(0, 10)}T00:00:00.000Z`) : defaultFrom,
      to: to
        ? new Date(new Date(`${to.slice(0, 10)}T00:00:00.000Z`).getTime() + ONE_DAY_MS)
        : new Date(today.getTime() + ONE_DAY_MS),
    }
  }

  private groupByCurrency(rows: Array<{ currency: string; amount: number }>): CurrencyAmountVo[] {
    const map = new Map<string, number>()
    for (const row of rows) {
      map.set(row.currency, Number(((map.get(row.currency) ?? 0) + row.amount).toFixed(2)))
    }
    return [...map.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => a.currency.localeCompare(b.currency))
  }

  async getDashboard(userId: string): Promise<DashboardVo> {
    const today = this.today()
    const todayDate = new Date(`${today}T00:00:00.000Z`)
    const horizon = new Date(todayDate.getTime() + FUTURE_PAYMENT_WINDOW_DAYS * ONE_DAY_MS)
    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`)
    const monthEnd = new Date(new Date(monthStart).setUTCMonth(monthStart.getUTCMonth() + 1))
    const futureHorizon = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`)
    futureHorizon.setUTCMonth(futureHorizon.getUTCMonth() + FUTURE_PAYMENT_MONTHS)

    const [pendingRows, upcomingRows, inTransitCount, collectionCount, totalOrderCount] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: { status: 'PENDING', order: { userId, archived: false, status: 'ACTIVE' } },
          select: { amount: true, currency: true, dueAt: true },
        }),
        this.prisma.payment.findMany({
          where: {
            status: 'PENDING',
            dueAt: { gte: todayDate, lt: horizon },
            order: { userId, archived: false, status: 'ACTIVE' },
          },
          select: { amount: true, currency: true },
        }),
        this.prisma.order.count({
          where: {
            userId,
            archived: false,
            shipments: { some: { status: { in: ['SHIPPED', 'IN_TRANSIT'] } } },
          },
        }),
        this.repository.countCollectionItems(userId),
        this.prisma.order.count({ where: { userId, archived: false } }),
      ])

    const activeOrders = await this.prisma.order.findMany({
      where: { userId, archived: false, status: 'ACTIVE' },
      include: STATISTICS_ORDER_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: RECENT_ORDER_LIMIT,
    })

    const currencyAmount = (
      rows: Array<{ amount: Prisma.Decimal | null; currency: string }>,
    ): CurrencyAmountVo[] =>
      this.groupByCurrency(
        rows
          .filter(row => row.amount !== null)
          .map(row => ({ currency: row.currency, amount: Number(row.amount) })),
      )

    const domains = activeOrders.map(order => ({ order, domain: toOrderDomain(order) }))

    const todos = domains
      .map(({ order, domain }) => {
        const next = getNextPayment(domain.payments, today)
        const status = getDisplayStatus(domain, today)
        if (!isTodoStatus(status)) return null
        return {
          orderId: order.id,
          displayStatus: status,
          displayStatusLabel: getDisplayStatusLabel(domain, today),
          displayStatusHint: getDisplayStatusHint(domain, today),
          title: order.items[0]?.product.name ?? order.orderNo ?? '订单',
          amount: next?.amount ?? null,
          currency: order.currency,
          dueAt: next?.dueAt ?? null,
          overdueDays: next?.overdueDays ?? 0,
          priority: todoPriority(status, next, today),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 10)

    const monthStartIso = monthStart.toISOString().slice(0, 10)
    const monthEndIso = monthEnd.toISOString().slice(0, 10)
    const upcomingReleases = domains
      .map(({ order, domain }) => {
        const planned = getPlannedReleaseDate(domain.releaseEvents)
        if (!planned) return null
        if (planned.precision !== 'MONTH' && planned.precision !== 'DAY') return null
        if (planned.date < monthStartIso || planned.date >= monthEndIso) return null
        return {
          orderId: order.id,
          title: order.items[0]?.product.name ?? order.orderNo ?? '订单',
          plannedDate: planned.date,
          precision: planned.precision,
          delayMonths: getDelayMonths(domain.releaseEvents),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    const shipping = domains
      .flatMap(({ order, domain }) =>
        domain.shipments
          .filter(shipment => shipment.status === 'SHIPPED' || shipment.status === 'IN_TRANSIT')
          .map(shipment => ({
            orderId: order.id,
            title: order.items[0]?.product.name ?? order.orderNo ?? '订单',
            carrier: shipment.carrier,
            trackingNo: shipment.trackingNo,
            status: shipment.status,
          })),
      )
      .slice(0, 10)

    const futureMap = new Map<string, Array<{ currency: string; amount: number }>>()
    for (const payment of pendingRows) {
      if (payment.amount === null || !payment.dueAt) continue
      if (payment.dueAt < todayDate || payment.dueAt >= futureHorizon) continue
      const month = payment.dueAt.toISOString().slice(0, 7)
      const bucket = futureMap.get(month) ?? []
      bucket.push({ currency: payment.currency, amount: Number(payment.amount) })
      futureMap.set(month, bucket)
    }

    return {
      kpis: {
        pendingPaymentAmount: currencyAmount(pendingRows),
        upcomingPaymentAmount: currencyAmount(upcomingRows),
        monthReleaseCount: upcomingReleases.length,
        inTransitOrderCount: inTransitCount,
        collectionCount,
        totalOrderCount,
      },
      todos,
      futurePayments: [...futureMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, rows]) => ({ month, byCurrency: this.groupByCurrency(rows) })),
      upcomingReleases,
      shipping,
      recentOrders: domains.slice(0, 10).map(({ order, domain }) => ({
        id: order.id,
        orderedAt: toDateString(order.orderedAt) as string,
        displayStatus: getDisplayStatus(domain, today),
        displayStatusLabel: getDisplayStatusLabel(domain, today),
        totalAmount: toNumber(order.totalAmount) ?? 0,
        currency: order.currency,
      })),
    }
  }

  async getMonthlyPayments(
    userId: string,
    from?: string,
    to?: string,
    currency?: string,
  ): Promise<MonthlyPaymentVo[]> {
    const range = this.defaultRange(from, to)

    const paymentRows = await this.prisma.$queryRaw<PaymentMonthRow[]>`
      SELECT
        date_trunc('month', COALESCE(pay."paidAt", pay."dueAt", o."orderedAt")) AS month,
        pay.currency AS currency,
        SUM(CASE WHEN pay.status = 'PAID' AND pay.type <> 'REFUND' THEN pay.amount ELSE 0 END) AS "paidAmount",
        SUM(CASE WHEN pay.status = 'PAID' AND pay.type = 'REFUND' THEN pay.amount ELSE 0 END) AS "refundAmount"
      FROM payments pay
      JOIN orders o ON o.id = pay."orderId"
      WHERE o."userId" = ${userId}::uuid
        AND o.archived = false
        AND COALESCE(pay."paidAt", pay."dueAt", o."orderedAt") >= ${range.from}
        AND COALESCE(pay."paidAt", pay."dueAt", o."orderedAt") < ${range.to}
        ${currency ? Prisma.sql`AND pay.currency = ${currency}` : Prisma.empty}
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `

    const orderRows = await this.prisma.$queryRaw<OrderMonthRow[]>`
      SELECT
        date_trunc('month', o."orderedAt") AS month,
        o.currency AS currency,
        SUM(o."totalAmount") AS "orderAmount"
      FROM orders o
      WHERE o."userId" = ${userId}::uuid
        AND o.archived = false
        AND o."orderedAt" >= ${range.from}
        AND o."orderedAt" < ${range.to}
        ${currency ? Prisma.sql`AND o.currency = ${currency}` : Prisma.empty}
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `

    const map = new Map<
      string,
      { month: string; currency: string; paidAmount: number; refundAmount: number; orderAmount: number }
    >()
    const bucketOf = (month: string, bucketCurrency: string) => {
      const key = `${month}|${bucketCurrency}`
      const existing = map.get(key)
      if (existing) return existing
      const created = {
        month,
        currency: bucketCurrency,
        paidAmount: 0,
        refundAmount: 0,
        orderAmount: 0,
      }
      map.set(key, created)
      return created
    }

    for (const row of paymentRows) {
      const entry = bucketOf(row.month.toISOString().slice(0, 7), row.currency)
      entry.paidAmount = toNumber(row.paidAmount) ?? 0
      entry.refundAmount = toNumber(row.refundAmount) ?? 0
    }

    for (const row of orderRows) {
      const entry = bucketOf(row.month.toISOString().slice(0, 7), row.currency)
      entry.orderAmount = toNumber(row.orderAmount) ?? 0
    }

    return [...map.values()]
      .map(entry => ({
        month: entry.month,
        currency: entry.currency,
        paidAmount: entry.paidAmount,
        refundAmount: entry.refundAmount,
        netPaidAmount: Number((entry.paidAmount - entry.refundAmount).toFixed(2)),
        orderAmount: entry.orderAmount,
      }))
      .sort((a, b) =>
        a.month === b.month
          ? a.currency.localeCompare(b.currency)
          : a.month.localeCompare(b.month),
      )
  }

  async getFuturePayments(
    userId: string,
    months: number,
    currency?: string,
  ): Promise<FuturePaymentVo[]> {
    const today = new Date(`${this.today()}T00:00:00.000Z`)
    const end = new Date(today)
    end.setUTCMonth(end.getUTCMonth() + months)

    const rows = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        amount: { not: null },
        dueAt: { gte: today, lt: end },
        order: { userId, archived: false, status: 'ACTIVE' },
        ...(currency ? { currency } : {}),
      },
      select: { amount: true, currency: true, dueAt: true },
    })

    const map = new Map<string, Array<{ currency: string; amount: number }>>()
    for (const row of rows) {
      if (!row.dueAt) continue
      const month = row.dueAt.toISOString().slice(0, 7)
      const bucket = map.get(month) ?? []
      bucket.push({ currency: row.currency, amount: Number(row.amount ?? 0) })
      map.set(month, bucket)
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, bucket]) => ({ month, byCurrency: this.groupByCurrency(bucket) }))
  }

  async getDimension(
    field: DimensionField,
    userId: string,
    from?: string,
    to?: string,
    currency?: string,
  ): Promise<DimensionStatVo[]> {
    const range = this.defaultRange(from, to)
    const rows = await this.repository.dimension(userId, field, range.from, range.to, currency)
    return this.mergeDimensionRows(rows)
  }

  private mergeDimensionRows(rows: DimensionRow[]): DimensionStatVo[] {
    const map = new Map<string, DimensionStatVo>()
    for (const row of rows) {
      const key = row.key ?? 'UNKNOWN'
      const entry = map.get(key) ?? { key, label: key, amount: [], orderCount: 0, itemCount: 0 }
      entry.amount = this.groupByCurrency([
        ...entry.amount.map(item => ({ currency: item.currency, amount: item.amount })),
        { currency: row.currency, amount: toNumber(row.amount) ?? 0 },
      ])
      entry.orderCount += Number(row.orderCount)
      entry.itemCount += Number(row.itemCount)
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => (b.amount[0]?.amount ?? 0) - (a.amount[0]?.amount ?? 0))
  }
}

const TODO_STATUSES = [
  'PAYMENT_OVERDUE',
  'WAITING_PAYMENT',
  'WAITING_SHIPMENT',
  'SHIPMENT_EXCEPTION',
]

function isTodoStatus(status: string): boolean {
  return TODO_STATUSES.includes(status)
}

function daysUntil(today: string, date: string): number {
  return Math.round(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / ONE_DAY_MS,
  )
}

function todoPriority(status: string, next: NextPaymentInfo | null, today: string): number {
  if (status === 'PAYMENT_OVERDUE') return 0
  if (status === 'WAITING_PAYMENT') {
    if (!next?.dueAt) return 4
    const days = daysUntil(today, next.dueAt)
    if (days <= 1) return 1
    if (days <= 3) return 2
    if (days <= 7) return 3
    return 4
  }
  if (status === 'SHIPMENT_EXCEPTION') return 5
  if (status === 'WAITING_SHIPMENT') return 6
  return 9
}
