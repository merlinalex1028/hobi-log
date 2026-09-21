import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CreateOrderPage from './create.vue'
import OrderForm from '@/components/order/OrderForm.vue'
import { createOrder } from '@/api/order.api'
import type { OrderFormModel } from '@/types/forms'
import type { OrderDetail } from '@/types/models'
import { elementStubs } from '@/test/element-stubs'

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }))

vi.mock('vue-router', () => ({
  useRouter: () => routerMock,
  useRoute: () => ({ query: {}, params: {} }),
}))
vi.mock('@/api/order.api', () => ({
  createOrder: vi.fn(),
  getOrderDetail: vi.fn(),
  getOrderList: vi.fn(),
  updateOrder: vi.fn(),
  cancelOrder: vi.fn(),
}))
vi.mock('@/api/product.api', () => ({ getProductList: vi.fn(), createProduct: vi.fn() }))
vi.mock('@/api/platform.api', () => ({ getPlatformList: vi.fn() }))
vi.mock('@/api/store.api', () => ({ getStoreList: vi.fn(), createStore: vi.fn() }))

const mockedCreate = vi.mocked(createOrder)

function createModel(overrides: Partial<OrderFormModel> = {}): OrderFormModel {
  return {
    items: [{ productId: 'p1', name: '芙宁娜 1/7 手办', coverUrl: null, quantity: 1, unitPrice: 1299 }],
    platformId: 'pf1',
    storeId: 'st1',
    orderNo: 'A-1',
    orderUrl: '',
    orderedAt: '2026-01-02',
    currency: 'CNY',
    autoCalculateGoodsAmount: true,
    goodsAmount: 0,
    discountAmount: 100,
    shippingAmount: 20,
    taxAmount: 0,
    extraAmount: 0,
    paymentMode: 'FULL',
    payments: [{ type: 'FULL', amount: 1219, status: 'PENDING' }],
    useExpectedRelease: true,
    releaseDate: '2027-05',
    releaseDatePrecision: 'MONTH',
    note: '',
    ...overrides,
  }
}

function mountPage() {
  return mount(CreateOrderPage, {
    global: {
      stubs: elementStubs,
      plugins: [
        createPinia(),
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
  })
}

describe('订单创建页', () => {
  beforeEach(() => {
    routerMock.push.mockReset()
    routerMock.replace.mockReset()
    mockedCreate.mockReset()
    mockedCreate.mockResolvedValue({ id: 'o9' } as OrderDetail)
  })

  it('空表单提交被校验拦截，不调用创建接口', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.findComponent(OrderForm).vm.$emit('submit')
    await flushPromises()
    expect(mockedCreate).not.toHaveBeenCalled()
    expect(routerMock.replace).not.toHaveBeenCalled()
  })

  it('提交时把表单映射为创建订单 payload，并跳转详情', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const form = wrapper.findComponent(OrderForm)
    await form.vm.$emit('update:modelValue', createModel())
    await form.vm.$emit('submit')
    await flushPromises()

    expect(mockedCreate).toHaveBeenCalledTimes(1)
    const payload = mockedCreate.mock.calls[0]?.[0]
    expect(payload).toMatchObject({
      platformId: 'pf1',
      storeId: 'st1',
      orderNo: 'A-1',
      orderedAt: '2026-01-02',
      currency: 'CNY',
      paymentMode: 'FULL',
      autoCalculateGoodsAmount: true,
      goodsAmount: 1299,
      discountAmount: 100,
      shippingAmount: 20,
      items: [{ productId: 'p1', quantity: 1, unitPrice: 1299 }],
      payments: [{ type: 'FULL', amount: 1219, status: 'PENDING' }],
      expectedRelease: { date: '2027-05', precision: 'MONTH' },
    })
    expect(payload?.orderUrl).toBeUndefined()
    expect(payload?.note).toBeUndefined()
    expect(routerMock.replace).toHaveBeenCalledWith('/orders/o9')
  })

  it('创建失败时停留在当前页', async () => {
    mockedCreate.mockRejectedValue(new Error('商品不存在或不属于当前用户'))
    const wrapper = mountPage()
    await flushPromises()

    const form = wrapper.findComponent(OrderForm)
    await form.vm.$emit('update:modelValue', createModel())
    await form.vm.$emit('submit')
    await flushPromises()

    expect(mockedCreate).toHaveBeenCalledTimes(1)
    expect(routerMock.replace).not.toHaveBeenCalled()
  })
})
