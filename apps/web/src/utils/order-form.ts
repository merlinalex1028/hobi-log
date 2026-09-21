import { PAYMENT_MODES } from '@hobilog/shared'
import type { OrderPaymentPayload } from '@/api/order.api'
import type { OrderFormModel, PaymentFormItem } from '@/types/forms'
import type { OrderDetail } from '@/types/models'
import { plannedReleaseOf } from './release'

const DEFAULT_PAYMENT_TYPE: Record<string, string> = {
  FULL: 'FULL',
  DEPOSIT_BALANCE: 'DEPOSIT',
  INSTALLMENT: 'INSTALLMENT',
  CUSTOM: 'OTHER',
}

export function calcGoodsAmount(items: Array<{ unitPrice: number; quantity: number }>): number {
  return Number(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2))
}

export function calcTotalAmount(amounts: {
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
}): number {
  return Number(
    (
      amounts.goodsAmount -
      amounts.discountAmount +
      amounts.shippingAmount +
      amounts.taxAmount +
      amounts.extraAmount
    ).toFixed(2),
  )
}

export function defaultPaymentsFor(mode: string, totalAmount: number): OrderPaymentPayload[] {
  if (!PAYMENT_MODES.includes(mode as (typeof PAYMENT_MODES)[number])) return []
  if (mode === 'FULL') {
    return [{ type: 'FULL', amount: totalAmount, status: 'PENDING' }]
  }
  if (mode === 'DEPOSIT_BALANCE') {
    return [
      { type: 'DEPOSIT', amount: 0, status: 'PENDING' },
      { type: 'BALANCE', amount: totalAmount, status: 'PENDING' },
    ]
  }
  return [{ type: DEFAULT_PAYMENT_TYPE[mode] ?? 'OTHER', amount: totalAmount, status: 'PENDING' }]
}

export function defaultPaymentItemsFor(mode: string, totalAmount: number): PaymentFormItem[] {
  return defaultPaymentsFor(mode, totalAmount).map(payment => ({
    type: payment.type,
    amount: payment.amount ?? null,
    status: payment.status ?? 'PENDING',
  }))
}

export function applyDepositChange(
  payments: PaymentFormItem[],
  index: number,
  totalAmount: number,
): PaymentFormItem[] {
  const changed = payments[index]
  if (!changed) return payments
  if (changed.type === 'DEPOSIT') {
    return payments.map(payment =>
      payment.type === 'BALANCE' && payment.amount !== null
        ? { ...payment, amount: Number((totalAmount - (changed.amount ?? 0)).toFixed(2)) }
        : payment,
    )
  }
  return payments
}

export function toOrderFormModel(detail: OrderDetail): OrderFormModel {
  const plan = plannedReleaseOf(detail.releaseEvents)
  return {
    items: detail.items.map(item => ({
      productId: item.productId,
      name: item.productName,
      coverUrl: item.coverUrl,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    platformId: detail.platformId ?? '',
    storeId: detail.storeId ?? '',
    orderNo: detail.orderNo ?? '',
    orderUrl: detail.orderUrl ?? '',
    orderedAt: detail.orderedAt.slice(0, 10),
    currency: detail.currency,
    autoCalculateGoodsAmount: calcGoodsAmount(detail.items) === detail.goodsAmount,
    goodsAmount: detail.goodsAmount,
    discountAmount: detail.discountAmount,
    shippingAmount: detail.shippingAmount,
    taxAmount: detail.taxAmount,
    extraAmount: detail.extraAmount,
    paymentMode: detail.paymentMode,
    payments: detail.payments.map(payment => ({
      type: payment.type,
      name: payment.name ?? undefined,
      amount: payment.amount,
      status: payment.status === 'PENDING' ? 'PENDING' : 'PAID',
      expectedAt: payment.expectedAt ?? undefined,
      dueAt: payment.dueAt ?? undefined,
      paidAt: payment.paidAt ?? undefined,
      paymentMethod: payment.paymentMethod ?? undefined,
      note: payment.note ?? undefined,
    })),
    useExpectedRelease: plan.date !== null,
    releaseDate: plan.date === null ? '' : plan.date.slice(0, plan.precision === 'MONTH' ? 7 : 10),
    releaseDatePrecision: plan.precision,
    note: detail.note ?? '',
  }
}
