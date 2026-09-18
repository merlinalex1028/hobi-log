# HobiLog V0.1 数据库 SQL 与核心页面原型

## 1. 技术前提

```text
Frontend
Vue 3 + TypeScript + Vite + Element Plus

Backend / Database
Supabase

Database
PostgreSQL

Storage
Supabase Storage

Auth
Supabase Auth
```

后续出现 OCR、邮件解析、定时提醒、物流同步等功能后，再增加 NestJS。

---

## 2. 数据库关系

```text
auth.users
    │
    ├── products
    │
    ├── platforms
    │      └── stores
    │
    └── orders
            │
            ├── order_items
            │       └── products
            ├── payments
            ├── release_events
            ├── shipments
            ├── order_events
            └── attachments
```

---

# 3. PostgreSQL Enum

```sql
create type payment_mode as enum (
  'FULL',
  'DEPOSIT_BALANCE',
  'INSTALLMENT',
  'CUSTOM'
);

create type payment_status as enum (
  'PENDING',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

create type shipment_status as enum (
  'WAITING',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'EXCEPTION',
  'RETURNED'
);

create type order_status as enum (
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'ARCHIVED'
);
```

---

# 4. platforms

```sql
create table public.platforms (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  name varchar(100) not null,
  logo_url text,
  website text,
  region varchar(50),
  default_currency varchar(10),
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(user_id, name)
);
```

---

# 5. stores

```sql
create table public.stores (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  platform_id uuid
    references public.platforms(id)
    on delete set null,

  name varchar(150) not null,
  url text,
  contact varchar(200),
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stores_user_id
on public.stores(user_id);

create index idx_stores_platform_id
on public.stores(platform_id);
```

---

# 6. products

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  name varchar(300) not null,
  original_name varchar(300),
  cover_url text,

  category varchar(50) not null default 'OTHER',

  ip_name varchar(150),
  character_name varchar(150),
  manufacturer varchar(150),
  series_name varchar(150),
  scale varchar(50),
  version varchar(150),
  sku varchar(100),

  official_price numeric(14, 2),
  official_currency varchar(10),

  announced_at date,
  original_release_date date,

  release_date_precision varchar(10)
    check (
      release_date_precision is null
      or release_date_precision in ('DAY', 'MONTH')
    ),

  description text,
  status varchar(30) default 'ACTIVE',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_user_id
on public.products(user_id);

create index idx_products_name
on public.products(name);

create index idx_products_ip
on public.products(ip_name);

create index idx_products_character
on public.products(character_name);

create index idx_products_manufacturer
on public.products(manufacturer);
```

---

# 7. orders

```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  platform_id uuid
    references public.platforms(id)
    on delete set null,

  store_id uuid
    references public.stores(id)
    on delete set null,

  order_no varchar(150),
  order_url text,
  ordered_at date not null,

  currency varchar(10) not null default 'CNY',

  goods_amount numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0,
  shipping_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  extra_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,

  payment_mode payment_mode not null,
  status order_status not null default 'ACTIVE',

  note text,
  archived boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_user_id
on public.orders(user_id);

create index idx_orders_ordered_at
on public.orders(ordered_at desc);

create index idx_orders_platform
on public.orders(platform_id);

create index idx_orders_store
on public.orders(store_id);

