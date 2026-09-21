import type { CurrencyAmountVo, DashboardVo } from '@/types/models'

export interface DashboardKpiCardModel {
  key: string
  title: string
  description?: string
  value?: string | number
  amounts?: CurrencyAmountVo[]
  to: string
}

export function greetingFor(hour: number): string {
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function buildDashboardKpis(kpis: DashboardVo['kpis']): DashboardKpiCardModel[] {
  return [
    {
      key: 'pendingPayment',
      title: '待付款',
      description: '已到期与未到期的未付金额',
      amounts: kpis.pendingPaymentAmount,
      to: '/orders?tab=WAITING_PAYMENT',
    },
    {
      key: 'upcomingPayment',
      title: '未来 30 天待付',
      description: '未来 30 天内的付款计划',
      amounts: kpis.upcomingPaymentAmount,
      to: '/orders?tab=WAITING_PAYMENT',
    },
    {
      key: 'monthRelease',
      title: '本月预计出货',
      description: '预计在本月出货的订单',
      value: kpis.monthReleaseCount,
      to: '/orders?tab=WAITING_RELEASE',
    },
    {
      key: 'inTransit',
      title: '运输中',
      description: '在途包裹对应的订单',
      value: kpis.inTransitOrderCount,
      to: '/orders?tab=IN_TRANSIT',
    },
    {
      key: 'collection',
      title: '收藏总数',
      description: `共 ${kpis.totalOrderCount} 个订单`,
      value: kpis.collectionCount,
      to: '/collection',
    },
  ]
}
