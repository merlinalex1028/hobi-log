import { describe, expect, it } from 'vitest'
import { useOrderForm } from './useOrderForm'

describe('useOrderForm', () => {
  it('自动计算商品金额时 goodsAmount 取商品行合计', () => {
    const { form, goodsAmount, totalAmount } = useOrderForm({
      items: [
        { productId: 'p1', name: 'A', coverUrl: null, quantity: 2, unitPrice: 100 },
        { productId: 'p2', name: 'B', coverUrl: null, quantity: 1, unitPrice: 50 },
      ],
      discountAmount: 20,
      shippingAmount: 10,
    })
    expect(goodsAmount.value).toBe(250)
    expect(form.goodsAmount).toBe(0)
    expect(totalAmount.value).toBe(240)
  })

  it('关闭自动计算时使用手填 goodsAmount', () => {
    const { goodsAmount, totalAmount } = useOrderForm({ autoCalculateGoodsAmount: false, goodsAmount: 999 })
    expect(goodsAmount.value).toBe(999)
    expect(totalAmount.value).toBe(999)
  })

  it('setPaymentMode 按总额生成默认付款节点', () => {
    const { form, setPaymentMode, summary } = useOrderForm({ autoCalculateGoodsAmount: false, goodsAmount: 1299 })
    setPaymentMode('DEPOSIT_BALANCE')
    expect(form.paymentMode).toBe('DEPOSIT_BALANCE')
    expect(form.payments).toEqual([
      { type: 'DEPOSIT', amount: 0, status: 'PENDING' },
      { type: 'BALANCE', amount: 1299, status: 'PENDING' },
    ])
    expect(summary.value.pendingAmount).toBe(1299)
    expect(summary.value.nextPayment?.type).toBe('DEPOSIT')
  })

  it('非法付款模式清空付款节点', () => {
    const { form, setPaymentMode } = useOrderForm()
    setPaymentMode('NOPE')
    expect(form.payments).toEqual([])
  })

  it('校验：无商品、无付款节点时报错', () => {
    const { validate, errors } = useOrderForm()
    expect(validate()).toBe(false)
    expect(errors.value).toEqual(['至少需要一个商品', '至少需要一个付款节点'])
  })

  it('校验：金额为负时报错并带字段名', () => {
    const { form, validate, errors } = useOrderForm({
      items: [{ productId: 'p1', name: 'A', coverUrl: null, quantity: 1, unitPrice: 10 }],
      payments: [{ type: 'FULL', amount: 10, status: 'PENDING' }],
    })
    form.shippingAmount = -1
    expect(validate()).toBe(false)
    expect(errors.value).toEqual(['运费不能为负数'])
  })

  it('校验：定金超过总额只给 warning，不阻塞提交', () => {
    const { form, validate, warnings, errors } = useOrderForm({
      items: [{ productId: 'p1', name: 'A', coverUrl: null, quantity: 1, unitPrice: 10 }],
      payments: [{ type: 'DEPOSIT', amount: 50, status: 'PENDING' }],
    })
    form.paymentMode = 'DEPOSIT_BALANCE'
    expect(validate()).toBe(true)
    expect(errors.value).toEqual([])
    expect(warnings.value).toEqual(['定金已超过订单总额，请确认'])
  })

  it('toPayload 省略空字符串字段，并按需带上预期发售', () => {
    const { form, toPayload } = useOrderForm({
      items: [{ productId: 'p1', name: 'A', coverUrl: null, quantity: 1, unitPrice: 1299 }],
      payments: [{ type: 'FULL', amount: 1299, status: 'PENDING' }],
      platformId: '',
      storeId: 's1',
      orderNo: '',
      note: '',
      useExpectedRelease: true,
      releaseDate: '2027-03',
    })
    form.orderUrl = 'https://example.com/order'
    const payload = toPayload()
    expect(payload.platformId).toBeUndefined()
    expect(payload.orderNo).toBeUndefined()
    expect(payload.note).toBeUndefined()
    expect(payload.storeId).toBe('s1')
    expect(payload.orderUrl).toBe('https://example.com/order')
    expect(payload.goodsAmount).toBe(1299)
    expect(payload.payments).toEqual([{ type: 'FULL', amount: 1299, status: 'PENDING' }])
    expect(payload.expectedRelease).toEqual({ date: '2027-03', precision: 'MONTH' })
  })

  it('toPayload 未开启预期发售时不带 expectedRelease', () => {
    const { toPayload } = useOrderForm({ releaseDate: '2027-03' })
    expect(toPayload().expectedRelease).toBeUndefined()
  })
})
