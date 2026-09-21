import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'
import { z } from 'zod'
import type { CreateOrderPayload, OrderPaymentPayload, UpdateOrderPayload } from '@/api/order.api'
import type { OrderFormModel } from '@/types/forms'
import { calcGoodsAmount, calcTotalAmount, defaultPaymentItemsFor } from '@/utils/order-form'
import type { PaymentFormLike } from '@/utils/payment'
import { usePaymentSummary, type PaymentSummary } from './usePaymentSummary'

export interface OrderFormValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface UseOrderFormReturn {
  form: OrderFormModel
  goodsAmount: ComputedRef<number>
  totalAmount: ComputedRef<number>
  summary: ComputedRef<PaymentSummary>
  errors: Ref<string[]>
  warnings: Ref<string[]>
  setPaymentMode: (mode: string) => void
  toPayload: () => CreateOrderPayload
  toUpdatePayload: () => UpdateOrderPayload
  validate: () => boolean
}

const amountSchema = z.object({
  goodsAmount: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  shippingAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  extraAmount: z.number().nonnegative(),
})

const itemsSchema = z.array(z.unknown()).min(1)
const paymentsSchema = z.array(z.unknown()).min(1)

const AMOUNT_LABELS: Record<string, string> = {
  goodsAmount: '商品金额',
  discountAmount: '优惠金额',
  shippingAmount: '运费',
  taxAmount: '税费',
  extraAmount: '其他费用',
}

export function createDefaultOrderFormModel(): OrderFormModel {
  return {
    items: [],
    platformId: '',
    storeId: '',
    orderNo: '',
    orderUrl: '',
    orderedAt: new Date().toISOString().slice(0, 10),
    currency: 'CNY',
    autoCalculateGoodsAmount: true,
    goodsAmount: 0,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    extraAmount: 0,
    paymentMode: 'FULL',
    payments: [],
    useExpectedRelease: false,
    releaseDate: '',
    releaseDatePrecision: 'MONTH',
    note: '',
  }
}

export function useOrderForm(initial?: Partial<OrderFormModel>): UseOrderFormReturn {
  const form = reactive<OrderFormModel>({ ...createDefaultOrderFormModel(), ...initial })

  const goodsAmount = computed(() =>
    form.autoCalculateGoodsAmount ? calcGoodsAmount(form.items) : form.goodsAmount,
  )

  const totalAmount = computed(() =>
    calcTotalAmount({
      goodsAmount: goodsAmount.value,
      discountAmount: form.discountAmount,
      shippingAmount: form.shippingAmount,
      taxAmount: form.taxAmount,
      extraAmount: form.extraAmount,
    }),
  )

  const paymentLikes = computed<PaymentFormLike[]>(() =>
    form.payments.map((payment, index) => ({
      type: payment.type,
      amount: payment.amount,
      status: payment.status,
      dueAt: payment.dueAt ?? null,
      paidAt: payment.paidAt ?? null,
      sortOrder: index,
    })),
  )

  const summary = usePaymentSummary(paymentLikes, totalAmount)

  const errors = ref<string[]>([])
  const warnings = ref<string[]>([])

  function setPaymentMode(mode: string): void {
    form.paymentMode = mode
    form.payments = defaultPaymentItemsFor(mode, totalAmount.value)
  }

  function validate(): boolean {
    const collected: string[] = []
    const warned: string[] = []

    const amounts = amountSchema.safeParse({
      goodsAmount: goodsAmount.value,
      discountAmount: form.discountAmount,
      shippingAmount: form.shippingAmount,
      taxAmount: form.taxAmount,
      extraAmount: form.extraAmount,
    })
    if (!amounts.success) {
      for (const issue of amounts.error.issues) {
        const key = String(issue.path[0] ?? '')
        collected.push(`${AMOUNT_LABELS[key] ?? '金额'}不能为负数`)
      }
    }

    if (!itemsSchema.safeParse(form.items).success) collected.push('至少需要一个商品')
    if (!paymentsSchema.safeParse(form.payments).success) collected.push('至少需要一个付款节点')

    const deposit = form.payments.find(payment => payment.type === 'DEPOSIT')
    if (typeof deposit?.amount === 'number' && deposit.amount > totalAmount.value) {
      warned.push('定金已超过订单总额，请确认')
    }

    errors.value = collected
    warnings.value = warned
    return collected.length === 0
  }

  function toPayload(): CreateOrderPayload {
    return {
      items: form.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      platformId: form.platformId || undefined,
      storeId: form.storeId || undefined,
      orderNo: form.orderNo || undefined,
      orderUrl: form.orderUrl || undefined,
      orderedAt: form.orderedAt,
      currency: form.currency,
      autoCalculateGoodsAmount: form.autoCalculateGoodsAmount,
      goodsAmount: goodsAmount.value,
      discountAmount: form.discountAmount,
      shippingAmount: form.shippingAmount,
      taxAmount: form.taxAmount,
      extraAmount: form.extraAmount,
      paymentMode: form.paymentMode,
      payments: form.payments.map(
        (payment): OrderPaymentPayload => ({
          type: payment.type,
          name: payment.name,
          amount: payment.amount,
          expectedAt: payment.expectedAt,
          dueAt: payment.dueAt,
          paidAt: payment.paidAt,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          note: payment.note,
        }),
      ),
      expectedRelease:
        form.useExpectedRelease && form.releaseDate
          ? { date: form.releaseDate, precision: form.releaseDatePrecision }
          : undefined,
      note: form.note || undefined,
    }
  }

  function toUpdatePayload(): UpdateOrderPayload {
    const payload = toPayload()
    return {
      platformId: payload.platformId,
      storeId: payload.storeId,
      orderNo: payload.orderNo,
      orderUrl: payload.orderUrl,
      orderedAt: payload.orderedAt,
      currency: payload.currency,
      autoCalculateGoodsAmount: payload.autoCalculateGoodsAmount,
      goodsAmount: payload.goodsAmount,
      discountAmount: payload.discountAmount,
      shippingAmount: payload.shippingAmount,
      taxAmount: payload.taxAmount,
      extraAmount: payload.extraAmount,
      expectedRelease: payload.expectedRelease,
      note: payload.note,
    }
  }

  return { form, goodsAmount, totalAmount, summary, errors, warnings, setPaymentMode, toPayload, toUpdatePayload, validate }
}
