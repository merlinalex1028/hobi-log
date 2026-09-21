import type { PaginatedResult, StoreVo } from '@/types/models'
import { http } from './http'

export interface StoreListParams {
  page?: number
  pageSize?: number
  platformId?: string
  keyword?: string
}

export interface CreateStorePayload {
  name: string
  platformId?: string
  url?: string
  contact?: string
  note?: string
}

export function getStoreList(params: StoreListParams): Promise<PaginatedResult<StoreVo>> {
  return http.get<PaginatedResult<StoreVo>>('/stores', { params }).then(res => res.data)
}

export function createStore(payload: CreateStorePayload): Promise<StoreVo> {
  return http.post<StoreVo>('/stores', payload).then(res => res.data)
}

export function updateStore(id: string, payload: Partial<CreateStorePayload>): Promise<StoreVo> {
  return http.patch<StoreVo>(`/stores/${id}`, payload).then(res => res.data)
}

export function deleteStore(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/stores/${id}`).then(res => res.data)
}
