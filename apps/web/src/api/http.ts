import axios, { AxiosError } from 'axios'
import type { ApiErrorBody } from '@hobilog/shared'
import { supabase } from '@/lib/supabase'

export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.statusCode = body.statusCode
    this.code = body.code
  }
}

let unauthorizedHandler: (() => void | Promise<void>) | null = null
let handlingUnauthorized = false

export function setUnauthorizedHandler(handler: () => void | Promise<void>): void {
  unauthorizedHandler = handler
}

function toApiError(error: AxiosError<ApiErrorBody>): ApiError {
  const body = error.response?.data
  if (body && typeof body.code === 'string') return new ApiError(body)
  return new ApiError({
    statusCode: error.response?.status ?? 0,
    code: 'NETWORK_ERROR',
    message: error.message || '网络异常，请稍后重试',
  })
}

async function handleUnauthorized(): Promise<void> {
  if (!unauthorizedHandler || handlingUnauthorized) return
  handlingUnauthorized = true
  try {
    await unauthorizedHandler()
  } finally {
    handlingUnauthorized = false
  }
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

http.interceptors.request.use(async config => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  response => response,
  (error: AxiosError<ApiErrorBody>) => {
    const apiError = toApiError(error)
    if (apiError.statusCode === 401) void handleUnauthorized()
    return Promise.reject(apiError)
  },
)
