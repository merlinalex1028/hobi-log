import { HttpStatus, Injectable } from '@nestjs/common'
import type { OrderStatus, Paginated } from '@hobilog/shared'
import type { Prisma } from '../../generated/prisma/client'
import { BusinessException } from '../../common/exceptions/business.exception'
import { toPaginated } from '../../common/types/paginated'
import { PrismaService } from '../../database/prisma.service'
import { PlatformService } from '../platform/platform.service'
import { ProductService } from '../product/product.service'
import { StoreService } from '../store/store.service'
import { isOrderCompleted } from './domain/shipment'
import type { OrderDomain } from './domain/types'
import type { CancelOrderDto } from './dto/cancel-order.dto'
import type { CreateOrderDto } from './dto/create-order.dto'
import type { OrderTab, QueryOrderDto } from './dto/query-order.dto'
import type { UpdateOrderDto } from './dto/update-order.dto'
import { toOrderDomain, type OrderWithRelations } from './mapper/order-domain.mapper'
import {
  toOrderDetailVo,
  toOrderListItemVo,
  type OrderDetailVo,
  type OrderListItemVo,
} from './mapper/order.mapper'


export const ORDER_INCLUDE = {
  items: { include: { product: true } },
  payments: true,
  releaseEvents: true,
  shipments: { include: { items: true } },
  orderEvents: true,
  attachments: true,
  platform: true,
  store: true,
} satisfies Prisma.OrderInclude

const RELEASED_EVENT_TYPES = ['RELEASED', 'STORE_ARRIVED', 'SHIPMENT_READY'] as const
const SHIPPED_SHIPMENT_STATUSES = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'] as const

