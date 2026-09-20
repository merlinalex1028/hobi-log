import { HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { PrismaService } from '../../database/prisma.service'
import { getPlannedReleaseDate } from '../order/domain/release'
import type { OrderDetailVo } from '../order/mapper/order.mapper'
import { OrderService } from '../order/order.service'
import type { BalanceOpenDto } from './dto/balance-open.dto'
import type { DelayReleaseDto } from './dto/delay-release.dto'
import type { ReleaseEventDto } from './dto/release-event.dto'

const DELAYABLE_RELEASED_EVENT_TYPES = ['RELEASED', 'STORE_ARRIVED', 'SHIPMENT_READY']

@Injectable()
export class ReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async delay(userId: string, orderId: string, dto: DelayReleaseDto): Promise<OrderDetailVo> {
    const order = await this.orderService.findOwnedWithRelations(userId, orderId)
    const domain = this.orderService.toDomain(order)

    if (order.status !== 'ACTIVE') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'RELEASE_NOT_DELAYABLE', '只有进行中的订单可以修改出货时间')
    }
    if (order.releaseEvents.some(event => DELAYABLE_RELEASED_EVENT_TYPES.includes(event.type))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'RELEASE_NOT_DELAYABLE', '已厂商出货的订单不能再延期')
    }

    const planned = getPlannedReleaseDate(domain.releaseEvents)
    const oldDate = dto.oldDate ?? planned?.date ?? null

    await this.prisma.$transaction(async tx => {
      await tx.releaseEvent.create({
        data: {
          orderId,
          type: 'DELAY',
          oldDate: oldDate ? new Date(`${oldDate.slice(0, 10)}T00:00:00.000Z`) : null,
          newDate: new Date(`${dto.newDate.slice(0, 10)}T00:00:00.000Z`),
          datePrecision: dto.precision ?? planned?.precision ?? 'MONTH',
          source: dto.source,
          sourceUrl: dto.sourceUrl,
          note: dto.note,
        },
      })
    })

    return this.orderService.getDetail(userId, orderId)
  }

  async markReleased(userId: string, orderId: string, dto: ReleaseEventDto): Promise<OrderDetailVo> {
    return this.createEvent(userId, orderId, 'RELEASED', dto)
  }

  async markStoreArrived(userId: string, orderId: string, dto: ReleaseEventDto): Promise<OrderDetailVo> {
    return this.createEvent(userId, orderId, 'STORE_ARRIVED', dto)
  }

  async openBalance(userId: string, orderId: string, dto: BalanceOpenDto): Promise<OrderDetailVo> {
    const order = await this.orderService.findOwnedWithRelations(userId, orderId)

    const target = dto.paymentId
      ? order.payments.find(payment => payment.id === dto.paymentId)
      : order.payments.find(
          payment =>
            payment.status === 'PENDING' &&
            (dto.paymentType ? payment.type === dto.paymentType : payment.type === 'BALANCE'),
        )

    if (!target) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'BALANCE_NOT_FOUND', '没有可更新的待付款节点')
    }

    await this.prisma.$transaction(async tx => {
      await tx.releaseEvent.create({
        data: {
          orderId,
          type: 'BALANCE_OPEN',
          newDate: dto.dueAt ? new Date(`${dto.dueAt.slice(0, 10)}T00:00:00.000Z`) : null,
          datePrecision: 'DAY',
          note: dto.note,
        },
      })

      await tx.payment.update({
        where: { id: target.id },
        data: {
          expectedAt: dto.expectedAt ? new Date(`${dto.expectedAt.slice(0, 10)}T00:00:00.000Z`) : undefined,
          dueAt: dto.dueAt ? new Date(`${dto.dueAt.slice(0, 10)}T00:00:00.000Z`) : undefined,
        },
      })
    })

    return this.orderService.getDetail(userId, orderId)
  }

  private async createEvent(
    userId: string,
    orderId: string,
    type: 'RELEASED' | 'STORE_ARRIVED',
    dto: ReleaseEventDto,
  ): Promise<OrderDetailVo> {
    const order = await this.orderService.findOwnedWithRelations(userId, orderId)
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'ORDER_NOT_ACTIVE', '订单已结束，无法记录出货事件')
    }

    const occurredAt = dto.date ? new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`) : new Date()

    await this.prisma.releaseEvent.create({
      data: {
        orderId,
        type,
        newDate: occurredAt,
        datePrecision: 'DAY',
        occurredAt,
        source: dto.source,
        sourceUrl: dto.sourceUrl,
        note: dto.note,
      },
    })

    return this.orderService.getDetail(userId, orderId)
  }
}
