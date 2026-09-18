# HobiLog V0.1 详细设计

## 1. 产品定位

面向手办、GK、模型、动漫周边收藏用户的预售订单、付款、出货、物流和收藏管理工具。

核心链路：

```text
商品
 ↓
订单
 ↓
付款
 ↓
出货
 ↓
物流
 ↓
收藏
```

---

## 2. V0.1 页面结构

```text
首页

订单
├─ 全部订单
├─ 待付款
├─ 待出货
├─ 运输中
└─ 已完成

商品库
收藏库
日历
统计
平台 / 店铺
设置
```

桌面端优先，移动端第一版只保证基本可用。

---

## 3. 路由结构

```text
/
├─ /dashboard
├─ /orders
│   ├─ /orders
│   ├─ /orders/create
│   ├─ /orders/:id
│   └─ /orders/:id/edit
├─ /products
│   ├─ /products
│   ├─ /products/create
│   └─ /products/:id
├─ /collection
├─ /calendar
├─ /statistics
├─ /platforms
├─ /stores
└─ /settings
```

---

## 4. users

```ts
users {
  id: uuid
  username: string
  email: string
  avatar_url: string | null
  default_currency: string
  timezone: string
  created_at: timestamp
  updated_at: timestamp
}
```

---

## 5. products

```ts
products {
  id: uuid
  user_id: uuid

  name: string
  original_name: string | null
  cover_url: string | null

  category: ProductCategory

  ip_name: string | null
  character_name: string | null
  manufacturer: string | null
  series_name: string | null
  scale: string | null
  version: string | null
  sku: string | null

  official_price: decimal | null
  official_currency: string | null

  announced_at: date | null
  original_release_date: date | null

  description: text | null
  status: ProductStatus

  created_at: timestamp
  updated_at: timestamp
}
```

商品类型建议：

```ts
enum ProductCategory {
  SCALE_FIGURE
  PRIZE_FIGURE
  NENDOROID
  ACTION_FIGURE
  GK
  MODEL
  PLUSH
  ACRYLIC
  BADGE
  CARD
  BOOK
  OTHER
}
```

---

## 6. orders

```ts
orders {
  id: uuid
  user_id: uuid

  order_no: string | null

  platform_id: uuid | null
  store_id: uuid | null

  order_url: string | null
  ordered_at: date

  currency: string

  goods_amount: decimal
  discount_amount: decimal
  shipping_amount: decimal
  tax_amount: decimal
  extra_amount: decimal
  total_amount: decimal

  payment_mode: PaymentMode
  order_status: OrderStatus

  note: text | null
  archived: boolean

  created_at: timestamp
  updated_at: timestamp
}
```

---

## 7. PaymentMode

```ts
enum PaymentMode {
  FULL
  DEPOSIT_BALANCE
  INSTALLMENT
  CUSTOM
}
```

真正付款数据仍来自 `Payment[]`。

---

## 8. order_items

```ts
order_items {
  id: uuid

  order_id: uuid
  product_id: uuid

  quantity: integer
  unit_price: decimal
  subtotal: decimal

  note: string | null

  created_at: timestamp
}
```

---

## 9. payments

整个系统最重要的表之一。

```ts
payments {
  id: uuid

  order_id: uuid

  type: PaymentType
  name: string | null

  amount: decimal | null
  currency: string

  status: PaymentStatus

  expected_at: date | null
  due_at: date | null
  paid_at: timestamp | null

  payment_method: string | null
  transaction_no: string | null

  note: string | null
  sort_order: integer

  created_at: timestamp
  updated_at: timestamp
}
```

### PaymentType

```ts
enum PaymentType {
  FULL
  DEPOSIT
  BALANCE
  INSTALLMENT
  SHIPPING
  TAX
  SUPPLEMENT
  REFUND
  OTHER
}
```

### PaymentStatus

```ts
enum PaymentStatus {
  PENDING
  PAID
  OVERDUE
  CANCELLED
  REFUNDED
  PARTIALLY_REFUNDED
}
```

允许 `amount = null`，用来表达“运费待定”“补邮待定”。

---

## 10. 付款汇总

建议动态计算：

- 已支付金额
- 待支付金额
- 退款金额
- 实际支出
- 付款进度

不要冗余存储。

---

## 11. release_events

