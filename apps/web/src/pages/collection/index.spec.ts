import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CollectionPage from './index.vue'
import { getCollectionList, getCollectionStats } from '@/api/collection.api'
import CollectionFilterBar from '@/components/collection/CollectionFilterBar.vue'
import type { CollectionItemVo } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerMock.push }) }))
vi.mock('@/api/collection.api', () => ({ getCollectionList: vi.fn(), getCollectionStats: vi.fn() }))

const mockedList = vi.mocked(getCollectionList)
const mockedStats = vi.mocked(getCollectionStats)

function item(overrides: Partial<CollectionItemVo> = {}): CollectionItemVo {
  return {
    orderItemId: 'oi1',
    orderId: 'o1',
    productId: 'p1',
    name: '芙宁娜 1/7 手办',
    coverUrl: null,
    quantity: 1,
    purchasePrice: 1299,
    currency: 'CNY',
    purchasedAt: '2026-01-02',
    deliveredAt: '2026-09-10',
    ...overrides,
  }
}

function mountPage() {
  return mount(CollectionPage, {
    global: {
      stubs: { ...elementStubs },
      plugins: [
        createPinia(),
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
  })
}

describe('收藏库 Collection', () => {
  beforeEach(() => {
    routerMock.push.mockReset()
    mockedList.mockReset()
    mockedStats.mockReset()
    mockedList.mockResolvedValue({ items: [item()], total: 1, page: 1, pageSize: 20 })
    mockedStats.mockResolvedValue({
      totalItems: 3,
      deliveredOrders: 2,
      byCurrency: [{ currency: 'CNY', amount: 1299 }],
    })
  })

  it('按分页参数请求列表并展示 stats', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(mockedList).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    expect(mockedStats).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('收藏件数')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('已签收订单')
  })

  it('卡片展示名称 / 数量 / 入库时间 / 购入价', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const card = wrapper.find('.collection-grid__card')
    expect(card.text()).toContain('芙宁娜 1/7 手办')
    expect(card.text()).toContain('2026-09-10')
    expect(card.text()).toContain('¥1,299')
  })

  it('点击卡片跳转订单详情', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.find('.collection-grid__card').trigger('click')
    expect(routerMock.push).toHaveBeenCalledWith('/orders/o1')
  })

  it('空数据展示「还没有已入库的收藏」', async () => {
    mockedList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('还没有已入库的收藏')
  })

  it('关键词筛选作用于当前页', async () => {
    mockedList.mockResolvedValue({
      items: [item(), item({ orderItemId: 'oi2', orderId: 'o2', name: '雷电将军' })],
      total: 2,
      page: 1,
      pageSize: 20,
    })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.findComponent(CollectionFilterBar).vm.$emit('update:modelValue', {
      keyword: '雷电',
      onlyDelivered: false,
    })
    await flushPromises()
    const cards = wrapper.findAll('.collection-grid__card')
    expect(cards).toHaveLength(1)
    expect(cards[0]?.text()).toContain('雷电将军')
  })

  it('筛选后无匹配展示提示并可重置', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.findComponent(CollectionFilterBar).vm.$emit('update:modelValue', {
      keyword: '不存在的商品',
      onlyDelivered: false,
    })
    await flushPromises()
    expect(wrapper.text()).toContain('当前页没有匹配的收藏')
    await wrapper.findComponent(CollectionFilterBar).vm.$emit('reset')
    await flushPromises()
    expect(wrapper.findAll('.collection-grid__card')).toHaveLength(1)
  })
})
