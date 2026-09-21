export interface CollectionItemVo {
  orderItemId: string
  orderId: string
  productId: string
  name: string
  coverUrl: string | null
  quantity: number
  purchasePrice: number
  currency: string
  purchasedAt: string
  deliveredAt: string | null
}

export interface CollectionStatsVo {
  totalItems: number
  deliveredOrders: number
  byCurrency: Array<{ currency: string; amount: number }>
}
