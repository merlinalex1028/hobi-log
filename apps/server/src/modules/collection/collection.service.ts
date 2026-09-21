import { Injectable } from '@nestjs/common'
import type { Paginated } from '@hobilog/shared'
import type { Prisma } from '../../generated/prisma/client'
import { toPaginated } from '../../common/types/paginated'
import { toDateString, toNumber } from '../../common/utils/serialize'
import { PrismaService } from '../../database/prisma.service'
import type { CollectionItemVo, CollectionStatsVo } from './mapper/collection.mapper'

interface ShipmentItemLike {
  shipment: { status: string; deliveredAt: Date | null }
}

function earliestDeliveredAt(shipmentItems: ShipmentItemLike[]): Date | null {
  const timestamps: number[] = []
  for (const item of shipmentItems) {
    if (item.shipment.status !== 'DELIVERED') continue
    if (item.shipment.deliveredAt === null) continue
    timestamps.push(item.shipment.deliveredAt.getTime())
  }
  if (timestamps.length === 0) return null
  return new Date(Math.min(...timestamps))
}

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  private deliveredWhere(userId: string): Prisma.OrderItemWhereInput {
    return {
      order: {
        userId,
        archived: false,
        status: { not: 'CANCELLED' },
        shipments: { some: { status: 'DELIVERED' } },
      },
    }
  }

  async list(userId: string, page: number, pageSize: number): Promise<Paginated<CollectionItemVo>> {
    const where = this.deliveredWhere(userId)

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.orderItem.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, coverUrl: true } },
          order: { select: { id: true, orderedAt: true, currency: true } },
          shipmentItems: {
            select: {
              shipment: { select: { status: true, deliveredAt: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.orderItem.count({ where }),
    ])

    const items: CollectionItemVo[] = rows.map(row => ({
      orderItemId: row.id,
      orderId: row.order.id,
      productId: row.product.id,
      name: row.product.name,
      coverUrl: row.product.coverUrl,
      quantity: row.quantity,
      purchasePrice: toNumber(row.subtotal) ?? 0,
      currency: row.order.currency,
      purchasedAt: row.order.orderedAt.toISOString().slice(0, 10),
      deliveredAt: toDateString(earliestDeliveredAt(row.shipmentItems)),
    }))

    return toPaginated(items, total, page, pageSize)
  }

  async stats(userId: string): Promise<CollectionStatsVo> {
    const rows = await this.prisma.orderItem.findMany({
      where: this.deliveredWhere(userId),
      select: { quantity: true, subtotal: true, order: { select: { currency: true } } },
    })

    const amounts = new Map<string, number>()
    let totalItems = 0
    for (const row of rows) {
      totalItems += row.quantity
      const current = amounts.get(row.order.currency) ?? 0
      amounts.set(row.order.currency, Number((current + (toNumber(row.subtotal) ?? 0)).toFixed(2)))
    }

    const deliveredOrders = await this.prisma.order.count({
      where: {
        userId,
        archived: false,
        status: { not: 'CANCELLED' },
        shipments: { some: { status: 'DELIVERED' } },
      },
    })

    return {
      totalItems,
      deliveredOrders,
      byCurrency: [...amounts.entries()]
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    }
  }
}
