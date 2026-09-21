# HobiLog V0.1 TypeScript 类型与 REST API 层

> Vue3 只通过 NestJS API 访问业务数据。Supabase Client 在 Web 中主要用于 Auth，不直接 CRUD 订单、商品、付款等业务表。

## 1. 数据流

```text
Vue Form
↓
Web Request DTO
↓ Axios
NestJS DTO
↓
Service
↓
Prisma
↓
PostgreSQL
```

## 2. shared 包

```text
packages/shared/src/
├─ enums/
├─ types/
├─ constants/
└─ index.ts
```

共享稳定枚举、基础 API 类型和常量；不要共享 Prisma Model、Nest DTO Class、Vue FormModel。

## 3. 核心枚举

```ts
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

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'

export type ShipmentStatus =
  | 'WAITING'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'EXCEPTION'
  | 'RETURNED'
```

`OVERDUE` 为动态派生状态。

## 4. Web Model

```ts
export interface OrderModel {
  id: string
  orderNo?: string | null
  orderedAt: string
  currency: string
  totalAmount: number
  paymentMode: PaymentMode
  status: OrderStatus
  archived: boolean

  items: OrderItemModel[]
  payments: PaymentModel[]
  releaseEvents: ReleaseEventModel[]
  shipments: ShipmentModel[]
}
```

## 5. OrderFormModel

```ts
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

## 6. HTTP Client

```ts
import axios from 'axios'
import { supabase } from '@/lib/supabase'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

http.interceptors.request.use(async config => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.access_token) {
    config.headers.Authorization =
      `Bearer ${session.access_token}`
  }

  return config
})
```

## 7. Error Body

```json
{
  "statusCode": 400,
  "code": "INVALID_PAYMENT",
  "message": "付款节点不合法"
}
```

Prisma 及底层 `pg` 连接中断、连接超时统一返回 HTTP 503：

```json
{
  "statusCode": 503,
  "code": "DATABASE_UNAVAILABLE",
  "message": "数据库连接不可用"
}
```

## 8. Order API

```ts
export function getOrderList(params: OrderListParams) {
  return http.get('/orders', { params })
}

export function getOrderDetail(id: string) {
  return http.get(`/orders/${id}`)
}

export function createOrder(data: CreateOrderRequest) {
  return http.post('/orders', data)
}

export function updateOrder(
  id: string,
  data: UpdateOrderRequest,
) {
  return http.patch(`/orders/${id}`, data)
}

