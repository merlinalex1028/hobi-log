import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PaymentProgress from './PaymentProgress.vue'
import { ElProgressStub, elementStubs } from '@/test/element-stubs'

function mountProgress(props: Record<string, unknown> = {}) {
  return mount(PaymentProgress, {
    props: { totalAmount: 1299, paidAmount: 300, pendingAmount: 999, currency: 'CNY', ...props },
    global: { stubs: elementStubs },
  })
}

describe('PaymentProgress', () => {
  it('展示已付 / 总额与百分比', () => {
    const wrapper = mountProgress()
    expect(wrapper.text()).toContain('¥300')
    expect(wrapper.text()).toContain('¥1,299')
    expect(wrapper.findComponent(ElProgressStub).props('percentage')).toBe(23)
  })

  it('总额为 0 时不计算百分比', () => {
    const wrapper = mountProgress({ totalAmount: 0, paidAmount: 0, pendingAmount: 0 })
    expect(wrapper.findComponent(ElProgressStub).props('percentage')).toBe(0)
  })

  it('金额待定的下一付款显示“待定”', () => {
    const wrapper = mountProgress({
      nextPayment: {
        id: 'pay2',
        type: 'BALANCE',
        name: null,
        amount: null,
        dueAt: null,
        isOverdue: false,
        overdueDays: 0,
      },
    })
    expect(wrapper.text()).toContain('尾款')
    expect(wrapper.text()).toContain('待定')
  })

  it('逾期时展示逾期天数', () => {
    const wrapper = mountProgress({
      nextPayment: {
        id: 'pay2',
        type: 'DEPOSIT',
        name: '定金',
        amount: 300,
        dueAt: '2026-01-01',
        isOverdue: true,
        overdueDays: 12,
      },
    })
    expect(wrapper.text()).toContain('已逾期 12 天')
  })
})
