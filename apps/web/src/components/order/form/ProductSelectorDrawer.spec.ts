import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductSelectorDrawer from './ProductSelectorDrawer.vue'
import type { ProductVo } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

vi.mock('@/api/product.api', () => ({ getProductList: vi.fn() }))

const { getProductList } = await import('@/api/product.api')
const mockedList = vi.mocked(getProductList)

function createProduct(overrides: Partial<ProductVo> = {}): ProductVo {
  return {
    id: 'p1',
    name: '芙宁娜 1/7 手办',
    originalName: null,
    coverUrl: null,
    category: 'SCALE_FIGURE',
    ipName: '原神',
    characterName: '芙宁娜',
    manufacturer: 'Myethos',
    seriesName: null,
    scale: '1/7',
    version: null,
    sku: null,
    officialPrice: 1299,
    officialCurrency: 'CNY',
    announcedAt: null,
    originalReleaseDate: null,
    releaseDatePrecision: null,
    description: null,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tagIds: [],
    ...overrides,
  }
}

function mountDrawer(props: Record<string, unknown> = {}) {
  return mount(ProductSelectorDrawer, {
    props: { modelValue: true, ...props },
    global: {
      stubs: elementStubs,
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }]],
    },
  })
}

describe('ProductSelectorDrawer', () => {
  beforeEach(() => {
    mockedList.mockReset()
    mockedList.mockResolvedValue({
      items: [createProduct(), createProduct({ id: 'p2', name: '可莉 粘土人', officialPrice: null })],
      total: 2,
      page: 1,
      pageSize: 8,
    })
  })

  it('打开时按默认参数拉取商品列表', async () => {
    mountDrawer()
    await flushPromises()
    expect(mockedList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 8,
      keyword: undefined,
      category: undefined,
      manufacturer: undefined,
      status: 'ACTIVE',
    })
  })

  it('渲染商品名与待定价格', async () => {
    const wrapper = mountDrawer()
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('芙宁娜 1/7 手办')
    expect(wrapper.text()).toContain('待定')
  })

  it('勾选商品后确认只 emit 新选中的商品', async () => {
    const wrapper = mountDrawer()
    await flushPromises()
    await wrapper.vm.$nextTick()

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[0]?.setValue(true)
    await wrapper.findAll('button').find(button => button.text().includes('加入订单'))?.trigger('click')

    expect(wrapper.emitted('select')?.[0]?.[0]).toEqual([expect.objectContaining({ id: 'p1' })])
    expect(wrapper.emitted('select')?.[0]?.[0]).toHaveLength(1)
  })

  it('已加入订单的商品禁用勾选', async () => {
    const wrapper = mountDrawer({ selectedIds: ['p1'] })
    await flushPromises()
    await wrapper.vm.$nextTick()
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes[0]?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('已加入')
  })

  it('未选择商品时确认按钮禁用', async () => {
    const wrapper = mountDrawer()
    await flushPromises()
    await wrapper.vm.$nextTick()
    const confirm = wrapper.findAll('button').find(button => button.text().includes('加入订单'))
    expect(confirm?.attributes('disabled')).toBeDefined()
  })

  it('点击快速创建 emit create', async () => {
    const wrapper = mountDrawer()
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === '快速创建')?.trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })
})
