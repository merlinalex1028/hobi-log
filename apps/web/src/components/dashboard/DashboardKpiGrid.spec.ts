import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DashboardKpiGrid from './DashboardKpiGrid.vue'
import type { DashboardVo } from '@/types/models'

const kpis: DashboardVo['kpis'] = {
  pendingPaymentAmount: [{ currency: 'CNY', amount: 500 }],
  upcomingPaymentAmount: [{ currency: 'JPY', amount: 9000 }],
  monthReleaseCount: 2,
  inTransitOrderCount: 1,
  collectionCount: 4,
  totalOrderCount: 7,
}

describe('DashboardKpiGrid', () => {
  it('渲染五张卡片并展示多币种金额', () => {
    const wrapper = mount(DashboardKpiGrid, { props: { kpis } })
    expect(wrapper.findAll('.dashboard-kpi-card')).toHaveLength(5)
    expect(wrapper.text()).toContain('待付款')
    expect(wrapper.text()).toContain('¥500')
    expect(wrapper.text()).toContain('¥9,000')
  })

  it('点击卡片 emit navigate 预设路径', async () => {
    const wrapper = mount(DashboardKpiGrid, { props: { kpis } })
    await wrapper.findAll('.dashboard-kpi-card')[0]?.trigger('click')
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['/orders?tab=WAITING_PAYMENT'])
  })

  it('收藏卡片跳转 /collection', async () => {
    const wrapper = mount(DashboardKpiGrid, { props: { kpis } })
    await wrapper.findAll('.dashboard-kpi-card')[4]?.trigger('click')
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['/collection'])
  })
})
