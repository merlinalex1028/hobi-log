import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PaymentSection from './PaymentSection.vue'
import PaymentModeSelector from './PaymentModeSelector.vue'
import PaymentNodeCard from './PaymentNodeCard.vue'
import type { OrderFormModel, PaymentFormItem } from '@/types/forms'
import { elementStubs } from '@/test/element-stubs'

function createForm(payments: PaymentFormItem[], paymentMode = 'FULL'): OrderFormModel {
  return {
    items: [{ productId: 'p1', name: '芙宁娜 1/7', coverUrl: null, quantity: 1, unitPrice: 1299 }],
    platformId: '',
    storeId: '',
    orderNo: '',
    orderUrl: '',
    orderedAt: '2026-01-02',
    currency: 'CNY',
    autoCalculateGoodsAmount: true,
    goodsAmount: 0,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    extraAmount: 0,
    paymentMode,
    payments,
    useExpectedRelease: false,
    releaseDate: '',
    releaseDatePrecision: 'MONTH',
    note: '',
  }
}

function mountSection(payments: PaymentFormItem[], totalAmount = 1299, paymentMode = 'FULL', mode: 'create' | 'edit' = 'create') {
  return mount(PaymentSection, {
    props: { modelValue: createForm(payments, paymentMode), totalAmount, mode },
    global: { stubs: elementStubs },
  })
}

describe('PaymentSection', () => {
  it('切换付款模式时按总额生成默认节点', async () => {
    const wrapper = mountSection([{ type: 'FULL', amount: 1299, status: 'PENDING' }])
    await wrapper.findComponent(PaymentModeSelector).vm.$emit('update:modelValue', 'DEPOSIT_BALANCE')
    const payload = wrapper.emitted('change')?.[0]?.[0] as { paymentMode: string; payments: PaymentFormItem[] }
    expect(payload.paymentMode).toBe('DEPOSIT_BALANCE')
    expect(payload.payments).toEqual([
      { type: 'DEPOSIT', amount: 0, status: 'PENDING' },
      { type: 'BALANCE', amount: 1299, status: 'PENDING' },
    ])
  })

  it('修改定金后尾款自动重算为总额减去定金', async () => {
    const payments: PaymentFormItem[] = [
      { type: 'DEPOSIT', amount: 300, status: 'PENDING' },
      { type: 'BALANCE', amount: 999, status: 'PENDING' },
    ]
    const wrapper = mountSection(payments, 1299, 'DEPOSIT_BALANCE')
    await wrapper.findComponent(PaymentNodeCard).vm.$emit('update', { ...payments[0], amount: 500 })
    const payload = wrapper.emitted('change')?.[0]?.[0] as { payments: PaymentFormItem[] }
    expect(payload.payments[0]?.amount).toBe(500)
    expect(payload.payments[1]?.amount).toBe(799)
  })

  it('只剩一个节点时删除被忽略', async () => {
    const wrapper = mountSection([{ type: 'FULL', amount: 1299, status: 'PENDING' }])
    await wrapper.findComponent(PaymentNodeCard).vm.$emit('remove')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('多阶段模式下复制节点会在其后插入待付款副本', async () => {
    const payments: PaymentFormItem[] = [
      { type: 'INSTALLMENT', name: '第一期', amount: 400, status: 'PAID' },
      { type: 'INSTALLMENT', name: '第二期', amount: 400, status: 'PENDING' },
    ]
    const wrapper = mountSection(payments, 800, 'INSTALLMENT')
    await wrapper.findComponent(PaymentNodeCard).vm.$emit('copy')
    const payload = wrapper.emitted('change')?.[0]?.[0] as { payments: PaymentFormItem[] }
    expect(payload.payments).toHaveLength(3)
    expect(payload.payments[1]).toMatchObject({ name: '第一期', status: 'PENDING' })
  })

  it('多阶段模式提供添加节点按钮，编辑模式不提供', () => {
    const editable = mountSection([{ type: 'INSTALLMENT', amount: 800, status: 'PENDING' }], 800, 'INSTALLMENT')
    expect(editable.findAll('button').some(button => button.text().includes('添加付款节点'))).toBe(true)

    const readonly = mountSection(
      [{ type: 'INSTALLMENT', amount: 800, status: 'PENDING' }],
      800,
      'INSTALLMENT',
      'edit',
    )
    expect(readonly.findAll('button').some(button => button.text().includes('添加付款节点'))).toBe(false)
  })

  it('节点合计不等于总额时展示提示', () => {
    const wrapper = mountSection([{ type: 'FULL', amount: 1000, status: 'PENDING' }], 1299)
    expect(wrapper.find('.el-alert').exists()).toBe(true)
  })
})
