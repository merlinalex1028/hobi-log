import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PaymentNodeCard from './PaymentNodeCard.vue'
import type { PaymentFormItem } from '@/types/forms'
import { ElButtonStub, ElSwitchStub, elementStubs } from '@/test/element-stubs'

function node(overrides: Partial<PaymentFormItem> = {}): PaymentFormItem {
  return { type: 'DEPOSIT', amount: 300, status: 'PENDING', ...overrides }
}

interface CardProps {
  node?: PaymentFormItem
  index?: number
  count?: number
  readonly?: boolean
  typeOptions?: readonly string[]
}

function mountCard(props: CardProps = {}) {
  return mount(PaymentNodeCard, {
    props: { node: node(), index: 0, count: 2, ...props },
    global: { stubs: elementStubs },
  })
}

describe('PaymentNodeCard', () => {
  it('打开金额待定时把金额置为 null', async () => {
    const wrapper = mountCard()
    await wrapper.findComponent(ElSwitchStub).trigger('click')
    const emitted = wrapper.emitted('update')?.[0]?.[0] as { amount: number | null }
    expect(emitted.amount).toBeNull()
  })

  it('关闭金额待定时把金额置为 0', async () => {
    const wrapper = mountCard({ node: node({ amount: null }) })
    await wrapper.findComponent(ElSwitchStub).trigger('click')
    const emitted = wrapper.emitted('update')?.[0]?.[0] as { amount: number | null }
    expect(emitted.amount).toBe(0)
  })

  it('修改节点名称时保留其它字段', async () => {
    const wrapper = mountCard()
    await wrapper.find('input').setValue('定金（第一批）')
    const emitted = wrapper.emitted('update')?.[0]?.[0] as { name: string; amount: number; type: string }
    expect(emitted.name).toBe('定金（第一批）')
    expect(emitted.amount).toBe(300)
    expect(emitted.type).toBe('DEPOSIT')
  })

  it('第一个节点上移按钮禁用，最后一个节点下移按钮禁用', () => {
    const first = mountCard({ index: 0, count: 2 })
    const buttons = first.findAllComponents(ElButtonStub)
    expect(buttons[0]?.props('disabled')).toBe(true)
    expect(buttons[1]?.props('disabled')).toBe(false)

    const last = mountCard({ index: 1, count: 2 })
    const lastButtons = last.findAllComponents(ElButtonStub)
    expect(lastButtons[0]?.props('disabled')).toBe(false)
    expect(lastButtons[1]?.props('disabled')).toBe(true)
  })

  it('点击下移 emit move(1)，点击复制 emit copy', async () => {
    const wrapper = mountCard({ index: 0, count: 2 })
    const buttons = wrapper.findAllComponents(ElButtonStub)
    await buttons[1]?.trigger('click')
    await buttons[2]?.trigger('click')
    expect(wrapper.emitted('move')?.[0]).toEqual([1])
    expect(wrapper.emitted('copy')).toHaveLength(1)
  })

  it('只读模式不渲染操作按钮', () => {
    const wrapper = mountCard({ readonly: true })
    expect(wrapper.findAllComponents(ElButtonStub)).toHaveLength(0)
  })
})
