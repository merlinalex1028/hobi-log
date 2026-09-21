import type { DashboardVo } from '@/types/models'
import { describe, expect, it } from 'vitest'
import { buildDashboardKpis, greetingFor } from './dashboard'

function kpis(overrides: Partial<DashboardVo['kpis']> = {}): DashboardVo['kpis'] {
  return {
    pendingPaymentAmount: [{ currency: 'CNY', amount: 500 }],
    upcomingPaymentAmount: [{ currency: 'CNY', amount: 300 }, { currency: 'JPY', amount: 9000 }],
    monthReleaseCount: 2,
    inTransitOrderCount: 1,
    collectionCount: 4,
    totalOrderCount: 7,
    ...overrides,
  }
}

describe('utils/dashboard', () => {
  it('greetingFor 按时段返回问候语', () => {
    expect(greetingFor(2)).toBe('凌晨好')
    expect(greetingFor(9)).toBe('早上好')
    expect(greetingFor(15)).toBe('下午好')
    expect(greetingFor(22)).toBe('晚上好')
  })

  it('KPI 卡片顺序与跳转目标符合 docs/06 §10', () => {
    expect(buildDashboardKpis(kpis()).map(card => [card.title, card.to])).toEqual([
      ['待付款', '/orders?tab=WAITING_PAYMENT'],
      ['未来 30 天待付', '/orders?tab=WAITING_PAYMENT'],
      ['本月预计出货', '/orders?tab=WAITING_RELEASE'],
      ['运输中', '/orders?tab=IN_TRANSIT'],
      ['收藏总数', '/collection'],
    ])
  })

  it('金额型 KPI 保留多币种数组，不做跨币种求和', () => {
    const cards = buildDashboardKpis(kpis())
    expect(cards[0]?.amounts).toEqual([{ currency: 'CNY', amount: 500 }])
    expect(cards[1]?.amounts).toHaveLength(2)
    expect(cards[0]?.value).toBeUndefined()
  })

  it('计数型 KPI 使用数字 value，收藏卡片带订单总数说明', () => {
    const cards = buildDashboardKpis(kpis())
    expect(cards[2]?.value).toBe(2)
    expect(cards[3]?.value).toBe(1)
    expect(cards[4]?.value).toBe(4)
    expect(cards[4]?.description).toBe('共 7 个订单')
  })
})
