import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IpRanking from './IpRanking.vue'
import type { DimensionStatVo } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

function row(overrides: Partial<DimensionStatVo> = {}): DimensionStatVo {
  return { key: 'k', label: 'k', amount: [], orderCount: 0, itemCount: 0, ...overrides }
}

const rows: DimensionStatVo[] = [
  row({ key: 'a', label: 'Fate', amount: [{ currency: 'CNY', amount: 100 }], orderCount: 1, itemCount: 2 }),
  row({
    key: 'b',
    label: '原神',
    amount: [{ currency: 'CNY', amount: 900 }, { currency: 'JPY', amount: 20000 }],
    orderCount: 3,
    itemCount: 4,
  }),
  row({ key: 'c', label: '高达', amount: [{ currency: 'JPY', amount: 50000 }], orderCount: 1, itemCount: 1 }),
]

describe('IpRanking', () => {
  it('按所选币种金额倒序排名', () => {
    const wrapper = mount(IpRanking, { props: { rows, currency: 'CNY' }, global: { stubs: elementStubs } })
    const names = wrapper.findAll('tbody tr').map(tr => tr.findAll('td')[1]?.text())
    expect(names).toEqual(['原神', 'Fate', '高达'])
    expect(wrapper.findAll('tbody tr')[0]?.findAll('td')[0]?.text()).toBe('1')
  })

  it('每个出现的币种单独成列，缺失补 0', () => {
    const wrapper = mount(IpRanking, { props: { rows, currency: 'CNY' }, global: { stubs: elementStubs } })
    const headers = wrapper.findAll('thead th').map(th => th.text())
    expect(headers).toEqual(['#', 'IP', '订单数', '件数', 'CNY 金额', 'JPY 金额'])
    const fateCells = wrapper.findAll('tbody tr')[1]?.findAll('td')
    expect(fateCells?.[4]?.text()).toBe('¥100')
    expect(fateCells?.[5]?.text()).toBe('¥0')
  })

  it('切换排序币种会改变顺序', () => {
    const cny = mount(IpRanking, { props: { rows, currency: 'CNY' }, global: { stubs: elementStubs } })
    expect(cny.findAll('tbody tr').map(tr => tr.findAll('td')[1]?.text())).toEqual(['原神', 'Fate', '高达'])
    const jpy = mount(IpRanking, { props: { rows, currency: 'JPY' }, global: { stubs: elementStubs } })
    expect(jpy.findAll('tbody tr').map(tr => tr.findAll('td')[1]?.text())).toEqual(['高达', '原神', 'Fate'])
  })

  it('无数据展示空状态', () => {
    const wrapper = mount(IpRanking, { props: { rows: [], currency: 'CNY' }, global: { stubs: elementStubs } })
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('区间内没有 IP 数据')
  })
})
