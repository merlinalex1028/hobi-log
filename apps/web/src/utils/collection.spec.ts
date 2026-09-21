import type { CollectionItemVo } from '@/types/models'
import { describe, expect, it } from 'vitest'
import { collectionTotalQuantity, filterCollectionItems } from './collection'

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

describe('utils/collection', () => {
  it('默认筛选返回全部条目', () => {
    const items = [item(), item({ orderItemId: 'oi2', name: '雷电将军' })]
    expect(filterCollectionItems(items, { keyword: '', onlyDelivered: false })).toHaveLength(2)
  })

  it('关键词按名称大小写不敏感匹配', () => {
    const items = [item({ name: 'Saber Alter' }), item({ orderItemId: 'oi2', name: '芙宁娜' })]
    expect(filterCollectionItems(items, { keyword: 'saber', onlyDelivered: false }).map(i => i.name)).toEqual([
      'Saber Alter',
    ])
  })

  it('关键词前后空格被忽略', () => {
    const items = [item({ name: '芙宁娜' })]
    expect(filterCollectionItems(items, { keyword: '  芙宁娜  ', onlyDelivered: false })).toHaveLength(1)
  })

  it('仅显示已入库时过滤掉没有 deliveredAt 的条目', () => {
    const items = [item(), item({ orderItemId: 'oi2', deliveredAt: null })]
    expect(filterCollectionItems(items, { keyword: '', onlyDelivered: true })).toHaveLength(1)
  })

  it('collectionTotalQuantity 累加 quantity', () => {
    expect(collectionTotalQuantity([item({ quantity: 2 }), item({ orderItemId: 'oi2', quantity: 3 })])).toBe(5)
  })
})