```ts
release_events {
  id: uuid

  order_id: uuid
  product_id: uuid | null

  type: ReleaseEventType

  old_date: date | null
  new_date: date | null

  occurred_at: timestamp

  source: string | null
  source_url: string | null

  note: text | null

  created_at: timestamp
}
```

```ts
enum ReleaseEventType {
  EXPECTED_RELEASE
  DELAY
  RELEASED
  STORE_ARRIVED
  BALANCE_OPEN
  SHIPMENT_READY
}
```

延期历史必须保留，不能覆盖旧值。

---

## 12. shipments

```ts
shipments {
  id: uuid

  order_id: uuid

  carrier: string | null
  tracking_no: string | null

  status: ShipmentStatus

  shipped_at: timestamp | null
  estimated_delivery_at: timestamp | null
  delivered_at: timestamp | null

  note: text | null

  created_at: timestamp
  updated_at: timestamp
}
```

```ts
enum ShipmentStatus {
  WAITING
  SHIPPED
  IN_TRANSIT
  DELIVERED
  EXCEPTION
  RETURNED
}
```

一个订单允许多个 `Shipment`。

---

## 13. order_events

```ts
order_events {
  id: uuid

  order_id: uuid

  type: OrderEventType

  title: string
  description: string | null

  occurred_at: timestamp

  metadata: jsonb | null

  created_at: timestamp
}
```

自动事件：

- 创建订单
- 付款完成
- 新增物流
- 物流签收
- 商品延期

手动事件：

- 联系店家
- 卖家反馈
- 补件备注
- 其他说明

---

## 14. platforms

```ts
platforms {
  id: uuid
  user_id: uuid

  name: string
  logo_url: string | null
  website: string | null
  region: string | null
  default_currency: string | null
  note: string | null

  created_at: timestamp
}
```

---

## 15. stores

```ts
stores {
  id: uuid

  user_id: uuid
  platform_id: uuid | null

  name: string
  url: string | null
  contact: string | null
  note: string | null

  created_at: timestamp
}
```

平台与店铺必须分开。

---

## 16. attachments

```ts
attachments {
  id: uuid

  user_id: uuid

  order_id: uuid | null
  product_id: uuid | null

  type: AttachmentType

  file_name: string
  file_url: string

  created_at: timestamp
}
```

附件类型：

- 商品图片
- 订单截图
- 补款截图
- 付款凭证
- 物流截图
- 聊天截图
- 其他

---

## 17. tags

建议：

```text
tags
product_tags
```

例如：

- 限定
- 特典版
- 会场限定
- 日版
- 国行
- 再版
- 首批
- 豪华版

---

## 18. Dashboard

结构：

```text
欢迎区域
统计卡片
待办
未来付款
预计出货
运输中
最近订单
```

KPI：

- 待付款
- 未来待付款
- 本月预计出货
- 运输中
- 收藏数量

待办优先级：

```text
逾期 > 1天内 > 3天内 > 7天内 > 普通
```

---

## 19. 订单页

顶部：

- 订单总数
- 新建订单按钮
- 快速状态 Tab
- 搜索
- 条件筛选
- 表格 / 卡片切换

表格列：

- 商品
- 平台 / 店铺
- 订单金额
- 付款情况
- 预计出货
- 物流
- 下单时间
- 操作

付款进度示例：

```text
¥300 / ¥1299

████░░░░░░

23%
```

---

## 20. 新建订单

建议独立页面。

结构：

- 商品信息
- 订单信息
- 金额
- 付款方式
- 出货信息
- 备注附件
- 右侧订单摘要

### 商品选择

支持：

- 搜索已有商品
- 快速创建商品
- 一个订单添加多个商品

### 金额

```text
商品金额
优惠
运费
税费
其他费用
────────
订单总额
```

### 付款方式

```text
全款
定金 + 尾款
多阶段付款
自定义付款
```

多阶段付款允许拖拽排序、编辑、删除。

---

## 21. 预计出货精度

支持：

```text
DAY
MONTH
```

因为很多厂商只给“2027 年 3 月”而非具体日期。

---

## 22. 订单详情

推荐：

```text
左侧主内容 + 右侧状态栏
```

左侧：

- 商品信息
- 付款
- 出货
- 物流
- 时间轴
- 附件

右侧：

- 当前业务状态
- 总金额
- 已支付
- 待支付
- 下一付款
- 平台
- 店铺
- 订单号
- 快捷操作

---

## 23. 标记付款

点击“标记已支付”：

