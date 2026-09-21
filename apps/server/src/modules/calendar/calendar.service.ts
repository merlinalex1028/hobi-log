import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import { toNumber } from '../../common/utils/serialize'
import { PrismaService } from '../../database/prisma.service'
import { getDisplayStatus } from '../order/domain/display-status'
import { toOrderDomain } from '../order/mapper/order-domain.mapper'
import type { OrderWithRelations } from '../order/mapper/order-domain.mapper'
import type { CalendarEventType, CalendarEventVo } from './mapper/calendar.mapper'

const ONE_DAY_MS = 86_400_000
const CALENDAR_PAYMENT_STATUSES = ['PENDING', 'PAID'] as const
const CALENDAR_RELEASE_EVENT_TYPES = ['EXPECTED_RELEASE', 'DELAY', 'RELEASED'] as const

const CALENDAR_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true } } } },
  payments: true,
  releaseEvents: true,
  shipments: true,
} satisfies Prisma.OrderInclude

const EVENT_PRIORITY: Record<CalendarEventType, number> = {
  PAYMENT_DUE: 0,
  DELIVERY: 1,
  EXPECTED_RELEASE: 2,
  RELEASED: 3,
}

const RELEASE_EVENT_TITLES: Record<string, string> = {
  EXPECTED_RELEASE: '预计出货',
  DELAY: '延期后出货',
  RELEASED: '厂商出货',
}

function isWithin(date: Date | null, from: Date, to: Date): date is Date {
  return date !== null && date >= from && date < to
}

function isCalendarPayment(status: string): boolean {
  return CALENDAR_PAYMENT_STATUSES.some(value => value === status)
}

function isCalendarReleaseEvent(type: string): boolean {
  return CALENDAR_RELEASE_EVENT_TYPES.some(value => value === type)
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(userId: string, from: string, to: string): Promise<CalendarEventVo[]> {
    const fromDate = new Date(`${from.slice(0, 10)}T00:00:00.000Z`)
    const toDate = new Date(new Date(`${to.slice(0, 10)}T00:00:00.000Z`).getTime() + ONE_DAY_MS)

    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        archived: false,
        OR: [
          { payments: { some: { dueAt: { gte: fromDate, lt: toDate } } } },
          { releaseEvents: { some: { newDate: { gte: fromDate, lt: toDate } } } },
          { shipments: { some: { shippedAt: { gte: fromDate, lt: toDate } } } },
          { shipments: { some: { estimatedDeliveryAt: { gte: fromDate, lt: toDate } } } },
          { shipments: { some: { deliveredAt: { gte: fromDate, lt: toDate } } } },
        ],
      },
      include: CALENDAR_INCLUDE,
    })

    const today = new Date().toISOString().slice(0, 10)
    const events: CalendarEventVo[] = []

    for (const order of orders) {
      const displayStatus = getDisplayStatus(toOrderDomain(order), today)
      const orderTitle = order.items[0]?.product.name ?? order.orderNo ?? '订单'

      for (const payment of order.payments) {
        if (!isCalendarPayment(payment.status)) continue
        if (!isWithin(payment.dueAt, fromDate, toDate)) continue
        events.push({
          id: `payment:${payment.id}`,
          type: 'PAYMENT_DUE',
          date: payment.dueAt.toISOString().slice(0, 10),
          orderId: order.id,
          title: `${orderTitle} · ${payment.name ?? payment.type}`,
          amount: toNumber(payment.amount),
          currency: payment.currency,
          precision: 'DAY',
          displayStatus,
        })
      }

      for (const event of order.releaseEvents) {
        if (!isCalendarReleaseEvent(event.type)) continue
        if (!isWithin(event.newDate, fromDate, toDate)) continue
        events.push({
          id: `release:${event.id}`,
          type: event.type === 'RELEASED' ? 'RELEASED' : 'EXPECTED_RELEASE',
          date: event.newDate.toISOString().slice(0, 10),
          orderId: order.id,
          title: `${orderTitle} · ${RELEASE_EVENT_TITLES[event.type] ?? '预计出货'}`,
          amount: null,
          currency: null,
          precision: event.datePrecision,
          displayStatus,
        })
      }

      for (const shipment of order.shipments) {
        const deliveryDate = shipment.deliveredAt ?? shipment.estimatedDeliveryAt
        if (!isWithin(deliveryDate, fromDate, toDate)) continue
        events.push({
          id: `delivery:${shipment.id}`,
          type: 'DELIVERY',
          date: deliveryDate.toISOString().slice(0, 10),
          orderId: order.id,
          title: `${orderTitle} · ${shipment.deliveredAt ? '已签收' : '预计到货'}`,
          amount: null,
          currency: null,
          precision: 'DAY',
          displayStatus,
        })
      }
    }

    return events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      if (EVENT_PRIORITY[a.type] !== EVENT_PRIORITY[b.type]) {
        return EVENT_PRIORITY[a.type] - EVENT_PRIORITY[b.type]
      }
      return a.id.localeCompare(b.id)
    })
  }
}
