# HobiLog V0.1 TypeScript 类型与 API 层

> 本文档定义 HobiLog V0.1 的前端 TypeScript 类型边界、Supabase 数据访问层、DTO / FormModel / ViewModel 分层方式，以及核心 API 设计。

---

# 1. 目标

前端代码需要明确区分：

```text
数据库 Row
↓
API DTO
↓
业务 Model
↓
Form Model
↓
页面 View Model
```

不要直接拿 Supabase 生成的数据库类型到处使用。

这样以后：

- 字段调整
- API 替换
- Supabase → NestJS
- 页面重构

都不会牵一发动全身。

---

# 2. 目录结构

推荐：

```text
src/
├─ api/
│  ├─ client.ts
│  ├─ order.api.ts
│  ├─ product.api.ts
│  ├─ payment.api.ts
│  ├─ release.api.ts
│  ├─ shipment.api.ts
│  ├─ platform.api.ts
│  ├─ statistics.api.ts
│  └─ upload.api.ts
│
├─ types/
│  ├─ database.types.ts
│  ├─ common.ts
│  ├─ order.ts
│  ├─ product.ts
│  ├─ payment.ts
│  ├─ release.ts
│  ├─ shipment.ts
│  ├─ platform.ts
│  ├─ statistics.ts
│  └─ form.ts
│
├─ models/
│  ├─ order.model.ts
│  ├─ product.model.ts
│  └─ timeline.model.ts
│
├─ mappers/
│  ├─ order.mapper.ts
│  ├─ product.mapper.ts
│  └─ shipment.mapper.ts
│
└─ utils/
   ├─ money.ts
   ├─ date.ts
   ├─ order-status.ts
   └─ payment.ts
```

---

# 3. Supabase Client

```ts
// src/api/client.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
)
```

---

# 4. 通用基础类型

```ts
// src/types/common.ts

export type CurrencyCode =
  | 'CNY'
  | 'JPY'
  | 'USD'
  | 'HKD'
  | string

export type DatePrecision =
  | 'DAY'
  | 'MONTH'

export interface PageQuery {
  page: number
  pageSize: number
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
```

---

# 5. Product 类型

```ts
// src/types/product.ts

export type ProductCategory =
  | 'SCALE_FIGURE'
  | 'PRIZE_FIGURE'
  | 'NENDOROID'
  | 'ACTION_FIGURE'
  | 'GK'
  | 'MODEL'
  | 'PLUSH'
  | 'ACRYLIC'
  | 'BADGE'
  | 'CARD'
  | 'BOOK'
  | 'OTHER'

export interface Product {
  id: string
  userId: string

  name: string
  originalName?: string | null
  coverUrl?: string | null

  category: ProductCategory

  ipName?: string | null
  characterName?: string | null
  manufacturer?: string | null
  seriesName?: string | null

  scale?: string | null
  version?: string | null
  sku?: string | null

  officialPrice?: number | null
  officialCurrency?: string | null

  announcedAt?: string | null
  originalReleaseDate?: string | null
  releaseDatePrecision?: 'DAY' | 'MONTH' | null

  description?: string | null
  status: string

  createdAt: string
  updatedAt: string
}
```

---

# 6. Order 类型

```ts
// src/types/order.ts

import type { CurrencyCode } from './common'
import type { Product } from './product'
import type { Payment } from './payment'
import type { ReleaseEvent } from './release'
import type { Shipment } from './shipment'

export type PaymentMode =
  | 'FULL'
  | 'DEPOSIT_BALANCE'
  | 'INSTALLMENT'
  | 'CUSTOM'

export type OrderStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'ARCHIVED'

export interface OrderItem {
  id: string
  orderId: string
  productId: string

  quantity: number
  unitPrice: number
  subtotal: number

  note?: string | null

  product?: Product
}

export interface Order {
  id: string
  userId: string

  platformId?: string | null
  storeId?: string | null

  orderNo?: string | null
  orderUrl?: string | null
  orderedAt: string

  currency: CurrencyCode

  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
  totalAmount: number

  paymentMode: PaymentMode
  status: OrderStatus

  note?: string | null
  archived: boolean

  items: OrderItem[]
  payments: Payment[]
  releaseEvents: ReleaseEvent[]
  shipments: Shipment[]

  createdAt: string
  updatedAt: string
}
```

