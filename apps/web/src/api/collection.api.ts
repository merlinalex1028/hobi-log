import type { CollectionItemVo, CollectionStatsVo, PaginatedResult } from '@/types/models'
import { http } from './http'

export interface CollectionListParams {
  page?: number
  pageSize?: number
}

export function getCollectionList(
  params: CollectionListParams = {},
): Promise<PaginatedResult<CollectionItemVo>> {
  return http.get<PaginatedResult<CollectionItemVo>>('/collection', { params }).then(res => res.data)
}

export function getCollectionStats(): Promise<CollectionStatsVo> {
  return http.get<CollectionStatsVo>('/collection/stats').then(res => res.data)
}
