import { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-abc' } } }),
    },
  },
}))

import { supabase } from '@/lib/supabase'
import { ApiError, http } from './http'

const originalAdapter = http.defaults.adapter

afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'token-abc' } },
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
})