---

# 7. Payment 类型

```ts
// src/types/payment.ts

export type PaymentType =
  | 'FULL'
  | 'DEPOSIT'
  | 'BALANCE'
  | 'INSTALLMENT'
  | 'SHIPPING'
  | 'TAX'
  | 'SUPPLEMENT'
  | 'REFUND'
  | 'OTHER'

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'

export interface Payment {
  id: string
  orderId: string

  type: PaymentType
  name?: string | null

  amount?: number | null
  currency: string

  status: PaymentStatus

  expectedAt?: string | null
  dueAt?: string | null
  paidAt?: string | null

  paymentMethod?: string | null
  transactionNo?: string | null

  note?: string | null
  sortOrder: number

  createdAt: string
  updatedAt: string
}
```

---

# 8. ReleaseEvent 类型

```ts
// src/types/release.ts

export type ReleaseEventType =
  | 'EXPECTED_RELEASE'
  | 'DELAY'
  | 'RELEASED'
  | 'STORE_ARRIVED'
  | 'BALANCE_OPEN'
  | 'SHIPMENT_READY'

export interface ReleaseEvent {
  id: string

  orderId: string
  productId?: string | null

  type: ReleaseEventType

  oldDate?: string | null
  newDate?: string | null

  datePrecision?: 'DAY' | 'MONTH' | null

  occurredAt: string

  source?: string | null
  sourceUrl?: string | null
  note?: string | null

  createdAt: string
}
```

---

# 9. Shipment 类型

```ts
// src/types/shipment.ts

export type ShipmentStatus =
  | 'WAITING'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'EXCEPTION'
  | 'RETURNED'

export interface ShipmentItem {
  id: string

  shipmentId: string
  orderItemId: string

  quantity: number
}

export interface Shipment {
  id: string
  orderId: string

  carrier?: string | null
  trackingNo?: string | null

  status: ShipmentStatus

  shippedAt?: string | null
  estimatedDeliveryAt?: string | null
  deliveredAt?: string | null

  note?: string | null

  items?: ShipmentItem[]

  createdAt: string
  updatedAt: string
}
```

---

# 10. Platform / Store

```ts
// src/types/platform.ts

export interface Platform {
  id: string
  userId: string

  name: string
  logoUrl?: string | null
  website?: string | null
  region?: string | null
  defaultCurrency?: string | null
  note?: string | null
}

export interface Store {
  id: string
  userId: string

  platformId?: string | null

  name: string
  url?: string | null
  contact?: string | null
  note?: string | null
}
```

---

# 11. OrderSummary

```ts
export interface OrderSummary {
  orderId: string

  totalAmount: number
  paidAmount: number
  pendingAmount: number
  refundedAmount: number

  nextPaymentDue?: string | null
  pendingPaymentCount: number
}
```

---

# 12. 页面业务状态

```ts
export type OrderDisplayStatus =
  | 'PAYMENT_OVERDUE'
  | 'WAITING_PAYMENT'
  | 'WAITING_RELEASE'
  | 'WAITING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'SHIPMENT_EXCEPTION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'ARCHIVED'
  | 'ACTIVE'
```

注意：

```text
OrderDisplayStatus
```

不是数据库字段。

它是由多个实体计算出来的页面业务状态。

---

# 13. FormModel

表单类型与业务类型分离。

