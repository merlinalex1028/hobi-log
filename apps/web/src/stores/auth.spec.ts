import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ data: { session: { access_token: 'tok' }, user: { id: 'u1' } }, error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never)
    vi.mocked(supabase.auth.onAuthStateChange).mockClear()
  })

  it('init 后未登录时为 false', async () => {
    const store = useAuthStore()
    await store.init()
    expect(store.isAuthenticated()).toBe(false)
  })

  it('init 幂等：并发调用只读取一次 session 且只注册一次订阅', async () => {
    const store = useAuthStore()
    await Promise.all([store.init(), store.init()])
    await store.init()
    expect(vi.mocked(supabase.auth.getSession)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(supabase.auth.onAuthStateChange)).toHaveBeenCalledTimes(1)
    expect(store.initialized).toBe(true)
  })

  it('dispose 取消订阅并允许重新 init', async () => {
    const store = useAuthStore()
    const unsubscribe = vi.fn()
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValueOnce({
      data: { subscription: { unsubscribe } },
    } as never)

    await store.init()
    store.dispose()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(store.initialized).toBe(false)

    await store.init()
    expect(vi.mocked(supabase.auth.getSession)).toHaveBeenCalledTimes(2)
  })

  it('signIn 成功写入 session 与 user', async () => {
    const store = useAuthStore()
    await store.signIn('a@hobilog.dev', 'secret')
    expect(store.isAuthenticated()).toBe(true)
    expect(store.user?.id).toBe('u1')
  })

  it('signIn 失败抛出错误', async () => {
    const store = useAuthStore()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: '密码错误' },
    } as never)
    await expect(store.signIn('a@hobilog.dev', 'bad')).rejects.toThrow('密码错误')
  })

  it('accessToken 返回 token', async () => {
    const store = useAuthStore()
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { access_token: 'tok' } },
    } as never)
    await expect(store.accessToken()).resolves.toBe('tok')
  })
})
