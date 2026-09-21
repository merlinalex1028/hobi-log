import type {
  DashboardVo,
  DimensionStatVo,
  FuturePaymentVo,
  MonthlyPaymentVo,
} from '@/types/models'
import { http } from './http'

export type DimensionKey = 'categories' | 'platforms' | 'manufacturers' | 'ips'

export interface StatisticsRangeParams {
  from?: string
  to?: string
  currency?: string
}

export function getDashboard(): Promise<DashboardVo> {
  return http.get<DashboardVo>('/statistics/dashboard').then(res => res.data)
}

export function getMonthlyPayments(params: StatisticsRangeParams): Promise<MonthlyPaymentVo[]> {
  return http.get<MonthlyPaymentVo[]>('/statistics/payments/monthly', { params }).then(res => res.data)
}

export function getFuturePayments(params: { months?: number; currency?: string }): Promise<FuturePaymentVo[]> {
  return http.get<FuturePaymentVo[]>('/statistics/payments/future', { params }).then(res => res.data)
}

export function getDimensionStatistics(
  dimension: DimensionKey,
  params: StatisticsRangeParams,
): Promise<DimensionStatVo[]> {
  return http.get<DimensionStatVo[]>(`/statistics/${dimension}`, { params }).then(res => res.data)
}
