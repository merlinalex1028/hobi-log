import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import ProductCard from './ProductCard.vue'
import type { ProductVo } from '@/types/models'

const ElButtonStub = defineComponent({
  emits: ['click'],
  setup: (_, { slots, emit }) => () => h('button', { onClick: (event: Event) => emit('click', event) }, slots.default?.()),
})

const stubs = { ElButton: ElButtonStub }

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

describe('ProductCard', () => {
  it('展示名称、中文分类、厂商、IP、角色与官方价格', () => {
    const wrapper = mount(ProductCard, { props: { product: createProduct() }, global: { stubs } })
    const text = wrapper.text()
    expect(text).toContain('芙宁娜 1/7 手办')
    expect(text).toContain('比例手办')
    expect(text).toContain('Myethos')
    expect(text).toContain('原神')
    expect(text).toContain('¥1,299')
  })

  it('官方价格为 null 时显示“待定”', () => {
    const wrapper = mount(ProductCard, {
      props: { product: createProduct({ officialPrice: null }) },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('待定')
  })

  it('点击卡片 emit click(id)', async () => {
    const wrapper = mount(ProductCard, { props: { product: createProduct() }, global: { stubs } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')?.[0]).toEqual(['p1'])
    expect(wrapper.emitted('edit')).toBeUndefined()
  })

  it('点击编辑按钮只 emit edit(id)，不冒泡成 click', async () => {
    const wrapper = mount(ProductCard, { props: { product: createProduct() }, global: { stubs } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('edit')?.[0]).toEqual(['p1'])
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
