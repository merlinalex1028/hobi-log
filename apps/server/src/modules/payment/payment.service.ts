import { HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { PrismaService } from '../../database/prisma.service'
import type { OrderDetailVo } from '../order/mapper/order.mapper'
import { OrderService } from '../order/order.service'
import type { CreatePaymentDto } from './dto/create-payment.dto'
import type { MarkPaidDto } from './dto/mark-paid.dto'
import type { RefundPaymentDto } from './dto/refund-payment.dto'
import type { UpdatePaymentDto } from './dto/update-payment.dto'

const REFUND_TYPE = 'REFUND'
const SUPPLEMENT_SORT_ORDER = 900
const REFUND_SORT_ORDER = 950

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, orderId: string, dto: CreatePaymentDto): Promise<OrderDetailVo> {
    await this.orderService.assertOwned(userId, orderId)
    const maxSort = await this.prisma.payment.aggregate({
      where: { orderId },
      _max: { sortOrder: true },
    })
    await this.prisma.payment.create({
      data: {
        orderId,
        type: dto.type,
        name: dto.name,
        amount: dto.amount ?? null,
        status: dto.status ?? 'PENDING',
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
        paymentMethod: dto.paymentMethod,
        transactionNo: dto.transactionNo,
        note: dto.note,
        sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
    return this.orderService.getDetail(userId, orderId)
  }

  async update(userId: string, id: string, dto: UpdatePaymentDto): Promise<OrderDetailVo> {
    const payment = await this.findOwnedPayment(userId, id)
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : undefined
    const status = dto.status ?? (paidAt && payment.status === 'PENDING' ? 'PAID' : undefined)

    await this.prisma.payment.update({
      where: { id },
      data: {
        type: dto.type,
        name: dto.name,
        amount: dto.amount,
        status,
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        paidAt,
        paymentMethod: dto.paymentMethod,
        transactionNo: dto.transactionNo,
        note: dto.note,
        sortOrder: dto.sortOrder,
      },
    })

    await this.orderService.refreshStatus(userId, payment.orderId)
    return this.orderService.getDetail(userId, payment.orderId)
  }

  async markPaid(userId: string, id: string, dto: MarkPaidDto): Promise<OrderDetailVo> {
    const payment = await this.findOwnedPayment(userId, id)
    if (payment.status !== 'PENDING') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'PAYMENT_NOT_PAYABLE', '当前付款节点不可标记付款')
    }

    const planned = payment.amount === null ? null : Number(payment.amount)
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date()
    const overflow = planned === null ? 0 : Number((dto.paidAmount - planned).toFixed(2))

    await this.prisma.$transaction(async tx => {
      const nextAmount = overflow > 0 ? planned : dto.paidAmount
      const note =
        overflow < 0 && planned !== null
          ? [dto.note, `原计划 ¥${planned}`].filter(Boolean).join('; ')
          : dto.note

      await tx.payment.update({
        where: { id },
        data: {
          status: 'PAID',
          amount: nextAmount,
          paidAt,
          paymentMethod: dto.paymentMethod,
          transactionNo: dto.transactionNo,
          note,
        },
      })

      if (overflow > 0 && dto.createSupplement) {
        await tx.payment.create({
          data: {
            orderId: payment.orderId,
            type: 'SUPPLEMENT',
            name: '补差价',
            amount: overflow,
            currency: payment.currency,
            status: 'PAID',
            paidAt,
            paymentMethod: dto.paymentMethod,
            note: dto.note,
            sortOrder: SUPPLEMENT_SORT_ORDER,
          },
        })
      }
    })

    await this.orderService.refreshStatus(userId, payment.orderId)
    return this.orderService.getDetail(userId, payment.orderId)
  }

  async refund(userId: string, id: string, dto: RefundPaymentDto): Promise<OrderDetailVo> {
    const payment = await this.findOwnedPayment(userId, id)
    if (payment.status !== 'PAID' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'PAYMENT_NOT_REFUNDABLE', '只有已付款节点可以退款')
    }

    const paid = payment.amount === null ? 0 : Number(payment.amount)
    const previousRefunds = await this.prisma.payment.findMany({
      where: { orderId: payment.orderId, type: REFUND_TYPE, status: 'PAID' },
      select: { amount: true },
    })
    const alreadyRefunded = previousRefunds.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)

    await this.prisma.$transaction(async tx => {
      await tx.payment.create({
        data: {
          orderId: payment.orderId,
          type: REFUND_TYPE,
          name: payment.name ? `${payment.name}退款` : '退款',
          amount: dto.amount,
          currency: payment.currency,
          status: 'PAID',
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          paymentMethod: dto.paymentMethod,
          note: dto.note,
          sortOrder: REFUND_SORT_ORDER,
        },
      })

      if (dto.markOriginal && payment.type !== REFUND_TYPE) {
        await tx.payment.update({
          where: { id },
          data: { status: alreadyRefunded + dto.amount >= paid ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        })
      }
    })

    await this.orderService.refreshStatus(userId, payment.orderId)
    return this.orderService.getDetail(userId, payment.orderId)
  }

  private async findOwnedPayment(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, order: { userId } } })
    if (!payment) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'PAYMENT_NOT_FOUND', '付款节点不存在')
    }
    return payment
  }
}
