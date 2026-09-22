import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
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
let refreshingSession: Promise<string | null> | null = null

type AuthRequestConfig = InternalAxiosRequestConfig & {
  _hobilogAuthRetry?: boolean
  _hobilogAccessToken?: string
}

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

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshingSession) {
    refreshingSession = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error) return null
        return data.session?.access_token ?? null
      })
      .catch(() => null)
      .finally(() => {
        refreshingSession = null
      })
  }
  return refreshingSession
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

http.interceptors.request.use(async config => {
  const authConfig = config as AuthRequestConfig
  const token = authConfig._hobilogAccessToken ?? (await supabase.auth.getSession()).data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  response => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const apiError = toApiError(error)
    if (apiError.statusCode === 401) {
      const config = error.config as AuthRequestConfig | undefined
      if (config && !config._hobilogAuthRetry) {
        config._hobilogAuthRetry = true
        const token = await refreshAccessToken()
        if (token) {
          config._hobilogAccessToken = token
          config.headers.Authorization = `Bearer ${token}`
          return http.request(config)
        }
      }
      void handleUnauthorized()
    }
    return Promise.reject(apiError)
  },
)
