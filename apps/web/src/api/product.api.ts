import type { ProductCategory } from '@hobilog/shared'
import type { PaginatedResult, ProductVo } from '@/types/models'
import { http } from './http'

export interface ProductListParams {
  page?: number
  pageSize?: number
  keyword?: string
  category?: ProductCategory
  ipName?: string
  characterName?: string
  manufacturer?: string
  status?: 'ACTIVE' | 'ARCHIVED'
}

export interface CreateProductPayload {
  name: string
  originalName?: string
  coverUrl?: string
  category?: ProductCategory
  ipName?: string
  characterName?: string
  manufacturer?: string
  seriesName?: string
  scale?: string
  version?: string
  sku?: string
  officialPrice?: number
  officialCurrency?: string
  announcedAt?: string
  originalReleaseDate?: string
  releaseDatePrecision?: 'DAY' | 'MONTH'
  description?: string
  tagNames?: string[]
}

export function getProductList(params: ProductListParams): Promise<PaginatedResult<ProductVo>> {
  return http.get<PaginatedResult<ProductVo>>('/products', { params }).then(res => res.data)
}

export function createProduct(payload: CreateProductPayload): Promise<ProductVo> {
  return http.post<ProductVo>('/products', payload).then(res => res.data)
}

export function getProductDetail(id: string): Promise<ProductVo> {
  return http.get<ProductVo>(`/products/${id}`).then(res => res.data)
}

export function updateProduct(id: string, payload: Partial<CreateProductPayload>): Promise<ProductVo> {
  return http.patch<ProductVo>(`/products/${id}`, payload).then(res => res.data)
}

export function archiveProduct(id: string): Promise<ProductVo> {
  return http.post<ProductVo>(`/products/${id}/archive`).then(res => res.data)
}
