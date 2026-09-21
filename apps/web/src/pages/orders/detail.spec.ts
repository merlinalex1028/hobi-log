import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderDetailPage from './detail.vue'
import { getOrderDetail } from '@/api/order.api'
import AppErrorState from '@/components/common/AppErrorState.vue'
import { ApiError } from '@/api/http'
import { elementStubs } from '@/test/element-stubs'

const routerMock = vi.hoisted(() => ({ push: vi.fn() }))
const routeMock = vi.hoisted(() => ({ params: { id: 'o1' } }))

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => ({ push: routerMock.push }),
}))
vi.mock('@/api/order.api', () => ({
  getOrderDetail: vi.fn(),
  cancelOrder: vi.fn(),
}))
vi.mock('@/api/payment.api', () => ({
  createPayment: vi.fn(),
  markPaymentPaid: vi.fn(),
  refundPayment: vi.fn(),
  updatePayment: vi.fn(),
}))
vi.mock('@/api/release.api', () => ({
  delayRelease: vi.fn(),
  markReleased: vi.fn(),
  markStoreArrived: vi.fn(),
  openBalance: vi.fn(),
}))
vi.mock('@/api/shipment.api', () => ({
  createShipment: vi.fn(),
  deliverShipment: vi.fn(),
  updateShipment: vi.fn(),
}))
vi.mock('@/api/attachment.api', () => ({
  getAttachments: vi.fn(),
  getAttachmentUrl: vi.fn(),
  deleteAttachment: vi.fn(),
  createUploadUrl: vi.fn(),
  createAttachment: vi.fn(),
}))

const mockedDetail = vi.mocked(getOrderDetail)

function mountPage() {
  return mount(OrderDetailPage, {
    global: {
      stubs: {
        ...elementStubs,
        OrderDetailHeader: true,
        OrderOverviewAside: true,
        OrderTimeline: true,
        PaymentDetailSection: true,
        ReleaseDetailSection: true,
        ShipmentDetailSection: true,
        AttachmentSection: true,
        MarkPaymentPaidDialog: true,
        RefundPaymentDialog: true,
        ReleaseDelayDialog: true,
        ShipmentFormDrawer: true,
      },
      plugins: [
        createPinia(),
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
  })
}

describe('订单详情页错误分支（越权访问）', () => {
  beforeEach(() => {
    routeMock.params = { id: 'o1' }
    routerMock.push.mockReset()
    mockedDetail.mockReset()
  })

  it('后端 404（他人订单）时显示「订单加载失败」与重试按钮', async () => {
    mockedDetail.mockRejectedValue(new ApiError({ statusCode: 404, code: 'ORDER_NOT_FOUND', message: '订单不存在' }))
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.findComponent(AppErrorState).exists()).toBe(true)
    expect(wrapper.text()).toContain('订单加载失败')
    expect(wrapper.findAll('button').some(button => button.text() === '重试')).toBe(true)
  })

  it('重试按钮重新请求详情', async () => {
    mockedDetail.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    const before = mockedDetail.mock.calls.length
    wrapper.findComponent(AppErrorState).vm.$emit('retry')
    await flushPromises()
    expect(mockedDetail.mock.calls.length).toBeGreaterThan(before)
  })

  it('按路由参数请求对应订单', async () => {
    routeMock.params = { id: 'o9' }
    mockedDetail.mockRejectedValue(new Error('boom'))
    mountPage()
    await flushPromises()
    expect(mockedDetail).toHaveBeenCalledWith('o9')
  })
})
