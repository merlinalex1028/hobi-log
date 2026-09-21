import type { PaginatedResult, PlatformVo } from '@/types/models'
import { http } from './http'

export interface PlatformListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface CreatePlatformPayload {
  name: string
  logoUrl?: string
  website?: string
  region?: string
  defaultCurrency?: string
  note?: string
}

export function getPlatformList(params: PlatformListParams): Promise<PaginatedResult<PlatformVo>> {
  return http.get<PaginatedResult<PlatformVo>>('/platforms', { params }).then(res => res.data)
}

export function createPlatform(payload: CreatePlatformPayload): Promise<PlatformVo> {
  return http.post<PlatformVo>('/platforms', payload).then(res => res.data)
}

export function createPresets(): Promise<{ created: number }> {
  return http.post<{ created: number }>('/platforms/presets').then(res => res.data)
}

export function updatePlatform(id: string, payload: Partial<CreatePlatformPayload>): Promise<PlatformVo> {
  return http.patch<PlatformVo>(`/platforms/${id}`, payload).then(res => res.data)
}

export function deletePlatform(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/platforms/${id}`).then(res => res.data)
}