```ts
// src/types/form.ts

export interface OrderItemForm {
  productId: string

  quantity: number

  unitPrice: number

  note?: string
}

export interface PaymentFormItem {
  id?: string

  type: PaymentType

  name?: string

  amountMode: 'FIXED' | 'UNKNOWN'

  amount?: number | null

  status: PaymentStatus

  expectedAt?: string
  dueAt?: string
  paidAt?: string

  paymentMethod?: string
  note?: string
}

export interface OrderFormModel {
  items: OrderItemForm[]

  platformId?: string
  storeId?: string

  orderNo?: string
  orderUrl?: string

  orderedAt: string

  currency: string

  autoCalculateGoodsAmount: boolean

  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number

  paymentMode: PaymentMode

  payments: PaymentFormItem[]

  releaseDate?: string
  releaseDatePrecision?: 'DAY' | 'MONTH'

  note?: string
}
```

---

# 14. CreateOrderPayload

与 RPC 保持一致。

```ts
export interface CreateOrderPayload {
  order: {
    platform_id?: string | null
    store_id?: string | null

    order_no?: string | null
    order_url?: string | null

    ordered_at: string

    currency: string

    goods_amount: number
    discount_amount: number
    shipping_amount: number
    tax_amount: number
    extra_amount: number
    total_amount: number

    payment_mode: PaymentMode

    note?: string | null
  }

  items: Array<{
    product_id: string
    quantity: number
    unit_price: number
    subtotal: number
    note?: string | null
  }>

  payments: Array<{
    type: PaymentType
    name?: string | null

    amount?: number | null
    currency: string

    status: PaymentStatus

    expected_at?: string | null
    due_at?: string | null
    paid_at?: string | null

    payment_method?: string | null
    transaction_no?: string | null
    note?: string | null

    sort_order: number
  }>

  expected_release?: {
    date: string
    precision: 'DAY' | 'MONTH'
  } | null
}
```

---

# 15. OrderForm → CreateOrderPayload

建议集中 Mapper。

```ts
export function mapOrderFormToCreatePayload(
  form: OrderFormModel,
): CreateOrderPayload {
  const goodsAmount = form.autoCalculateGoodsAmount
    ? form.items.reduce(
        (sum, item) =>
          sum + item.unitPrice * item.quantity,
        0,
      )
    : form.goodsAmount

  const totalAmount =
    goodsAmount
    - form.discountAmount
    + form.shippingAmount
    + form.taxAmount
    + form.extraAmount

  return {
    order: {
      platform_id: form.platformId ?? null,
      store_id: form.storeId ?? null,

      order_no: form.orderNo || null,
      order_url: form.orderUrl || null,

      ordered_at: form.orderedAt,

      currency: form.currency,

      goods_amount: goodsAmount,
      discount_amount: form.discountAmount,
      shipping_amount: form.shippingAmount,
      tax_amount: form.taxAmount,
      extra_amount: form.extraAmount,
      total_amount: totalAmount,

      payment_mode: form.paymentMode,

      note: form.note || null,
    },

    items: form.items.map(item => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.unitPrice * item.quantity,
      note: item.note || null,
    })),

    payments: form.payments.map((item, index) => ({
      type: item.type,
      name: item.name || null,

      amount:
        item.amountMode === 'UNKNOWN'
          ? null
          : item.amount ?? null,

      currency: form.currency,

      status: item.status,

      expected_at: item.expectedAt || null,
      due_at: item.dueAt || null,
      paid_at: item.paidAt || null,

      payment_method: item.paymentMethod || null,
      transaction_no: null,
      note: item.note || null,

      sort_order: index,
    })),

    expected_release:
      form.releaseDate
        ? {
            date: form.releaseDate,
            precision:
              form.releaseDatePrecision ?? 'MONTH',
          }
        : null,
  }
}
```

---

# 16. Product API

```ts
// src/api/product.api.ts

export interface ProductListParams {
  keyword?: string
  category?: string
  manufacturer?: string
  ipName?: string
  page?: number
  pageSize?: number
}
```

API：

```ts
getProductList(params)
getProductDetail(id)
createProduct(payload)
updateProduct(id, payload)
archiveProduct(id)
uploadProductCover(file)
```

---

# 17. Order API

