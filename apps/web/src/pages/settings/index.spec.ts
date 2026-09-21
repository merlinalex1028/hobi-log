import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from './index.vue'
import { useAppSettingsStore } from '@/stores/app-settings'
import { useAuthStore } from '@/stores/auth'
import { useViewPreferenceStore } from '@/stores/view-preference'
import { elementStubs } from '@/test/element-stubs'

const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerMock.push }) }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

import { supabase } from '@/lib/supabase'

function mountPage() {
  return mount(SettingsPage, { global: { stubs: { ...elementStubs } } })
}

describe('设置页', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    routerMock.push.mockReset()
    vi.mocked(supabase.auth.signOut).mockClear()
  })

  it('展示账户邮箱与只读的提醒提前天数', () => {
    const auth = useAuthStore()
    auth.user = { email: 'a@hobilog.dev' } as never
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('a@hobilog.dev')
    expect(wrapper.text()).toContain('7 天 / 3 天 / 1 天 / 0 天')
  })

  it('未登录时邮箱显示「未登录」', () => {
    expect(mountPage().text()).toContain('未登录')
  })

  it('默认币种写回本地设置 store 与 localStorage', async () => {
    const settings = useAppSettingsStore()
    const wrapper = mountPage()
    const select = wrapper.findAll('select')[2]
    await select?.setValue('JPY')
    expect(settings.defaultCurrency).toBe('JPY')
    expect(localStorage.getItem('hobilog:default-currency')).toBe('JPY')
  })

  it('时区写回本地设置 store', async () => {
    const settings = useAppSettingsStore()
    const wrapper = mountPage()
    await wrapper.findAll('select')[3]?.setValue('Asia/Tokyo')
    expect(settings.timeZone).toBe('Asia/Tokyo')
  })

  it('订单默认视图写回 app-settings，当前视图写回 view-preference', async () => {
    const settings = useAppSettingsStore()
    const viewPreference = useViewPreferenceStore()
    const wrapper = mountPage()
    const selects = wrapper.findAll('select')
    await selects[0]?.setValue('grid')
    await selects[1]?.setValue('grid')
    expect(settings.orderDefaultView).toBe('grid')
    expect(viewPreference.orderView).toBe('grid')
  })

  it('导出入口预留且禁用', () => {
    const wrapper = mountPage()
    const button = wrapper.findAll('button').find(item => item.text().includes('导出入口预留'))
    expect(button?.attributes('disabled')).toBeDefined()
  })

  it('退出登录调用 signOut 并跳转登录页', async () => {
    const auth = useAuthStore()
    const wrapper = mountPage()
    const button = wrapper.findAll('button').find(item => item.text() === '退出登录')
    await button?.trigger('click')
    await flushPromises()
    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(auth.session).toBeNull()
    expect(routerMock.push).toHaveBeenCalledWith('/login')
  })
})
