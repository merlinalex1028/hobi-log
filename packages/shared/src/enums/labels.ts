import type {
  AttachmentType,
  DisplayStatus,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
  PaymentType,
  ProductCategory,
  ReleaseEventType,
  ReleaseStatus,
  ShipmentStatus,
} from './index'

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  FULL: '全款',
  DEPOSIT_BALANCE: '定金 + 尾款',
  INSTALLMENT: '多阶段付款',
  CUSTOM: '自定义付款',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  ACTIVE: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: '待付款',
  PAID: '已付款',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
  PARTIALLY_REFUNDED: '部分退款',
}

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  FULL: '全款',
  DEPOSIT: '定金',
  BALANCE: '尾款',
  INSTALLMENT: '阶段款',
  SHIPPING: '运费',
  TAX: '税费',
  SUPPLEMENT: '补差价',
  REFUND: '退款',
  OTHER: '其他',
}

export const RELEASE_EVENT_TYPE_LABELS: Record<ReleaseEventType, string> = {
  EXPECTED_RELEASE: '预计出货',
  DELAY: '延期',
  RELEASED: '厂商出货',
  STORE_ARRIVED: '店铺到货',
  BALANCE_OPEN: '补款开始',
  SHIPMENT_READY: '可发货',
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  WAITING: '未发货',
  SHIPPED: '已发货',
  IN_TRANSIT: '运输中',
  DELIVERED: '已签收',
  EXCEPTION: '物流异常',
  RETURNED: '已退回',
}

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  SCALE_FIGURE: '比例手办',
  PRIZE_FIGURE: '景品',
  NENDOROID: '粘土人',
  ACTION_FIGURE: '可动',
  GK: 'GK',
  MODEL: '模型',
  PLUSH: '毛绒',
  ACRYLIC: '亚克力',
  BADGE: '徽章',
  CARD: '色纸',
  BOOK: '书籍',
  OTHER: '其他周边',
}

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  PRODUCT_IMAGE: '商品图片',
  ORDER_SCREENSHOT: '订单截图',
  PAYMENT_SCREENSHOT: '补款截图',
  PAYMENT_PROOF: '付款凭证',
  SHIPMENT_SCREENSHOT: '物流截图',
  CHAT_SCREENSHOT: '聊天截图',
  OTHER: '其他',
}

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  CANCELLED: '已取消',
  REFUNDED: '已退款',
  PAYMENT_OVERDUE: '付款逾期',
  WAITING_PAYMENT: '待付款',
  SHIPMENT_EXCEPTION: '物流异常',
  IN_TRANSIT: '运输中',
  WAITING_SHIPMENT: '等待发货',
  WAITING_RELEASE: '等待出货',
  COMPLETED: '已签收',
  ACTIVE: '进行中',
}

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  UNKNOWN: '未知',
  WAITING_RELEASE: '等待出货',
  DELAYED: '延期',
  RELEASED: '厂商已出货',
  STORE_ARRIVED: '店铺已到货',
  READY_TO_SHIP: '待发货',
}

export const DISPLAY_STATUS_COLORS: Record<DisplayStatus, string> = {
  CANCELLED: 'gray',
  REFUNDED: 'gray-blue',
  PAYMENT_OVERDUE: 'red',
  WAITING_PAYMENT: 'orange',
  SHIPMENT_EXCEPTION: 'red',
  IN_TRANSIT: 'blue',
  WAITING_SHIPMENT: 'cyan',
  WAITING_RELEASE: 'purple',
  COMPLETED: 'green',
  ACTIVE: 'gray',
}