export function buildTabWhere(tab: OrderTab, today: string): Prisma.OrderWhereInput {
  const map: Record<OrderTab, Prisma.OrderWhereInput> = {
    ALL: { archived: false },
    ARCHIVED: { archived: true },
    WAITING_PAYMENT: { status: 'ACTIVE', payments: { some: { status: 'PENDING' } } },
    PAYMENT_OVERDUE: {
      status: 'ACTIVE',
      payments: { some: { status: 'PENDING', dueAt: { lt: new Date(`${today}T00:00:00.000Z`) } } },
    },
    WAITING_RELEASE: {
      status: 'ACTIVE',
      payments: { none: { status: 'PENDING' } },
      releaseEvents: { none: { type: { in: [...RELEASED_EVENT_TYPES] } } },
    },
    WAITING_SHIPMENT: {
      status: 'ACTIVE',
      payments: { none: { status: 'PENDING' } },
      releaseEvents: { some: { type: { in: [...RELEASED_EVENT_TYPES] } } },
      shipments: { none: { status: { in: [...SHIPPED_SHIPMENT_STATUSES] } } },
    },
    IN_TRANSIT: { shipments: { some: { status: { in: ['SHIPPED', 'IN_TRANSIT'] } } } },
    SHIPMENT_EXCEPTION: { shipments: { some: { status: 'EXCEPTION' } } },
    COMPLETED: { status: 'COMPLETED' },
    CANCELLED: { status: 'CANCELLED' },
    REFUNDED: { status: 'REFUNDED' },
  }
  return map[tab]
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly platformService: PlatformService,
    private readonly storeService: StoreService,
  ) {}

  today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  async create(userId: string, dto: CreateOrderDto): Promise<OrderDetailVo> {
    const productIds = [...new Set(dto.items.map(item => item.productId))]
    const owned = await this.productService.getOwnedProductIds(userId, productIds)
    if (owned.length !== productIds.length) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'INVALID_PRODUCTS', '商品不存在或不属于当前用户')
    }
    if (dto.platformId) await this.platformService.assertOwned(userId, dto.platformId)
    if (dto.storeId) await this.storeService.assertOwned(userId, dto.storeId)

    const items = dto.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: Number((item.unitPrice * item.quantity).toFixed(2)),
      note: item.note,
    }))

    const goodsAmount = dto.autoCalculateGoodsAmount
      ? Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
      : dto.goodsAmount
    const totalAmount = Number(
      (goodsAmount - dto.discountAmount + dto.shippingAmount + dto.taxAmount + dto.extraAmount).toFixed(2),
    )

    const orderId = await this.prisma.$transaction(async tx => {
      const order = await tx.order.create({
        data: {
          userId,
          platformId: dto.platformId ?? null,
          storeId: dto.storeId ?? null,
          orderNo: dto.orderNo,
          orderUrl: dto.orderUrl,
          orderedAt: new Date(`${dto.orderedAt.slice(0, 10)}T00:00:00.000Z`),
          currency: dto.currency,
          goodsAmount,
          discountAmount: dto.discountAmount,
          shippingAmount: dto.shippingAmount,
          taxAmount: dto.taxAmount,
          extraAmount: dto.extraAmount,
          totalAmount,
          paymentMode: dto.paymentMode,
          note: dto.note,
        },
        select: { id: true },
      })

      await tx.orderItem.createMany({ data: items.map(item => ({ orderId: order.id, ...item })) })

      await tx.payment.createMany({
        data: dto.payments.map((payment, index) => ({
          orderId: order.id,
          type: payment.type,
          name: payment.name,
          amount: payment.amount ?? null,
          currency: dto.currency,
          status: payment.status ?? 'PENDING',
          expectedAt: payment.expectedAt ? new Date(payment.expectedAt) : null,
          dueAt: payment.dueAt ? new Date(payment.dueAt) : null,
          paidAt: payment.paidAt ? new Date(payment.paidAt) : null,
          paymentMethod: payment.paymentMethod,
          transactionNo: payment.transactionNo,
          note: payment.note,
          sortOrder: index,
        })),
      })

      if (dto.expectedRelease) {
        await tx.releaseEvent.create({
          data: {
            orderId: order.id,
            type: 'EXPECTED_RELEASE',
            newDate: new Date(`${dto.expectedRelease.date.slice(0, 10)}T00:00:00.000Z`),
            datePrecision: dto.expectedRelease.precision ?? 'MONTH',
          },
        })
      }

      await tx.orderEvent.create({
        data: { orderId: order.id, type: 'ORDER_CREATED', title: '创建订单' },
      })

      return order.id
    })

    return this.getDetail(userId, orderId)
  }

  async list(userId: string, query: QueryOrderDto): Promise<Paginated<OrderListItemVo>> {
    const where: Prisma.OrderWhereInput = {
      userId,
      ...buildTabWhere(query.tab, this.today()),
      ...(query.status ? { status: query.status } : {}),
      ...(query.platformId ? { platformId: query.platformId } : {}),
      ...(query.storeId ? { storeId: query.storeId } : {}),
      ...(query.year
        ? {
            orderedAt: {
              gte: new Date(`${query.year}-01-01T00:00:00.000Z`),
              lt: new Date(`${query.year + 1}-01-01T00:00:00.000Z`),
            },
          }
        : {}),
      ...(query.priceMin !== undefined || query.priceMax !== undefined
        ? {
            totalAmount: {
              ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
              ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
            },
          }
        : {}),
      ...(query.manufacturer || query.ipName || query.characterName || query.category
        ? {
            items: {
              some: {
                product: {
                  ...(query.manufacturer ? { manufacturer: query.manufacturer } : {}),
                  ...(query.ipName ? { ipName: query.ipName } : {}),
                  ...(query.characterName ? { characterName: query.characterName } : {}),
                  ...(query.category ? { category: query.category } : {}),
                },
              },
            },
          }
        : {}),
      ...(query.delayed ? { releaseEvents: { some: { type: 'DELAY' } } } : {}),
      ...(query.keyword
        ? {
            OR: [
              { orderNo: { contains: query.keyword, mode: 'insensitive' as const } },
              { items: { some: { product: { name: { contains: query.keyword, mode: 'insensitive' as const } } } } },
            ],
          }
        : {}),
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: [{ orderedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ])

    const today = this.today()
    return toPaginated(rows.map(row => toOrderListItemVo(row, today)), total, query.page, query.pageSize)
  }

  async getDetail(userId: string, id: string): Promise<OrderDetailVo> {
    const order = await this.findOwnedWithRelations(userId, id)
    return toOrderDetailVo(order, this.today())
  }

  async update(userId: string, id: string, dto: UpdateOrderDto): Promise<OrderDetailVo> {
    await this.assertOwned(userId, id)
    await this.prisma.order.update({
      where: { id },
      data: {
        platformId: dto.platformId,
        storeId: dto.storeId,
        orderNo: dto.orderNo,
        orderUrl: dto.orderUrl,
        orderedAt: dto.orderedAt ? new Date(`${dto.orderedAt.slice(0, 10)}T00:00:00.000Z`) : undefined,
        currency: dto.currency,
        goodsAmount: dto.goodsAmount,
        discountAmount: dto.discountAmount,
        shippingAmount: dto.shippingAmount,
        taxAmount: dto.taxAmount,
        extraAmount: dto.extraAmount,
        note: dto.note,
        paymentMode: dto.paymentMode,
      },
    })
    return this.getDetail(userId, id)
  }

  async cancel(userId: string, id: string, dto: CancelOrderDto): Promise<OrderDetailVo> {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, select: { status: true } })
    if (!order) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', '订单不存在')
    }
    if (order.status !== 'ACTIVE') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'ORDER_NOT_CANCELLABLE', '只有进行中的订单可以取消')
    }

    await this.prisma.$transaction(async tx => {
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } })
      await tx.payment.updateMany({ where: { orderId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } })

      if (dto.refund) {
        const paid = await tx.payment.findMany({
          where: { orderId: id, status: 'PAID', type: { not: 'REFUND' } },
          select: { amount: true },
        })
        const refundTotal = Number(paid.reduce((sum, item) => sum + Number(item.amount ?? 0), 0).toFixed(2))
        if (refundTotal > 0) {
          await tx.payment.create({
            data: {
              orderId: id,
              type: 'REFUND',
              name: '取消订单退款',
              amount: refundTotal,
              status: 'PAID',
              paidAt: new Date(),
              note: dto.note,
              sortOrder: 999,
            },
          })
        }
      }

      await tx.orderEvent.create({
        data: { orderId: id, type: 'ORDER_CANCELLED', title: '取消订单', description: dto.note ?? null },
      })
    })

    return this.getDetail(userId, id)
  }

  async refreshStatus(userId: string, orderId: string): Promise<OrderStatus> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payments: true, shipments: true, releaseEvents: true },
    })
    if (!order) return 'ACTIVE'
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') return order.status

    const domain = toOrderDomain(order)
    const next: OrderStatus = isOrderCompleted(domain, this.today()) ? 'COMPLETED' : 'ACTIVE'
    if (next !== order.status) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: next } })
    }
    return next
  }

  async assertOwned(userId: string, orderId: string): Promise<void> {
    const count = await this.prisma.order.count({ where: { id: orderId, userId } })
    if (count === 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', '订单不存在')
    }
  }

  async findOwnedWithRelations(userId: string, orderId: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, include: ORDER_INCLUDE })
    if (!order) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', '订单不存在')
    }
    return order
  }

  toDomain(order: OrderWithRelations): OrderDomain {
    return toOrderDomain(order)
  }
}
