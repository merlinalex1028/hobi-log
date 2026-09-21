import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
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
  })

  it('init 后未登录时为 false', async () => {
    const store = useAuthStore()
    await store.init()
    expect(store.isAuthenticated()).toBe(false)
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