- 实际付款金额
- 付款时间
- 支付方式
- 交易号
- 备注

提交后：

```text
Payment.status → PAID
```

并生成相关事件。

---

## 24. 延期

“更新预计出货”不覆盖旧日期。

创建：

```text
ReleaseEvent(type = DELAY)
```

字段：

- 原预计
- 新预计
- 原因
- 来源
- 来源链接
- 备注

---

## 25. 物流

新增物流字段：

- 物流公司
- 物流单号
- 发货时间
- 包含商品
- 备注

支持多个包裹。

---

## 26. 时间轴

统一映射：

```ts
interface TimelineItem {
  id: string
  type: string
  title: string
  description?: string
  occurredAt: string
  icon?: string
  source: 'ORDER' | 'PAYMENT' | 'RELEASE' | 'SHIPMENT'
}
```

按 `occurredAt DESC` 排序。

---

## 27. 日历

使用 FullCalendar。

展示：

- 尾款截止
- 预计出货
- 延期后的出货
- 实际出货
- 预计到货

点击事件打开 Drawer 查看详情并跳转订单。

---

## 28. 收藏库

第一版可以将：

```text
Shipment = DELIVERED
且 Order 未取消
```

视为进入收藏。

后续再增加独立 `collections` 表管理：

- 未拆
- 已拆
- 展示中
- 收纳
- 已出售
- 已转让
- 展示柜
- 收纳位置

---

## 29. 统计

核心指标：

- 累计消费
- 今年消费
- 未来待付款
- 收藏数量

趋势使用 `Payment.paid_at` 统计现金流。

分类维度：

- 商品类型
- IP
- 厂商
- 平台

未来付款压力建议做未来 6~12 个月柱状图。

---

## 30. 多币种

V0.1 支持：

```text
CNY
JPY
USD
HKD
```

订单保留原始币种。

暂不自动换汇。

后续增加：

- 支付时人民币金额
- 汇率
- 原币金额

---

## 31. 正式技术栈

### Web

```text
Vue 3
TypeScript
Vite
Vue Router
Pinia
Element Plus
ECharts
FullCalendar
VueUse
dayjs
Zod
Axios
TanStack Query（推荐）
```

### Server

```text
NestJS
TypeScript
Prisma
class-validator / class-transformer
Supabase JWT Guard
Swagger / OpenAPI
```

### Infrastructure

```text
Supabase Auth
Supabase PostgreSQL
Supabase Storage
```

前端只直接使用 Supabase Auth 完成登录并取得 Access Token。

所有 HobiLog 业务数据通过：

```text
Vue → NestJS REST API → Prisma → PostgreSQL
```

访问。

## 32. 推荐 Monorepo 目录结构

```text
hobilog/

├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ api/
│  │  │  ├─ assets/
│  │  │  ├─ components/
│  │  │  ├─ composables/
│  │  │  ├─ constants/
│  │  │  ├─ layouts/
│  │  │  ├─ pages/
│  │  │  ├─ router/
│  │  │  ├─ stores/
│  │  │  ├─ types/
│  │  │  └─ utils/
│  │  └─ package.json
│  │
│  └─ server/
│     ├─ src/
│     │  ├─ common/
│     │  ├─ config/
│     │  ├─ database/
│     │  ├─ modules/
│     │  │  ├─ auth/
│     │  │  ├─ product/
│     │  │  ├─ order/
│     │  │  ├─ payment/
│     │  │  ├─ release/
│     │  │  ├─ shipment/
│     │  │  ├─ platform/
│     │  │  ├─ store/
│     │  │  ├─ attachment/
│     │  │  ├─ statistics/
│     │  │  └─ notification/
│     │  ├─ app.module.ts
│     │  └─ main.ts
│     └─ package.json
│
├─ packages/
│  └─ shared/
│     └─ src/
│        ├─ enums/
│        ├─ types/
│        ├─ constants/
│        └─ schemas/
│
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
│
├─ docs/
├─ pnpm-workspace.yaml
└─ package.json
```

核心原则：

```text
apps/web
只负责前端。

apps/server
拥有业务逻辑、鉴权与数据库事务。

packages/shared
保存前后端共同使用的稳定枚举、类型和常量。

prisma
是业务数据库 Schema 与 Migration 的主要来源。
```

## 33. Pinia 原则

Pinia 只保存：

- 用户
- 全局配置
- 筛选条件
- 页面布局
- 用户偏好

