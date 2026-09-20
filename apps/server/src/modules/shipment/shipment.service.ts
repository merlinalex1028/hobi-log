import { HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { PrismaService } from '../../database/prisma.service'
import type { OrderDetailVo } from '../order/mapper/order.mapper'
import { OrderService } from '../order/order.service'
import type { CreateShipmentDto } from './dto/create-shipment.dto'
import type { DeliverShipmentDto } from './dto/deliver-shipment.dto'
import type { UpdateShipmentDto } from './dto/update-shipment.dto'

@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, orderId: string, dto: CreateShipmentDto): Promise<OrderDetailVo> {
    const order = await this.orderService.findOwnedWithRelations(userId, orderId)
    if (order.status !== 'ACTIVE') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'ORDER_NOT_ACTIVE', '订单已结束，无法添加物流')
    }

    const orderItemIds = new Set(order.items.map(item => item.id))
    for (const item of dto.items) {
      if (!orderItemIds.has(item.orderItemId)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, 'INVALID_SHIPMENT_ITEMS', '物流明细包含不属于该订单的商品')
      }
    }

    const shippedBefore = await this.prisma.shipmentItem.groupBy({
      by: ['orderItemId'],
      where: { orderItemId: { in: [...orderItemIds] }, shipment: { orderId } },
      _sum: { quantity: true },
    })
    const shippedMap = new Map(shippedBefore.map(row => [row.orderItemId, row._sum.quantity ?? 0]))

    const requestedMap = new Map<string, number>()
    for (const item of dto.items) {
      requestedMap.set(item.orderItemId, (requestedMap.get(item.orderItemId) ?? 0) + item.quantity)
    }

    for (const [orderItemId, requested] of requestedMap) {
      const orderItem = order.items.find(item => item.id === orderItemId)
      const limit = orderItem?.quantity ?? 0
      const alreadyShipped = shippedMap.get(orderItemId) ?? 0
      if (alreadyShipped + requested > limit) {
        throw new BusinessException(
          HttpStatus.BAD_REQUEST,
          'SHIPMENT_QUANTITY_EXCEEDED',
          `物流数量超过订单商品数量（上限 ${limit}，已发货 ${alreadyShipped}）`,
        )
      }
    }

    const status = dto.status ?? (dto.trackingNo || dto.shippedAt ? 'SHIPPED' : 'WAITING')

    await this.prisma.$transaction(async tx => {
      const shipment = await tx.shipment.create({
        data: {
          orderId,
          carrier: dto.carrier,
          trackingNo: dto.trackingNo,
          status,
          shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : status === 'SHIPPED' ? new Date() : null,
          estimatedDeliveryAt: dto.estimatedDeliveryAt ? new Date(dto.estimatedDeliveryAt) : null,
          note: dto.note,
        },
        select: { id: true },
      })

      await tx.shipmentItem.createMany({
        data: dto.items.map(item => ({
          shipmentId: shipment.id,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
        })),
      })
    })

    await this.orderService.refreshStatus(userId, orderId)
    return this.orderService.getDetail(userId, orderId)
  }

  async update(userId: string, id: string, dto: UpdateShipmentDto): Promise<OrderDetailVo> {
    const shipment = await this.findOwnedShipment(userId, id)

    await this.prisma.shipment.update({
      where: { id },
      data: {
        carrier: dto.carrier,
        trackingNo: dto.trackingNo,
        status: dto.status,
        shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : undefined,
        estimatedDeliveryAt: dto.estimatedDeliveryAt ? new Date(dto.estimatedDeliveryAt) : undefined,
        note: dto.note,
      },
    })

    await this.orderService.refreshStatus(userId, shipment.orderId)
    return this.orderService.getDetail(userId, shipment.orderId)
  }

  async markDelivered(userId: string, id: string, dto: DeliverShipmentDto): Promise<OrderDetailVo> {
    const shipment = await this.findOwnedShipment(userId, id)
    if (shipment.status !== 'SHIPPED' && shipment.status !== 'IN_TRANSIT') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'SHIPMENT_NOT_DELIVERABLE', '只有已发货/运输中的物流可以标记签收')
    }

    await this.prisma.shipment.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : new Date(),
        note: dto.note ?? shipment.note,
      },
    })

    await this.orderService.refreshStatus(userId, shipment.orderId)
    return this.orderService.getDetail(userId, shipment.orderId)
  }

  private async findOwnedShipment(userId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({ where: { id, order: { userId } } })
    if (!shipment) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'SHIPMENT_NOT_FOUND', '物流记录不存在')
    }
    return shipment
  }
}