```ts
// src/api/order.api.ts

export interface OrderListParams {
  keyword?: string

  displayStatus?: string

  platformId?: string
  storeId?: string

  manufacturer?: string
  ipName?: string
  characterName?: string

  paymentStatus?: string

  isDelayed?: boolean

  orderedFrom?: string
  orderedTo?: string

  releaseFrom?: string
  releaseTo?: string

  page?: number
  pageSize?: number
}
```

核心 API：

```ts
getOrderList(params)

getOrderDetail(id)

createOrder(payload)

updateOrder(id, payload)

cancelOrder(id)

archiveOrder(id)

deleteOrder(id)

duplicateOrder(id)
```

---

# 18. createOrder

```ts
export async function createOrder(
  payload: CreateOrderPayload,
) {
  const { data, error } = await supabase.rpc(
    'create_order',
    {
      p_payload: payload,
    },
  )

  if (error) {
    throw error
  }

  return data as string
}
```

---

# 19. Order List Query

列表页只取需要字段。

```ts
const query = supabase
  .from('orders')
  .select(
    `
      id,
      order_no,
      ordered_at,
      currency,
      total_amount,
      payment_mode,
      status,

      platform:platforms(
        id,
        name,
        logo_url
      ),

      store:stores(
        id,
        name
      ),

      items:order_items(
        id,
        quantity,

        product:products(
          id,
          name,
          cover_url,
          manufacturer,
          ip_name,
          character_name
        )
      ),

      payments(
        id,
        type,
        name,
        amount,
        status,
        due_at,
        paid_at
      ),

      release_events(
        id,
        type,
        old_date,
        new_date,
        date_precision,
        occurred_at
      ),

      shipments(
        id,
        status,
        carrier,
        tracking_no
      )
    `,
    {
      count: 'exact',
    },
  )
```

---

# 20. OrderDetail API

详情页可以拉完整关系：

```ts
export async function getOrderDetail(
  orderId: string,
) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,

      platform:platforms(*),

      store:stores(*),

      items:order_items(
        *,
        product:products(*)
      ),

      payments(*),

      release_events(*),

      shipments(
        *,
        shipment_items(
          *,
          order_item:order_items(
            *,
            product:products(*)
          )
        )
      ),

      order_events(*),

      attachments(*)
    `)
    .eq('id', orderId)
    .single()

  if (error) {
    throw error
  }

  return data
}
```

---

# 21. Payment API

```ts
export async function markPaymentPaid(
  params: {
    paymentId: string
    amount: number
    paidAt: string
    paymentMethod?: string
    transactionNo?: string
    note?: string
  },
) {
  const { error } = await supabase.rpc(
    'mark_payment_paid',
    {
      p_payment_id: params.paymentId,
      p_amount: params.amount,
      p_paid_at: params.paidAt,
      p_payment_method:
        params.paymentMethod ?? null,
      p_transaction_no:
        params.transactionNo ?? null,
      p_note:
        params.note ?? null,
    },
  )

  if (error) {
    throw error
  }
}
```

还需要：

```text
createPayment
updatePayment
cancelPayment
createRefund
deletePayment
```

---

# 22. Release API

```ts
delayRelease({
  orderId,
  oldDate,
  newDate,
  precision,
  source,
  sourceUrl,
  note
})

markReleased({
  orderId,
  releaseDate,
  source,
  sourceUrl,
  note
})

markStoreArrived(...)
```

---

# 23. Shipment API

```ts
createShipment({
  orderId,
  carrier,
  trackingNo,
  shippedAt,
  note
})

markShipmentDelivered({
  shipmentId,
  deliveredAt
})

updateShipmentStatus(...)

addShipmentItems(...)
```

---

# 24. Statistics API

```ts
getDashboardSummary()

getFuturePaymentMonthly(months)

getPaymentMonthlyStats(months)

getCategoryStats()

getPlatformStats()

getManufacturerStats()

getIpStats()
```

---

# 25. API Error 统一处理

推荐定义：

```ts
export class AppApiError extends Error {
  code?: string
  original?: unknown

