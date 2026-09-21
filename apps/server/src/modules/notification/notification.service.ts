import { Injectable } from '@nestjs/common'
import { REMINDER_OFFSET_DAYS } from '@hobilog/shared'
import { toNumber } from '../../common/utils/serialize'
import { PrismaService } from '../../database/prisma.service'
import { getDelayMonths, getPlannedReleaseDate, isReleased } from '../order/domain/release'
import { toOrderDomain } from '../order/mapper/order-domain.mapper'
import { ORDER_INCLUDE } from '../order/order.service'
import type { ReminderVo } from './mapper/notification.mapper'

const ONE_DAY_MS = 86_400_000
const STALE_DAYS = 30
const ORDER_LIMIT = 200
const PRIORITY = {
  paymentOverdue: 0,
  dueToday: 1,
  dueIn1Day: 2,
  dueIn3Days: 3,
  dueIn7Days: 4,
  releaseThisMonth: 5,
  releaseDelayed: 6,
  staleOrder: 9,
}

type ReminderOffset = (typeof REMINDER_OFFSET_DAYS)[number]

function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / ONE_DAY_MS)
}

function dueSoonPriority(daysLeft: number): number {
  if (daysLeft === 0) return PRIORITY.dueToday
  if (daysLeft === 1) return PRIORITY.dueIn1Day
  if (daysLeft === 3) return PRIORITY.dueIn3Days
  return PRIORITY.dueIn7Days
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodos(userId: string): Promise<ReminderVo[]> {
    const today = new Date().toISOString().slice(0, 10)
    const monthPrefix = today.slice(0, 7)
    const staleThreshold = new Date(Date.now() - STALE_DAYS * ONE_DAY_MS)

    const orders = await this.prisma.order.findMany({
      where: { userId, archived: false, status: 'ACTIVE' },
      include: ORDER_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: ORDER_LIMIT,
    })

    const reminders: ReminderVo[] = []

    for (const order of orders) {
      const title = order.items[0]?.product.name ?? order.orderNo ?? '订单'
      const domain = toOrderDomain(order)

      for (const payment of order.payments) {
        if (payment.status !== 'PENDING' || !payment.dueAt) continue
        const dueAt = payment.dueAt.toISOString().slice(0, 10)
        const daysLeft = diffDays(today, dueAt)
        const amount = toNumber(payment.amount)
        const paymentTitle = `${title} · ${payment.name ?? payment.type}`

        if (daysLeft < 0) {
          reminders.push({
            id: `payment-overdue:${payment.id}`,
            kind: 'PAYMENT_OVERDUE',
            orderId: order.id,
            title: paymentTitle,
            dueAt,
            daysLeft,
            overdueDays: Math.abs(daysLeft),
            amount,
            currency: payment.currency,
            priority: PRIORITY.paymentOverdue,
          })
          continue
        }

        if (REMINDER_OFFSET_DAYS.includes(daysLeft as ReminderOffset)) {
          reminders.push({
            id: `payment-soon:${payment.id}`,
            kind: 'PAYMENT_DUE_SOON',
            orderId: order.id,
            title: paymentTitle,
            dueAt,
            daysLeft,
            overdueDays: null,
            amount,
            currency: payment.currency,
            priority: dueSoonPriority(daysLeft),
          })
        }
      }

      const planned = getPlannedReleaseDate(domain.releaseEvents)
      if (planned && planned.date.startsWith(monthPrefix)) {
        reminders.push({
          id: `release-month:${order.id}`,
          kind: 'RELEASE_THIS_MONTH',
          orderId: order.id,
          title,
          dueAt: planned.date,
          daysLeft: diffDays(today, planned.date),
          overdueDays: null,
          amount: null,
          currency: null,
          priority: PRIORITY.releaseThisMonth,
        })
      }

      if (getDelayMonths(domain.releaseEvents) > 0 && !isReleased(domain.releaseEvents)) {
        reminders.push({
          id: `release-delayed:${order.id}`,
          kind: 'RELEASE_DELAYED',
          orderId: order.id,
          title,
          dueAt: planned?.date ?? null,
          daysLeft: planned ? diffDays(today, planned.date) : null,
          overdueDays: null,
          amount: null,
          currency: null,
          priority: PRIORITY.releaseDelayed,
        })
      }

      if (order.updatedAt < staleThreshold) {
        reminders.push({
          id: `stale:${order.id}`,
          kind: 'STALE_ORDER',
          orderId: order.id,
          title,
          dueAt: null,
          daysLeft: null,
          overdueDays: null,
          amount: null,
          currency: null,
          priority: PRIORITY.staleOrder,
        })
      }
    }

    return reminders.sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id),
    )
  }
}
