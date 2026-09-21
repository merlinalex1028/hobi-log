import type { CollectionItemVo } from '@/types/models'

export interface CollectionFilterState {
  keyword: string
  onlyDelivered: boolean
}

export const DEFAULT_COLLECTION_FILTER: CollectionFilterState = { keyword: '', onlyDelivered: false }

export function filterCollectionItems(
  items: CollectionItemVo[],
  filter: CollectionFilterState,
): CollectionItemVo[] {
  const keyword = filter.keyword.trim().toLowerCase()
  return items.filter(item => {
    if (filter.onlyDelivered && !item.deliveredAt) return false
    if (keyword === '') return true
    return item.name.toLowerCase().includes(keyword)
  })
}

export function collectionTotalQuantity(items: CollectionItemVo[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}
