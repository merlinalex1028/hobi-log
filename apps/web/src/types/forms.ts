import type { ProductCategory } from '@hobilog/shared'
import type { CurrencyAmountVo } from './models'

export interface StatisticsKpi {
  key: string
  title: string
  description?: string
  value?: string | number
  amounts?: CurrencyAmountVo[]
  to?: string
}

export interface OrderItemForm {
  productId: string
  name: string
  coverUrl: string | null
  quantity: number
  unitPrice: number
}

export interface PaymentFormItem {
  type: string
  name?: string
  amount: number | null
  status: 'PENDING' | 'PAID'
  expectedAt?: string
  dueAt?: string
  paidAt?: string
  paymentMethod?: string
  note?: string
}

export interface OrderFormModel {
  items: OrderItemForm[]
  platformId: string
  storeId: string
  orderNo: string
  orderUrl: string
  orderedAt: string
  currency: string
  autoCalculateGoodsAmount: boolean
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
  paymentMode: string
  payments: PaymentFormItem[]
  useExpectedRelease: boolean
  releaseDate: string
  releaseDatePrecision: 'DAY' | 'MONTH'
  note: string
}

export interface ProductFormState {
  name: string
  originalName: string
  coverUrl: string
  category: ProductCategory
  ipName: string
  characterName: string
  manufacturer: string
  seriesName: string
  scale: string
  version: string
  sku: string
  officialPrice: number | null
  officialCurrency: string
  announcedAt: string
  originalReleaseDate: string
  releaseDatePrecision: 'DAY' | 'MONTH'
  description: string
  tagNames: string[]
}

export interface ProductFilterState {
  page: number
  pageSize: number
  keyword: string
  category: string
  manufacturer: string
  ipName: string
  characterName: string
  status: string
}
