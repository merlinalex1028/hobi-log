import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { installAuthGuard } from './guards'

const sessionRef = vi.hoisted(() => ({ value: null as { access_token: string } | null }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: sessionRef.value } })),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' }, meta: { public: true } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div>dashboard</div>' } },
      { path: '/orders', name: 'orders', component: { template: '<div>orders</div>' } },
      { path: '/orders/:id', name: 'order-detail', component: { template: '<div>detail</div>' } },
    ],
  })
}

describe('router guards（未登录越权）', () => {
  beforeEach(() => {
    sessionRef.value = null
    setActivePinia(createPinia())
  })

  it('未登录访问 /orders 跳转 /login 并带 redirect', async () => {
    const router = createTestRouter()
    installAuthGuard(router)
    await router.push('/orders')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/orders')
  })

  it('未登录访问 /orders/:id 也会带上完整原路径', async () => {
    const router = createTestRouter()
    installAuthGuard(router)
    await router.push('/orders/o1')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/orders/o1')
  })

  it('已登录可访问受保护路由', async () => {
    sessionRef.value = { access_token: 'tok' }
    const router = createTestRouter()
    installAuthGuard(router)
    await router.push('/orders')
    expect(router.currentRoute.value.path).toBe('/orders')
  })

  it('/login 为公开路由，未登录也能访问', async () => {
    const router = createTestRouter()
    installAuthGuard(router)
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBeUndefined()
  })
})
