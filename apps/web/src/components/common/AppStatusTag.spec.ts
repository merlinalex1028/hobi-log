import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppStatusTag from './AppStatusTag.vue'

const stubs = {
  'el-tag': { template: '<span :data-type="type" :data-size="size"><slot /></span>', props: ['type', 'size'] },
}

describe('AppStatusTag', () => {
  it('渲染 displayStatus 中文文案', () => {
    const wrapper = mount(AppStatusTag, { props: { status: 'WAITING_PAYMENT' }, global: { stubs } })
    expect(wrapper.text()).toContain('待付款')
  })

  it('PAYMENT_OVERDUE 使用 danger 色调', () => {
    const wrapper = mount(AppStatusTag, { props: { status: 'PAYMENT_OVERDUE' }, global: { stubs } })
    expect(wrapper.find('[data-type]').attributes('data-type')).toBe('danger')
  })

  it('WAITING_RELEASE 使用 primary 色调', () => {
    const wrapper = mount(AppStatusTag, { props: { status: 'WAITING_RELEASE' }, global: { stubs } })
    expect(wrapper.find('[data-type]').attributes('data-type')).toBe('primary')
  })

  it('未知状态回退为原值', () => {
    const wrapper = mount(AppStatusTag, { props: { status: 'SOMETHING_NEW' }, global: { stubs } })
    expect(wrapper.text()).toContain('SOMETHING_NEW')
  })

  it('label 覆盖默认文案', () => {
    const wrapper = mount(AppStatusTag, {
      props: { status: 'WAITING_PAYMENT', label: '待补尾款' },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('待补尾款')
  })

  it('size 透传给 el-tag', () => {
    const wrapper = mount(AppStatusTag, { props: { status: 'ACTIVE', size: 'small' }, global: { stubs } })
    expect(wrapper.find('[data-size]').attributes('data-size')).toBe('small')
  })
})