create index idx_orders_status
on public.orders(status);
```

---

# 8. order_items

```sql
create table public.order_items (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete restrict,

  quantity integer not null default 1
    check (quantity > 0),

  unit_price numeric(14, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0,

  note text,

  created_at timestamptz not null default now()
);

create index idx_order_items_order
on public.order_items(order_id);

create index idx_order_items_product
on public.order_items(product_id);
```

---

# 9. payments

```sql
create table public.payments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  type varchar(30) not null
    check (
      type in (
        'FULL',
        'DEPOSIT',
        'BALANCE',
        'INSTALLMENT',
        'SHIPPING',
        'TAX',
        'SUPPLEMENT',
        'REFUND',
        'OTHER'
      )
    ),

  name varchar(100),

  amount numeric(14, 2),

  currency varchar(10) not null default 'CNY',

  status payment_status not null default 'PENDING',

  expected_at date,
  due_at date,
  paid_at timestamptz,

  payment_method varchar(100),
  transaction_no varchar(150),

  note text,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_order
on public.payments(order_id);

create index idx_payments_status
on public.payments(status);

create index idx_payments_due
on public.payments(due_at);

create index idx_payments_paid
on public.payments(paid_at);
```

`amount` 允许为 `NULL`，支持“运费待定”等业务。

---

# 10. release_events

```sql
create table public.release_events (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  product_id uuid
    references public.products(id)
    on delete set null,

  type varchar(30) not null
    check (
      type in (
        'EXPECTED_RELEASE',
        'DELAY',
        'RELEASED',
        'STORE_ARRIVED',
        'BALANCE_OPEN',
        'SHIPMENT_READY'
      )
    ),

  old_date date,
  new_date date,

  date_precision varchar(10)
    check (
      date_precision is null
      or date_precision in ('DAY', 'MONTH')
    ),

  occurred_at timestamptz not null default now(),

  source varchar(100),
  source_url text,
  note text,

  created_at timestamptz not null default now()
);
```

---

# 11. shipments

```sql
create table public.shipments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  carrier varchar(100),
  tracking_no varchar(150),

  status shipment_status not null default 'WAITING',

  shipped_at timestamptz,
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,

  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

# 12. shipment_items

为了支持一个订单多商品、分批发货：

```sql
create table public.shipment_items (
  id uuid primary key default gen_random_uuid(),

  shipment_id uuid not null
    references public.shipments(id)
    on delete cascade,

  order_item_id uuid not null
    references public.order_items(id)
    on delete cascade,

  quantity integer not null default 1
    check (quantity > 0),

  created_at timestamptz not null default now(),

  unique(shipment_id, order_item_id)
);
```

---

# 13. order_events

```sql
create table public.order_events (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  type varchar(50) not null,

  title varchar(200) not null,
  description text,

  occurred_at timestamptz not null default now(),

  metadata jsonb,

  created_at timestamptz not null default now()
);
```

---

# 14. attachments

```sql
create table public.attachments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  order_id uuid
    references public.orders(id)
    on delete cascade,

  product_id uuid
    references public.products(id)
    on delete cascade,

  type varchar(30) not null default 'OTHER',

  file_name varchar(255) not null,
  file_url text not null,

  mime_type varchar(100),
  file_size bigint,

  created_at timestamptz not null default now()
);
```

---

# 15. tags

```sql
create table public.tags (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  name varchar(50) not null,

  created_at timestamptz not null default now(),

  unique(user_id, name)
);

create table public.product_tags (
  product_id uuid not null
    references public.products(id)
    on delete cascade,

  tag_id uuid not null
    references public.tags(id)
    on delete cascade,

  primary key(product_id, tag_id)
);
```

---

# 16. updated_at Trigger

```sql
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

给下列表增加 trigger：

- products
- orders
- payments
- shipments
- platforms
- stores

---

# 17. RLS

必须从第一天开启 RLS。

示例：

```sql
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.platforms enable row level security;
alter table public.stores enable row level security;
```

Product 示例：

```sql
create policy "users can read own products"
on public.products
for select
using (auth.uid() = user_id);

create policy "users can create own products"
on public.products
for insert
with check (auth.uid() = user_id);

create policy "users can update own products"
on public.products
for update
using (auth.uid() = user_id);

create policy "users can delete own products"
on public.products
for delete
using (auth.uid() = user_id);
```

子表如 payments 可通过 order 反查 user_id。

---

# 18. order_summary View

```sql
create view public.order_summary as
select
  o.id as order_id,
  o.user_id,
  o.total_amount,
  o.currency,

  coalesce(
    sum(
      case
        when p.status = 'PAID'
        and p.type <> 'REFUND'
        then p.amount
        else 0
      end
    ),
    0
  ) as paid_amount,

  coalesce(
    sum(
      case
        when p.status in ('PENDING', 'OVERDUE')
        then p.amount
        else 0
      end
    ),
    0
  ) as pending_amount,

  min(
    case
      when p.status in ('PENDING', 'OVERDUE')
      then p.due_at
    end
  ) as next_payment_due

from public.orders o

left join public.payments p
  on p.order_id = o.id

group by
  o.id,
  o.user_id,
  o.total_amount,
  o.currency;
```

---

# 19. 动态付款状态

付款状态不额外存一份 `PAID / PARTIALLY_PAID / UNPAID`，由 Payment 动态计算。

```ts
function getPaymentSummary(order: Order) {
  const validPayments = order.payments.filter(
    item => item.type !== 'REFUND'
  )

  const paidAmount = validPayments
    .filter(item => item.status === 'PAID')
    .reduce((sum, item) => sum + (item.amount ?? 0), 0)

  const pending = validPayments.filter(item =>
    ['PENDING', 'OVERDUE'].includes(item.status)
  )

  if (pending.some(item => item.status === 'OVERDUE')) {
    return 'OVERDUE'
  }

  if (!pending.length) {
    return 'PAID'
  }

  if (paidAmount > 0) {
    return 'PARTIALLY_PAID'
  }

  return 'UNPAID'
}
```

---

# 20. 动态逾期

V0.1 可以前端动态判断：

```ts
const isOverdue =
  payment.status === 'PENDING'
  &&
  payment.dueAt
  &&
  dayjs(payment.dueAt).isBefore(dayjs(), 'day')
```

后续再用定时任务更新数据库状态。

---

# 21. 订单列表原型

```text
┌────────────────────────────────────────────────────────────────┐
│ HobiLog                                      🔍   🔔   Avatar  │
├────────────┬───────────────────────────────────────────────────┤
│            │                                                   │
│ 首页       │  订单                                             │
│            │  管理所有正在等待到家的收藏                       │
│ 订单  ●    │                                   + 新建订单      │
│            │                                                   │
│ 商品库     │  [全部 128] [待付款 4] [待出货 21]                │
│            │  [运输中 3] [已完成 96]                           │
│ 收藏库     │                                                   │
│            │  🔍 搜索商品 / 订单号                              │
│ 日历       │                                                   │
│            │  [付款状态⌄] [出货状态⌄] [平台⌄] [更多筛选]      │
│ 统计       │                                                   │
│            │  ------------------------------------------------ │
│ 平台店铺   │                                                   │
│            │  商品       平台       金额      付款       出货  │
│ 设置       │                                                   │
│            │  [图] 芙宁娜  淘宝       ¥1299                    │
│            │       1/7      XX店       ¥300/1299               │
│            │                            23%      2027/05 延期   │
└────────────┴───────────────────────────────────────────────────┘
```

快速 Tab：

- 全部
- 待付款
- 待出货
- 运输中
- 已完成

高级筛选：

- 店铺
- IP
- 角色
- 厂商
- 商品类型
- 下单日期
- 预计出货
- 价格范围
- 是否延期

URL 保留筛选：

```text
/orders?paymentStatus=PENDING&platform=xxx&page=2
```

---

# 22. 新建订单原型

建议单页表单 + 右侧订单摘要。

```text
┌─────────────────────────────────────────────────────────────┐
│ ← 返回订单                                                  │
│                                                             │
│ 新建订单                                    [保存订单]      │
│                                                             │
├──────────────────────────────────────┬──────────────────────┤
│                                      │                      │
│ 商品                                 │ 订单摘要             │
│                                      │                      │
│ [图] 芙宁娜 1/7                      │ 商品金额   ¥1299     │
│     ALTER                            │ 优惠       ¥0        │
│     ¥1299 × 1                        │ 运费       ¥0        │
│                                      │ 税费       ¥0        │
│ [+ 添加商品]                         │                      │
│                                      │ ------------------   │
│ 订单信息                             │ 总计       ¥1299     │
│                                      │ 已支付     ¥300      │
│ 平台          [淘宝       ⌄]         │ 待支付     ¥999      │
│ 店铺          [XXX模型店  ⌄]         │                      │
│ 订单号        [____________]         │                      │
│ 下单日期      [2026-09-18]           │                      │
│                                      │                      │
│ 金额                                 │                      │
│ 商品金额      [1299]                 │                      │
│ 优惠          [0]                    │                      │
│ 运费          [0]                    │                      │
│                                      │                      │
│ 付款方式                             │                      │
│ [全款] [定金+尾款] [多阶段]         │                      │
│                                      │                      │
│ 定金 ¥300 已支付                     │                      │
│ 尾款 ¥999 截止 2027-03-20           │                      │
│                                      │                      │
│ 预计出货 [2027年05月]                │                      │
└──────────────────────────────────────┴──────────────────────┘
```

---

# 23. 商品选择

点击“添加商品”打开 `ProductSelector Drawer`：

- 搜索已有商品
- 最近商品
- 商品卡片
- 快速创建新商品

快速创建字段：

- 商品名称
- 封面
- 商品类型
- IP
- 角色
- 厂商
- 版本
- 比例

---

# 24. 金额计算

```text
goods_amount
=
SUM(order_item.unit_price × quantity)
```

```text
total_amount
=
goods_amount
- discount_amount
+ shipping_amount
+ tax_amount
+ extra_amount
```

允许关闭自动计算并手工覆盖商品金额。

---

# 25. 付款方式 UI

Radio Card：

```text
全款
一次付清

定金 + 尾款
普通预售

多阶段
GK 等

自定义
自由配置
```

定金尾款模式可自动生成两个 Payment。

多阶段模式支持拖拽排序。

如果付款节点合计与订单总额不一致，只警告、不阻止保存。

---

# 26. 未知金额

Payment 可勾选：

```text
☑ 金额待定
```

对应：

```text
amount = null
```

---

# 27. create_order RPC

建议新建订单使用 Postgres Function / RPC，避免前端多次 insert 造成脏数据。

前端提交：

```json
{
  "order": {},
  "items": [],
  "payments": [],
  "release": {}
}
```

数据库事务内：

```text
创建 Order
↓
创建 OrderItems
↓
创建 Payments
↓
创建 EXPECTED_RELEASE
↓
创建 ORDER_CREATED Event
```

任一步失败全部回滚。

---

# 28. 订单详情原型

```text
┌──────────────────────────────────────────────────────────────────┐
│ ← 订单                                                           │
│                                                                  │
│ 芙宁娜 1/7                             🟠 待补款                  │
│ 淘宝 · XXX手办店                                                │
│                                                                  │
│ [编辑] [更多⌄]                                                   │
├───────────────────────────────────────────┬──────────────────────┤
│                                           │                      │
│ 商品                                      │ 订单概览             │
│                                           │                      │
│ [图] 芙宁娜 1/7                           │ 总金额 ¥1299         │
│      ALTER                                │ 已支付 ¥300          │
│      原神 · 1/7 · ×1                     │ 待支付 ¥999          │
│                                           │                      │
│ 付款                                      │ 付款进度 23%         │
│ ¥300 / ¥1299                              │ 下一付款：尾款       │
│ ███░░░░░░░                                │ ¥999 · 03-20 截止   │
│                                           │                      │
│ ✓ 定金 ¥300 · 已支付                     │ [标记已付款]         │
│ ○ 尾款 ¥999 · 2027-03-20 截止            │                      │
│                                           │ 平台：淘宝           │
│ [+ 添加付款]                              │ 店铺：XXX手办店      │
│                                           │ 订单号：TBxxxx       │
│ 出货                                      │                      │
│ 预计 2027年05月                           │                      │
│ ⚠ 已延期2个月                             │                      │
│ 2027-01 → 2027-03 → 2027-05              │                      │
│ [更新预计出货]                            │                      │
│                                           │                      │
│ 物流                                      │                      │
│ 暂无物流                                  │                      │
│ [+ 添加物流]                              │                      │
│                                           │                      │
│ 时间轴                                    │                      │
│ ● 2027-01-05 厂商宣布延期                 │                      │
│ ● 2026-09-18 支付定金 ¥300                │                      │
│ ● 2026-09-18 创建订单                     │                      │
└───────────────────────────────────────────┴──────────────────────┘
```

---

# 29. DisplayStatus

建议优先级：

```text
订单取消
↓
付款逾期
↓
待付款
↓
运输异常
↓
运输中
↓
等待发货
↓
等待出货
↓
已完成
```

示例：

```ts
function getDisplayStatus(order: Order) {
  if (order.status === 'CANCELLED') {
    return 'CANCELLED'
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

  if (!isReleased(order)) {
    return 'WAITING_RELEASE'
  }

  if (isDelivered(order)) {
    return 'COMPLETED'
  }

  return 'ACTIVE'
}
```

---

# 30. 标记付款交互

Dialog：

```text
确认付款

付款节点：尾款
应付金额：¥999

实际付款金额 [999]
付款时间 [2027-03-18 21:12]
支付方式 [支付宝]
交易号 [可选]
备注 [可选]

取消     确认已付款
```

如果实际付款高于计划金额，默认：

```text
保持原尾款金额
+
创建补差价 Payment
```

---

# 31. 延期交互

```text
更新预计出货

当前预计：2027年03月
新的预计：[2027年05月]

变化：延期 2 个月

来源：[厂商公告]
来源链接：[可选]
备注：[可选]
```

保存后创建：

```text
ReleaseEvent(type = DELAY)
```

---

# 32. 物流交互

新增物流 Drawer：

- 物流公司
- 物流单号
- 发货时间
- 包含商品
- 备注

Shipment Card：

```text
顺丰
SF123456789
🔵 运输中
2027-05-18 发货
芙宁娜 1/7 ×1
```

---

# 33. 时间轴聚合

统一：

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

将 Payment / ReleaseEvent / Shipment / OrderEvent 转为 TimelineItem 后统一排序。

---

# 34. Dashboard 查询思路

待付款：

```sql
select
  p.*,
  o.order_no
from payments p
join orders o
  on o.id = p.order_id
where o.user_id = auth.uid()
  and p.status = 'PENDING'
order by p.due_at asc nulls last;
```

未来 30 天：

```sql
where
  due_at between current_date
  and current_date + interval '30 day'
```

未来付款按月：

```sql
select
  date_trunc('month', due_at) month,
  sum(amount) amount
from payments
where status = 'PENDING'
group by 1
order by 1;
```

实际消费按月：

```sql
select
  date_trunc('month', paid_at) month,
  sum(amount) amount
from payments
where status = 'PAID'
  and type <> 'REFUND'
group by 1
order by 1;
```

---

# 35. 退款

退款：

```text
Payment.type = REFUND
```

金额用正数记录，例如：

```text
REFUND 299
```

统计时：

```text
支出 - 退款
```

避免使用负数金额。

---

# 36. 前端 API 划分

```text
api/
├─ order.api.ts
├─ product.api.ts
├─ payment.api.ts
├─ release.api.ts
├─ shipment.api.ts
├─ platform.api.ts
└─ statistics.api.ts
```

Order API：

```ts
getOrderList(params)
getOrderDetail(id)
createOrder(data)
updateOrder(id, data)
cancelOrder(id)
deleteOrder(id)
duplicateOrder(id)
```

Payment API：

```ts
createPayment()
updatePayment()
markPaymentPaid()
refundPayment()
deletePayment()
```

Release API：

```ts
addExpectedRelease()
delayRelease()
markReleased()
markStoreArrived()
```

Shipment API：

```ts
createShipment()
updateShipment()
updateShipmentStatus()
markDelivered()
```

---

# 37. CreateOrderPayload

```ts
interface CreateOrderPayload {
  order: {
    platformId?: string
    storeId?: string
    orderNo?: string
    orderUrl?: string
    orderedAt: string
    currency: string
    goodsAmount: number
    discountAmount: number
    shippingAmount: number
    taxAmount: number
    extraAmount: number
    totalAmount: number
    paymentMode: PaymentMode
    note?: string
  }

  items: CreateOrderItem[]

  payments: CreatePayment[]

  expectedRelease?: {
    date: string
    precision: 'DAY' | 'MONTH'
  }
}
```

FormModel 与数据库类型分离。

---

# 38. Storage

建议 Bucket：

```text
product-images
attachments
```

路径：

```text
product-images:
userId/productId/cover.webp

attachments:
userId/orderId/uuid.png
```

图片建议：

- 最大 5MB
- JPEG / PNG / WEBP
- 前端压缩最长边 1600px

---

# 39. 初始平台数据

可以预设：

- 淘宝
- 京东
- Bilibili 会员购
- Hpoi
- AmiAmi
- Good Smile
- 闲鱼
- 其他

仍然保存为用户自己的数据，便于修改和删除。

---

# 40. 第一阶段开发任务

```text
01 初始化项目
02 Supabase Auth
03 数据库表
04 RLS
05 DefaultLayout
06 ProductSelector
07 ProductForm
08 OrderCreate
09 OrderList
10 OrderDetail
11 Payment 操作
12 Release 操作
13 Shipment 操作
```

做到第 13 项时，V0.1 已经具备完整可用的主链路。

第二阶段再做：

- Dashboard
- Calendar
- Statistics
- Collection
- Settings
