import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlatformsPage from './index.vue'
import { createPlatform, createPresets, deletePlatform, getPlatformList, updatePlatform } from '@/api/platform.api'
import { createStore, deleteStore, getStoreList, updateStore } from '@/api/store.api'
import PlatformList from '@/components/platform/PlatformList.vue'
import StoreList from '@/components/platform/StoreList.vue'
import AppErrorState from '@/components/common/AppErrorState.vue'
import type { PlatformVo, StoreVo } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

vi.mock('@/api/platform.api', () => ({
  getPlatformList: vi.fn(),
  createPlatform: vi.fn(),
  createPresets: vi.fn(),
  updatePlatform: vi.fn(),
  deletePlatform: vi.fn(),
}))
vi.mock('@/api/store.api', () => ({
  getStoreList: vi.fn(),
  createStore: vi.fn(),
  updateStore: vi.fn(),
  deleteStore: vi.fn(),
}))

const mockedPlatforms = vi.mocked(getPlatformList)
const mockedStores = vi.mocked(getStoreList)
const mockedCreatePlatform = vi.mocked(createPlatform)
const mockedUpdatePlatform = vi.mocked(updatePlatform)
const mockedDeletePlatform = vi.mocked(deletePlatform)
const mockedPresets = vi.mocked(createPresets)
const mockedCreateStore = vi.mocked(createStore)
const mockedUpdateStore = vi.mocked(updateStore)
const mockedDeleteStore = vi.mocked(deleteStore)

function platform(overrides: Partial<PlatformVo> = {}): PlatformVo {
  return {
    id: 'pf1',
    name: 'AmiAmi',
    logoUrl: null,
    website: 'https://www.amiami.com',
    region: 'JP',
    defaultCurrency: 'JPY',
    note: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    storeCount: 1,
    ...overrides,
  }
}

function store(overrides: Partial<StoreVo> = {}): StoreVo {
  return {
    id: 'st1',
    name: 'AmiAmi 官方店',
    platformId: 'pf1',
    platformName: 'AmiAmi',
    url: 'https://www.amiami.com',
    contact: null,
    note: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mountPage() {
  return mount(PlatformsPage, {
    global: {
      stubs: { ...elementStubs },
      plugins: [
        createPinia(),
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
  })
}

describe('平台 / 店铺页', () => {
  beforeEach(() => {
    mockedPlatforms.mockReset()
    mockedStores.mockReset()
    mockedCreatePlatform.mockReset()
    mockedUpdatePlatform.mockReset()
    mockedDeletePlatform.mockReset()
    mockedPresets.mockReset()
    mockedCreateStore.mockReset()
    mockedUpdateStore.mockReset()
    mockedDeleteStore.mockReset()

    mockedPlatforms.mockResolvedValue({ items: [platform()], total: 1, page: 1, pageSize: 100 })
    mockedStores.mockResolvedValue({ items: [store()], total: 1, page: 1, pageSize: 20 })
    mockedCreatePlatform.mockResolvedValue(platform({ id: 'pf2', name: 'HobbySearch' }))
    mockedUpdatePlatform.mockResolvedValue(platform())
    mockedDeletePlatform.mockResolvedValue({ id: 'pf1' })
    mockedPresets.mockResolvedValue({ created: 5 })
    mockedCreateStore.mockResolvedValue(store({ id: 'st2' }))
    mockedUpdateStore.mockResolvedValue(store())
    mockedDeleteStore.mockResolvedValue({ id: 'st1' })
  })

  it('默认不按平台过滤店铺', async () => {
    mountPage()
    await flushPromises()
    expect(mockedPlatforms).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
    expect(mockedStores).toHaveBeenCalledWith({ page: 1, pageSize: 20, platformId: undefined })
  })

  it('选中平台后按 platformId 过滤店铺', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.findComponent(PlatformList).vm.$emit('select', 'pf1')
    await flushPromises()
    expect(mockedStores).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, platformId: 'pf1' })
  })

  it('再次点击同一平台取消选中', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.findComponent(PlatformList).vm.$emit('select', 'pf1')
    await flushPromises()
    wrapper.findComponent(PlatformList).vm.$emit('select', 'pf1')
    await flushPromises()
    expect(mockedStores).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, platformId: undefined })
  })

  it('提交平台表单调用 createPlatform 并刷新列表', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.findComponent(PlatformList).vm.$emit('create', { name: 'HobbySearch' })
    await flushPromises()
    await flushPromises()
    expect(mockedCreatePlatform).toHaveBeenCalledWith({ name: 'HobbySearch' })
    expect(mockedPlatforms.mock.calls.length).toBeGreaterThan(1)
  })

  it('编辑 / 删除平台分别调用 updatePlatform / deletePlatform', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const list = wrapper.findComponent(PlatformList)
    list.vm.$emit('update', 'pf1', { name: 'AmiAmi JP' })
    list.vm.$emit('remove', 'pf1')
    await flushPromises()
    expect(mockedUpdatePlatform).toHaveBeenCalledWith('pf1', { name: 'AmiAmi JP' })
    expect(mockedDeletePlatform).toHaveBeenCalledWith('pf1')
  })

  it('导入预置平台后提示导入数量', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.findComponent(PlatformList).vm.$emit('import-presets')
    await flushPromises()
    await flushPromises()
    expect(mockedPresets).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('已导入 5 个预置平台')
  })

  it('店铺 CRUD 透传到 store api', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const list = wrapper.findComponent(StoreList)
    list.vm.$emit('create', { name: '新店铺', platformId: 'pf1' })
    list.vm.$emit('update', 'st1', { name: '改名' })
    list.vm.$emit('remove', 'st1')
    await flushPromises()
    expect(mockedCreateStore).toHaveBeenCalledWith({ name: '新店铺', platformId: 'pf1' })
    expect(mockedUpdateStore).toHaveBeenCalledWith('st1', { name: '改名' })
    expect(mockedDeleteStore).toHaveBeenCalledWith('st1')
  })

  it('列表接口失败展示错误态', async () => {
    mockedPlatforms.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.findComponent(AppErrorState).exists()).toBe(true)
  })
})