export function cancelOrder(id: string) {
  return http.post(`/orders/${id}/cancel`)
}
```

## 9. Payment API

```text
POST  /orders/:orderId/payments
PATCH /payments/:id
POST  /payments/:id/paid
POST  /payments/:id/refund
```

## 10. Release API

```text
POST /orders/:orderId/release/delay
POST /orders/:orderId/release/released
POST /orders/:orderId/release/store-arrived
```

## 11. Shipment API

```text
POST  /orders/:orderId/shipments
PATCH /shipments/:id
POST  /shipments/:id/delivered
```

## 12. Product API

```text
GET   /products
POST  /products
GET   /products/:id
PATCH /products/:id
POST  /products/:id/archive
```

- `GET /products` 支持 `page` / `pageSize` / `keyword`（名称 / 原名 / SKU）/ `category` / `ipName` / `characterName` / `manufacturer` / `status`（默认 `ACTIVE`）。
- `ProductVO` 的 `officialPrice` 为 `number | null`，`announcedAt` / `originalReleaseDate` 为 `YYYY-MM-DD`，`tagIds` 为标签 id 数组（请求用 `tagNames`）。
- 不存在或不属于当前用户的商品返回 `404 PRODUCT_NOT_FOUND`；归档后默认列表不再返回，需显式传 `status=ARCHIVED`。

## 13. Platform API

```text
GET    /platforms?page=&pageSize=&keyword=
POST   /platforms
POST   /platforms/presets
PATCH  /platforms/:id
DELETE /platforms/:id
```

`PlatformVO`：

```ts
{
  id: string
  name: string
  logoUrl: string | null
  website: string | null
  region: string | null
  defaultCurrency: string | null
  note: string | null
  createdAt: string      // ISO
  storeCount: number     // 关联店铺数
}
```

- `GET /platforms` 返回 `{ items, total, page, pageSize }`，按 `createdAt` 升序；`keyword` 匹配名称（不区分大小写）。
- `POST /platforms/presets` 幂等补齐 8 个预置平台（淘宝 / 京东 / Bilibili 会员购 / Hpoi / AmiAmi / Good Smile / 闲鱼 / 其他），返回 `{ created: number }`，已存在的不重复创建。
- 归属：全部接口按 Token 的 `userId` 隔离；同名平台返回 `409 CONFLICT`；不存在的平台（或不属于当前用户）返回 `404 PLATFORM_NOT_FOUND`。

## 14. Store API

```text
GET    /stores?page=&pageSize=&platformId=&keyword=
POST   /stores
PATCH  /stores/:id
DELETE /stores/:id
```

`StoreVO`：

```ts
{
  id: string
  name: string
  platformId: string | null
  platformName: string | null
  url: string | null
  contact: string | null
  note: string | null
  createdAt: string      // ISO
}
```

- `platformId` 可空（线下店）；传入时必须属于当前用户，否则 `404 PLATFORM_NOT_FOUND`。
- 不存在的店铺（或不属于当前用户）返回 `404 STORE_NOT_FOUND`；删除返回 `{ id }`。

## 15. Statistics API

```text
GET /statistics/dashboard
GET /statistics/payments/monthly
GET /statistics/payments/future
GET /statistics/categories
GET /statistics/platforms
GET /statistics/manufacturers
GET /statistics/ips
```

## 16. Attachment API

```text
POST   /attachments/upload-url
POST   /attachments
GET    /attachments/:id/url?expiresIn=
DELETE /attachments/:id
```

文件上传使用 signed URL，避免大文件必须经过 NestJS。bucket 固定为 `product-images` / `attachments`（均为私有，读取一律走签名 URL，`expiresIn` 默认 3600 秒、范围 60–604800）。MIME 白名单 `image/jpeg|png|webp|gif` + `application/pdf`，单文件 ≤ 10 MB；`storagePath` 固定 `${userId}/${targetId}/${uuid}-${safeFileName}`。

## 17. DisplayStatus

列表和详情接口建议直接返回：

```text
displayStatus
displayStatusLabel
nextPayment
paymentSummary
releaseSummary
shipmentSummary
```

后端是业务状态权威来源，前端只负责展示与轻量纯函数。

## 18. Timeline

详情接口建议直接返回：

```ts
timeline: TimelineItem[]
```

由 Server Mapper 聚合：

```text
Payment
ReleaseEvent
Shipment
OrderEvent
```

## 19. TanStack Query

推荐直接加入：

```bash
pnpm --filter web add @tanstack/vue-query
```

负责缓存、分页、Mutation 和 invalidate。

## 20. Mutation 刷新

标记付款成功：

```text
orders list
order detail
dashboard
statistics
calendar
```

新增物流成功：

```text
order detail
orders list
dashboard
```

## 21. Web API 目录

```text
apps/web/src/api/
├─ http.ts
├─ auth.api.ts
├─ product.api.ts
├─ order.api.ts
├─ payment.api.ts
├─ release.api.ts
├─ shipment.api.ts
├─ platform.api.ts
├─ store.api.ts
├─ attachment.api.ts
└─ statistics.api.ts
```

## 22. 验收标准

业务页面代码不应出现：

```text
supabase.from('orders')
supabase.from('payments')
supabase.rpc('create_order')
```

正常业务只能通过 NestJS API。

Web 中 Supabase SDK 主要保留：

```text
supabase.auth.*
```

以及 signed URL 文件上传。

## 23. Calendar API

```text
GET /calendar/events?from=&to=
```

`from` / `to` 必填（ISO8601，含首含尾）。返回 `CalendarEventVo[]`：

```ts
{
  id: string            // payment:<id> | release:<id> | delivery:<id>
  type: 'PAYMENT_DUE' | 'EXPECTED_RELEASE' | 'RELEASED' | 'DELIVERY'
  date: string          // YYYY-MM-DD
  orderId: string
  title: string
  amount: number | null
  currency: string | null
  precision: string | null
  displayStatus: string
}
```

- 来源：`Payment.dueAt`（`PENDING` / `PAID`）、`ReleaseEvent.newDate`（`EXPECTED_RELEASE` / `DELAY` / `RELEASED`）、`Shipment.deliveredAt ?? estimatedDeliveryAt`。
- `DELAY` 归一为 `EXPECTED_RELEASE` 类型，`datePrecision` 原样透传。
- 同一天按 `PAYMENT_DUE > DELIVERY > EXPECTED_RELEASE > RELEASED` 排序。
- 显式过滤当前用户，并排除 `archived = true` 的订单。

## 24. Collection API

```text
GET /collection?page=&pageSize=
GET /collection/stats
```

`CollectionItemVo`：

```ts
{
  orderItemId: string
  orderId: string
  productId: string
  name: string
  coverUrl: string | null
  quantity: number
  purchasePrice: number   // OrderItem.subtotal
  currency: string
  purchasedAt: string     // YYYY-MM-DD（Order.orderedAt）
  deliveredAt: string | null
}
```

- 收录口径：`Order` 未归档且存在 `status = DELIVERED` 的 `Shipment`；不新增业务表。
- `deliveredAt` 取该订单项所有已签收包裹中最早一次签收日，无则 `null`。
- `GET /collection/stats` 返回 `{ totalItems, deliveredOrders, byCurrency }`；`totalItems` 为 `OrderItem.quantity` 求和（docs/07 §64），`byCurrency` 按币种分开、不跨币种相加。

## 25. Notification API

```text
GET /notifications/todos
```

`ReminderVo[]`：

```ts
{
  id: string            // payment-overdue:<paymentId> | payment-soon:<paymentId> | release-month:<orderId> | release-delayed:<orderId> | stale:<orderId>
  kind: 'PAYMENT_DUE_SOON' | 'PAYMENT_OVERDUE' | 'RELEASE_THIS_MONTH' | 'RELEASE_DELAYED' | 'STALE_ORDER'
  orderId: string
  title: string
  dueAt: string | null       // YYYY-MM-DD
  daysLeft: number | null
  overdueDays: number | null
  amount: number | null
  currency: string | null
  priority: number
}
```

- 数据来源：`Order` 显式过滤 `userId`、`archived = false`、`status = ACTIVE`（docs/07 §71-72），最多取 200 条。
- 付款提醒（docs/07 §67-70）：仅 `Payment.status = PENDING` 且 `dueAt != null`；`dueAt < today` 为 `PAYMENT_OVERDUE`（`overdueDays` 为正），`daysLeft ∈ {7,3,1,0}` 为 `PAYMENT_DUE_SOON`。
- 出货提醒：计划出货日落在本月为 `RELEASE_THIS_MONTH`；`getDelayMonths > 0` 且尚未出货为 `RELEASE_DELAYED`。
- 长期未更新：`status = ACTIVE` 且 `updatedAt` 早于 30 天前为 `STALE_ORDER`。
- 排序：`priority` 升序（逾期 0 → 当天 1 → 1 天 2 → 3 天 3 → 7 天 4 → 本月出货 5 → 延期 6 → 长期未更新 9），同优先级按 `id` 字典序。
- V0.1 只提供查询接口，不做定时任务；调度绝不放 Vue（docs/08 §16）。
