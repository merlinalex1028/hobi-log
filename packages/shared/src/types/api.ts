export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface PaginationQuery {
  page?: number
  pageSize?: number
}
