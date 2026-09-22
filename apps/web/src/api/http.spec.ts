import { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-abc' } } }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-refreshed' } }, error: null }),
    },
  },
}))

import { supabase } from '@/lib/supabase'
import { ApiError, http, setUnauthorizedHandler } from './http'

const originalAdapter = http.defaults.adapter

afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'token-abc' } },
  } as never)
  vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
    data: { session: { access_token: 'token-refreshed' } },
    error: null,
  } as never)
})

function stubAdapter(handler: (config: AxiosRequestConfig) => unknown): void {
  http.defaults.adapter = (async (config: AxiosRequestConfig) => {
    const data = handler(config)
    if (data instanceof Error) throw data
    return { data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse
  }) as never
}

describe('ApiError', () => {
  it('保留 statusCode / code / message', () => {
    const error = new ApiError({ statusCode: 404, code: 'ORDER_NOT_FOUND', message: '订单不存在' })
    expect(error.statusCode).toBe(404)
    expect(error.code).toBe('ORDER_NOT_FOUND')
    expect(error.message).toBe('订单不存在')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('http', () => {
  it('注入 Authorization: Bearer <access_token>', async () => {
    const captured: AxiosRequestConfig[] = []
    stubAdapter(config => {
      captured.push(config)
      return { ok: true }
    })

    await http.get('/orders')

    const headers = captured[0]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-abc')
  })

  it('无 session 时不注入 Authorization', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never)
    const captured: AxiosRequestConfig[] = []
    stubAdapter(config => {
      captured.push(config)
      return { ok: true }
    })

    await http.get('/orders')

    const headers = captured[0]?.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('错误体解析为 ApiError', async () => {
    stubAdapter(() => {
      const response = {
        data: { statusCode: 409, code: 'CONFLICT', message: '同名平台已存在' },
        status: 409,
        statusText: 'Conflict',
        headers: {},
      } as AxiosResponse
      return new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, response)
    })

    await expect(http.get('/platforms')).rejects.toBeInstanceOf(ApiError)
    await expect(http.get('/platforms')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: '同名平台已存在',
    })
  })

  it('无错误体时回退为 NETWORK_ERROR', async () => {
    stubAdapter(() => new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED'))

    await expect(http.get('/orders')).rejects.toMatchObject({
      statusCode: 0,
      code: 'NETWORK_ERROR',
    })
  })

  it('401 时刷新 token 并重试原请求，不立即退出登录', async () => {
    const unauthorizedHandler = vi.fn().mockResolvedValue(undefined)
    setUnauthorizedHandler(unauthorizedHandler)
    let attempts = 0
    let retriedHeaders: Record<string, string> | undefined

    http.defaults.adapter = (async (config: AxiosRequestConfig) => {
      attempts += 1
      if (attempts === 1) {
        const response = {
          data: { statusCode: 401, code: 'UNAUTHORIZED', message: '令牌无效或已过期' },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
        } as AxiosResponse
        throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config as never, undefined, response)
      }
      retriedHeaders = config.headers as Record<string, string>
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse
    }) as never

    await expect(http.get('/orders')).resolves.toMatchObject({ data: { ok: true } })
    expect(attempts).toBe(2)
    expect(retriedHeaders?.Authorization).toBe('Bearer token-refreshed')
    expect(vi.mocked(supabase.auth.refreshSession)).toHaveBeenCalledTimes(1)
    expect(unauthorizedHandler).not.toHaveBeenCalled()
  })

  it('token 刷新失败后才触发退出登录', async () => {
    const unauthorizedHandler = vi.fn().mockResolvedValue(undefined)
    setUnauthorizedHandler(unauthorizedHandler)
    vi.mocked(supabase.auth.refreshSession).mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'refresh token expired' },
    } as never)
    stubAdapter(() => {
      const response = {
        data: { statusCode: 401, code: 'UNAUTHORIZED', message: '令牌无效或已过期' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
      } as AxiosResponse
      return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, response)
    })

    await expect(http.get('/orders')).rejects.toMatchObject({ statusCode: 401 })
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1)
  })
})