  constructor(
    message: string,
    options?: {
      code?: string
      original?: unknown
    },
  ) {
    super(message)

    this.name = 'AppApiError'
    this.code = options?.code
    this.original = options?.original
  }
}
```

Supabase 错误统一转换。

---

# 26. useApiRequest

可以封装：

```ts
export async function runApi<T>(
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    throw normalizeApiError(error)
  }
}
```

---

# 27. Zod 表单校验

建议定义：

```ts
const paymentFormSchema = z.object({
  type: z.string(),

  amountMode: z.enum([
    'FIXED',
    'UNKNOWN',
  ]),

  amount: z
    .number()
    .min(0)
    .nullable()
    .optional(),

  status: z.string(),

  dueAt: z.string().optional(),

  paidAt: z.string().optional(),
})
```

如果：

```text
status = PAID
```

则要求：

```text
paidAt
```

存在。

---

# 28. 金额工具函数

```ts
export function getPaidAmount(
  payments: Payment[],
) {
  return payments
    .filter(
      item =>
        item.status === 'PAID'
        && item.type !== 'REFUND',
    )
    .reduce(
      (sum, item) =>
        sum + (item.amount ?? 0),
      0,
    )
}
```

---

# 29. Refund Amount

```ts
export function getRefundAmount(
  payments: Payment[],
) {
  return payments
    .filter(
      item =>
        item.status === 'PAID'
        && item.type === 'REFUND',
    )
    .reduce(
      (sum, item) =>
        sum + (item.amount ?? 0),
      0,
    )
}
```

---

# 30. Net Paid Amount

```ts
export function getNetPaidAmount(
  payments: Payment[],
) {
  return (
    getPaidAmount(payments)
    -
    getRefundAmount(payments)
  )
}
```

---

# 31. Pending Amount

```ts
export function getPendingAmount(
  payments: Payment[],
) {
  return payments
    .filter(
      item =>
        ['PENDING', 'OVERDUE']
          .includes(item.status),
    )
    .reduce(
      (sum, item) =>
        sum + (item.amount ?? 0),
      0,
    )
}
```

---

# 32. Next Payment

```ts
export function getNextPayment(
  payments: Payment[],
) {
  return payments
    .filter(
      item =>
        ['PENDING', 'OVERDUE']
          .includes(item.status),
    )
    .sort((a, b) => {
      if (!a.dueAt) return 1
      if (!b.dueAt) return -1

      return a.dueAt.localeCompare(
        b.dueAt,
      )
    })[0]
}
```

---

# 33. 最新出货时间

```ts
export function getLatestReleaseEvent(
  events: ReleaseEvent[],
) {
  return [...events]
    .filter(item =>
      [
        'EXPECTED_RELEASE',
        'DELAY',
        'RELEASED',
      ].includes(item.type),
    )
    .sort(
      (a, b) =>
        b.occurredAt.localeCompare(
          a.occurredAt,
        ),
    )[0]
}
```

---

# 34. 是否延期

```ts
export function isOrderDelayed(
  events: ReleaseEvent[],
) {
  return events.some(
    item => item.type === 'DELAY',
  )
}
```

---

# 35. Order DisplayStatus

建议统一放：

```text
src/utils/order-status.ts
```

```ts
export function getOrderDisplayStatus(
  order: Order,
): OrderDisplayStatus {
  if (order.status === 'CANCELLED') {
    return 'CANCELLED'
  }

  if (order.status === 'REFUNDED') {
    return 'REFUNDED'
  }

  if (order.status === 'ARCHIVED') {
    return 'ARCHIVED'
  }

  if (hasOverduePayment(order)) {
    return 'PAYMENT_OVERDUE'
  }

  if (hasPendingPayment(order)) {
    return 'WAITING_PAYMENT'
  }

  if (hasShipmentException(order)) {
    return 'SHIPMENT_EXCEPTION'
  }

  if (hasInTransitShipment(order)) {
    return 'IN_TRANSIT'
  }

  if (isWaitingShipment(order)) {
    return 'WAITING_SHIPMENT'
  }

  if (isWaitingRelease(order)) {
    return 'WAITING_RELEASE'
  }

  if (isDelivered(order)) {
    return 'COMPLETED'
  }

  return 'ACTIVE'
}
```

---

# 36. Timeline Model

```ts
export type TimelineSource =
  | 'ORDER'
  | 'PAYMENT'
  | 'RELEASE'
  | 'SHIPMENT'