服务端业务数据尽量从 API / Supabase 获取。

后续可引入 TanStack Query for Vue。

---

## 34. 后端业务层职责

NestJS 不只是数据库代理层。

核心职责：

```text
AuthGuard
验证 Supabase Access Token，并把 userId 注入 Request。

OrderService
创建 / 编辑 / 取消订单，维护 OrderItem 和付款节点事务。

PaymentService
标记付款、退款、补差价、计算付款状态。

ReleaseService
预计出货、延期、厂商出货、店铺到货。

ShipmentService
物流、拆单、签收、物流状态。

StatisticsService
Dashboard 与统计聚合。

AttachmentService
生成上传签名、附件元数据和删除逻辑。

NotificationService
后续负责尾款提醒、邮件、Bark / Telegram 等。
```

所有查询都必须绑定当前：

```text
userId
```

避免依赖前端传入用户 ID。


## 35. 核心 TypeScript 类型

```ts
export interface Order {
  id: string
  orderNo?: string
  platformId?: string
  storeId?: string
  orderedAt: string
  currency: string
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
  totalAmount: number
  paymentMode: PaymentMode
  items: OrderItem[]
  payments: Payment[]
  shipments: Shipment[]
  releaseEvents: ReleaseEvent[]
  note?: string
}
```

```ts
export interface Payment {
  id: string
  orderId: string
  type: PaymentType
  name?: string
  amount?: number
  currency: string
  status: PaymentStatus
  expectedAt?: string
  dueAt?: string
  paidAt?: string
  note?: string
}
```

---

## 35. 核心工具函数

统一放在 utils / composables，不要散落页面：

```text
getPaidAmount(order)
getPendingAmount(order)
getPaymentProgress(order)
getOrderPaymentStatus(order)
getNextPayment(order)
getLatestReleaseDate(order)
getDelayMonths(order)
getDisplayStatus(order)
```

---

## 36. DisplayStatus 优先级

建议：

```text
付款逾期
>
待付款
>
运输异常
>
运输中
>
待发货
>
等待出货
>
已完成
```

业务展示状态优先于底层 `orders.status`。

---

## 37. 提醒规则

第一版：

- 截止前 7 天
- 截止前 3 天
- 截止前 1 天
- 当天
- 已逾期

用户可配置提醒提前量。

---

## 38. UI 风格

建议：

**日系收藏感 + 轻后台管理**

特点：

- 白 / 米白背景
- 浅灰边框
- 圆角 10~14px
- 大商品图片
- 页面留白较多
- 状态使用 Tag、小圆点和图标，不大面积上色

状态色建议：

- 待付款：橙
- 逾期：红
- 等待出货：紫
- 运输中：蓝
- 已完成：绿
- 取消：灰

---

## 39. V0.1 开发阶段

### Phase 1 基础工程

- Vue3 项目
- Router
- Layout
- Supabase
- Auth
- 基础字典

### Phase 2 商品

- 商品列表
- 创建商品
- 商品编辑
- 图片上传

### Phase 3 订单

- 创建
- 列表
- 详情
- 编辑

### Phase 4 付款

- 全款
- 定金尾款
- 多阶段
- 付款状态
- 待付款计算

### Phase 5 出货

- 预计出货
- 延期
- 出货时间轴

### Phase 6 物流

- 物流新增
- 状态更新
- 签收

### Phase 7 Dashboard

- 待付款
- 未来付款
- 预计出货
- 运输中

### Phase 8 日历

- 付款截止
- 预计出货

### Phase 9 统计

- 消费趋势
- 分类
- IP
- 厂商
- 平台
- 未来待付款

---

## 40. 首版最小闭环

```text
新增商品
↓
创建订单
↓
选择付款模式
↓
记录预计出货
↓
延期时更新
↓
付款
↓
店铺发货
↓
签收
↓
进入收藏
```

三条业务链必须跑通：

### 全款现货

```text
创建 → 发货 → 签收
```

### 定金预售

```text
支付定金
→ 等待补款
→ 支付尾款
→ 延期
→ 厂商出货
→ 店铺发货
→ 签收
```

### GK

```text
首款
→ 二阶段款
→ 尾款
→ 补邮
→ 发货
→ 签收
```

---

## 41. 三个核心边界

必须坚持：

```text
Order ≠ Payment
Release ≠ Shipment
Product ≠ Order
```

这三个边界稳定后，后续扩展成本会低很多。