export interface TimelineItem {
  id: string

  source: TimelineSource

  type: string

  title: string

  description?: string

  occurredAt: string

  metadata?: Record<string, unknown>
}
```

---

# 37. Timeline Mapper

将：

```text
payments
releaseEvents
shipments
orderEvents
```

合成：

```text
TimelineItem[]
```

然后：

```ts
items.sort(
  (a, b) =>
    b.occurredAt.localeCompare(
      a.occurredAt,
    ),
)
```

---

# 38. Query 参数与 URL 同步

订单列表建议：

```ts
interface OrderFilterState {
  keyword?: string

  status?: string

  platformId?: string

  storeId?: string

  paymentStatus?: string

  releaseStatus?: string

  isDelayed?: boolean

  page: number

  pageSize: number
}
```

与 Router Query 双向同步。

---

# 39. 页面数据管理

建议：

```text
Pinia
```

保存：

- 当前用户
- 主题
- 用户设置
- 订单筛选状态
- 列表视图模式

不建议 Pinia 保存：

- 整个订单详情
- 整个商品列表
- 全部统计数据

这些属于服务端状态。

---

# 40. 后续可接 TanStack Query

后续推荐：

```text
@tanstack/vue-query
```

处理：

- Cache
- staleTime
- retry
- invalidate
- optimistic update

V0.1 可以先不引入。

---

# 41. API Cache 刷新规则

例如标记付款成功后：

```text
invalidate:

order-detail
order-list
dashboard-summary
payment-statistics
calendar
```

如果不用 Vue Query，就统一触发页面 refresh。

---

# 42. Upload API

建议：

```ts
uploadProductCover({
  productId,
  file,
})

uploadOrderAttachment({
  orderId,
  file,
  type,
})
```

不要让页面自己拼 Storage Path。

统一放 API 层。

---

# 43. 文件上传路径

```ts
const path =
  `${userId}/${productId}/cover.webp`
```

订单附件：

```ts
const path =
  `${userId}/${orderId}/${crypto.randomUUID()}-${file.name}`
```

---

# 44. API 命名约定

查询：

```text
get...
list...
```

创建：

```text
create...
```

修改：

```text
update...
```

动作型业务：

```text
mark...
cancel...
refund...
delay...
archive...
```

避免：

```text
handleXxx
doXxx
submitXxx
```

出现在 API 层。

---

# 45. V0.1 必须完成的 API

```text
Auth

Product
├─ getProductList
├─ getProductDetail
├─ createProduct
└─ updateProduct

Order
├─ getOrderList
├─ getOrderDetail
├─ createOrder
└─ updateOrder

Payment
├─ createPayment
├─ updatePayment
└─ markPaymentPaid

Release
├─ delayRelease
└─ markReleased

Shipment
├─ createShipment
├─ updateShipmentStatus
└─ markShipmentDelivered

Platform
├─ getPlatforms
└─ getStores

Statistics
├─ getDashboardSummary
├─ getFuturePaymentMonthly
└─ getPaymentMonthlyStats
```

---

# 46. API 层验收

做到以下页面完全不直接写 Supabase 查询：

```text
OrderList
OrderCreate
OrderDetail
Dashboard
Calendar
Statistics
```

所有数据库访问都通过：

```text
src/api/*
```

即算 API 层设计达标。

---

# 47. 后端替换成本

如果以后增加 NestJS：

```text
Supabase Direct Query
↓
REST / RPC API
```

页面与业务 Model 基本不用重写。

只替换：

```text
src/api/*
```

即可。

这就是 V0.1 做 API 分层的主要价值。
