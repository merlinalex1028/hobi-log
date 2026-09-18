# HobiLog V0.1 Supabase 完整 Migration 与 RPC

> 本文档用于将 HobiLog V0.1 的数据库设计落成可直接在 Supabase / PostgreSQL 中执行的 Migration 草案。

---

# 1. 目标

本 Migration 覆盖：

- Enum
- 核心数据表
- 索引
- `updated_at` Trigger
- Row Level Security
- RLS Policy
- `order_summary` View
- `create_order` RPC
- 常用统计 RPC
- 初始化平台数据建议
- 执行顺序
- 开发注意事项

---

# 2. 前置说明

以下 SQL 假设：

```text
PostgreSQL
Supabase Auth
public schema
auth.users
```

Supabase 默认已经提供：

```sql
gen_random_uuid()
```

因此 UUID 默认值可以直接使用：

```sql
default gen_random_uuid()
```

---

# 3. Migration 001：Enum

建议文件：

```text
supabase/migrations/
001_create_enums.sql
```

内容：

```sql
create type public.payment_mode as enum (
  'FULL',
  'DEPOSIT_BALANCE',
  'INSTALLMENT',
  'CUSTOM'
);

create type public.payment_status as enum (
  'PENDING',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

create type public.shipment_status as enum (
  'WAITING',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'EXCEPTION',
  'RETURNED'
);

create type public.order_status as enum (
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'ARCHIVED'
);
```

---

# 4. Migration 002：platforms / stores

建议文件：

```text
002_create_platforms_stores.sql
```

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


create index idx_platforms_user_id
on public.platforms(user_id);


create index idx_stores_user_id
on public.stores(user_id);


create index idx_stores_platform_id
on public.stores(platform_id);
```

---

# 5. Migration 003：products

建议文件：

```text
003_create_products.sql
```

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

  status varchar(30) not null default 'ACTIVE',

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

# 6. Migration 004：orders / order_items

建议文件：

```text
004_create_orders.sql
```

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

  payment_mode public.payment_mode not null,

  status public.order_status not null default 'ACTIVE',

  note text,

  archived boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


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


create index idx_orders_user_id
on public.orders(user_id);


create index idx_orders_ordered_at
on public.orders(ordered_at desc);


create index idx_orders_platform_id
on public.orders(platform_id);


create index idx_orders_store_id
on public.orders(store_id);


create index idx_orders_status
on public.orders(status);


create index idx_order_items_order_id
on public.order_items(order_id);


create index idx_order_items_product_id
on public.order_items(product_id);
```

---

# 7. Migration 005：payments

建议文件：

```text
005_create_payments.sql
```

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

  status public.payment_status not null default 'PENDING',

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


create index idx_payments_order_id
on public.payments(order_id);


create index idx_payments_status
on public.payments(status);


create index idx_payments_due_at
on public.payments(due_at);


create index idx_payments_paid_at
on public.payments(paid_at);
```

---

# 8. Migration 006：release_events

建议文件：

```text
006_create_release_events.sql
```

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


create index idx_release_events_order_id
on public.release_events(order_id);


create index idx_release_events_product_id
on public.release_events(product_id);


create index idx_release_events_type
on public.release_events(type);


create index idx_release_events_occurred_at
on public.release_events(occurred_at desc);
```

---

# 9. Migration 007：shipments / shipment_items

建议文件：

```text
007_create_shipments.sql
```

```sql
create table public.shipments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  carrier varchar(100),

  tracking_no varchar(150),

  status public.shipment_status not null default 'WAITING',

  shipped_at timestamptz,

  estimated_delivery_at timestamptz,

  delivered_at timestamptz,

  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


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


create index idx_shipments_order_id
on public.shipments(order_id);


create index idx_shipments_status
on public.shipments(status);


create index idx_shipments_tracking_no
on public.shipments(tracking_no);


create index idx_shipment_items_shipment_id
on public.shipment_items(shipment_id);


create index idx_shipment_items_order_item_id
on public.shipment_items(order_item_id);
```

---

# 10. Migration 008：order_events

建议文件：

```text
008_create_order_events.sql
```

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


create index idx_order_events_order_id
on public.order_events(order_id);


create index idx_order_events_occurred_at
on public.order_events(occurred_at desc);
```

---

# 11. Migration 009：attachments

建议文件：

```text
009_create_attachments.sql
```

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


create index idx_attachments_user_id
on public.attachments(user_id);


create index idx_attachments_order_id
on public.attachments(order_id);


create index idx_attachments_product_id
on public.attachments(product_id);
```

---

# 12. Migration 010：tags / product_tags

建议文件：

```text
010_create_tags.sql
```

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


create index idx_tags_user_id
on public.tags(user_id);


create index idx_product_tags_tag_id
on public.product_tags(tag_id);
```

---

# 13. Migration 011：updated_at Trigger

建议文件：

```text
011_create_updated_at_triggers.sql
```

```sql
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


create trigger trg_platforms_updated_at
before update on public.platforms
for each row
execute function public.update_updated_at_column();


create trigger trg_stores_updated_at
before update on public.stores
for each row
execute function public.update_updated_at_column();


create trigger trg_products_updated_at
before update on public.products
for each row
execute function public.update_updated_at_column();


create trigger trg_orders_updated_at
before update on public.orders
for each row
execute function public.update_updated_at_column();


create trigger trg_payments_updated_at
before update on public.payments
for each row
execute function public.update_updated_at_column();


create trigger trg_shipments_updated_at
before update on public.shipments
for each row
execute function public.update_updated_at_column();
```

---

# 14. Migration 012：开启 RLS

建议文件：

```text
012_enable_rls.sql
```

```sql
alter table public.platforms enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.release_events enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_items enable row level security;
alter table public.order_events enable row level security;
alter table public.attachments enable row level security;
alter table public.tags enable row level security;
alter table public.product_tags enable row level security;
```

---

# 15. Migration 013：顶层表 RLS Policy

建议文件：

```text
013_create_top_level_rls.sql
```

---

## 15.1 platforms

```sql
create policy "platforms_select_own"
on public.platforms
for select
using (
  auth.uid() = user_id
);

create policy "platforms_insert_own"
on public.platforms
for insert
with check (
  auth.uid() = user_id
);

create policy "platforms_update_own"
on public.platforms
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "platforms_delete_own"
on public.platforms
for delete
using (
  auth.uid() = user_id
);
```

---

## 15.2 stores

```sql
create policy "stores_select_own"
on public.stores
for select
using (
  auth.uid() = user_id
);

create policy "stores_insert_own"
on public.stores
for insert
with check (
  auth.uid() = user_id
);

create policy "stores_update_own"
on public.stores
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "stores_delete_own"
on public.stores
for delete
using (
  auth.uid() = user_id
);
```

---

## 15.3 products

```sql
create policy "products_select_own"
on public.products
for select
using (
  auth.uid() = user_id
);

create policy "products_insert_own"
on public.products
for insert
with check (
  auth.uid() = user_id
);

create policy "products_update_own"
on public.products
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "products_delete_own"
on public.products
for delete
using (
  auth.uid() = user_id
);
```

---

## 15.4 orders

```sql
create policy "orders_select_own"
on public.orders
for select
using (
  auth.uid() = user_id
);

create policy "orders_insert_own"
on public.orders
for insert
with check (
  auth.uid() = user_id
);

create policy "orders_update_own"
on public.orders
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "orders_delete_own"
on public.orders
for delete
using (
  auth.uid() = user_id
);
```

---

## 15.5 attachments

```sql
create policy "attachments_select_own"
on public.attachments
for select
using (
  auth.uid() = user_id
);

create policy "attachments_insert_own"
on public.attachments
for insert
with check (
  auth.uid() = user_id
);

create policy "attachments_update_own"
on public.attachments
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "attachments_delete_own"
on public.attachments
for delete
using (
  auth.uid() = user_id
);
```

---

## 15.6 tags

```sql
create policy "tags_select_own"
on public.tags
for select
using (
  auth.uid() = user_id
);

create policy "tags_insert_own"
on public.tags
for insert
with check (
  auth.uid() = user_id
);

create policy "tags_update_own"
on public.tags
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "tags_delete_own"
on public.tags
for delete
using (
  auth.uid() = user_id
);
```

---

# 16. Migration 014：订单子表 RLS

建议文件：

```text
014_create_child_table_rls.sql
```

对于：

- order_items
- payments
- release_events
- shipments
- order_events

统一通过 `orders.user_id` 判断归属。

---

## 16.1 order_items

```sql
create policy "order_items_select_own"
on public.order_items
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

create policy "order_items_insert_own"
on public.order_items
for insert
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

create policy "order_items_update_own"
on public.order_items
for update
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

create policy "order_items_delete_own"
on public.order_items
for delete
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);
```

---

## 16.2 payments

```sql
create policy "payments_select_own"
on public.payments
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and o.user_id = auth.uid()
  )
);

create policy "payments_insert_own"
on public.payments
for insert
with check (
  exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and o.user_id = auth.uid()
  )
);

create policy "payments_update_own"
on public.payments
for update
using (
  exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and o.user_id = auth.uid()
  )
);

create policy "payments_delete_own"
on public.payments
for delete
using (
  exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and o.user_id = auth.uid()
  )
);
```

---

## 16.3 release_events

```sql
create policy "release_events_select_own"
on public.release_events
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = release_events.order_id
      and o.user_id = auth.uid()
  )
);

create policy "release_events_insert_own"
on public.release_events
for insert
with check (
  exists (
    select 1
    from public.orders o
    where o.id = release_events.order_id
      and o.user_id = auth.uid()
  )
);

create policy "release_events_update_own"
on public.release_events
for update
using (
  exists (
    select 1
    from public.orders o
    where o.id = release_events.order_id
      and o.user_id = auth.uid()
  )
);

create policy "release_events_delete_own"
on public.release_events
for delete
using (
  exists (
    select 1
    from public.orders o
    where o.id = release_events.order_id
      and o.user_id = auth.uid()
  )
);
```

---

## 16.4 shipments

```sql
create policy "shipments_select_own"
on public.shipments
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = shipments.order_id
      and o.user_id = auth.uid()
  )
);

create policy "shipments_insert_own"
on public.shipments
for insert
with check (
  exists (
    select 1
    from public.orders o
    where o.id = shipments.order_id
      and o.user_id = auth.uid()
  )
);

create policy "shipments_update_own"
on public.shipments
for update
using (
  exists (
    select 1
    from public.orders o
    where o.id = shipments.order_id
      and o.user_id = auth.uid()
  )
);

create policy "shipments_delete_own"
on public.shipments
for delete
using (
  exists (
    select 1
    from public.orders o
    where o.id = shipments.order_id
      and o.user_id = auth.uid()
  )
);
```

---

## 16.5 order_events

```sql
create policy "order_events_select_own"
on public.order_events
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_events.order_id
      and o.user_id = auth.uid()
  )
);

create policy "order_events_insert_own"
on public.order_events
for insert
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_events.order_id
      and o.user_id = auth.uid()
  )
);

create policy "order_events_update_own"
on public.order_events
for update
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_events.order_id
      and o.user_id = auth.uid()
  )
);

create policy "order_events_delete_own"
on public.order_events
for delete
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_events.order_id
      and o.user_id = auth.uid()
  )
);
```

---

# 17. shipment_items RLS

`shipment_items` 通过：

```text
shipment
→
order
→
user
```

判断。

```sql
create policy "shipment_items_select_own"
on public.shipment_items
for select
using (
  exists (
    select 1
    from public.shipments s
    join public.orders o
      on o.id = s.order_id
    where s.id = shipment_items.shipment_id
      and o.user_id = auth.uid()
  )
);

create policy "shipment_items_insert_own"
on public.shipment_items
for insert
with check (
  exists (
    select 1
    from public.shipments s
    join public.orders o
      on o.id = s.order_id
    where s.id = shipment_items.shipment_id
      and o.user_id = auth.uid()
  )
);

create policy "shipment_items_update_own"
on public.shipment_items
for update
using (
  exists (
    select 1
    from public.shipments s
    join public.orders o
      on o.id = s.order_id
    where s.id = shipment_items.shipment_id
      and o.user_id = auth.uid()
  )
);

create policy "shipment_items_delete_own"
on public.shipment_items
for delete
using (
  exists (
    select 1
    from public.shipments s
    join public.orders o
      on o.id = s.order_id
    where s.id = shipment_items.shipment_id
      and o.user_id = auth.uid()
  )
);
```

---

# 18. product_tags RLS

`product_tags` 同样通过 Product 判断。

```sql
create policy "product_tags_select_own"
on public.product_tags
for select
using (
  exists (
    select 1
    from public.products p
    where p.id = product_tags.product_id
      and p.user_id = auth.uid()
  )
);

create policy "product_tags_insert_own"
on public.product_tags
for insert
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_tags.product_id
      and p.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = product_tags.tag_id
      and t.user_id = auth.uid()
  )
);

create policy "product_tags_delete_own"
on public.product_tags
for delete
using (
  exists (
    select 1
    from public.products p
    where p.id = product_tags.product_id
      and p.user_id = auth.uid()
  )
);
```

---

# 19. Migration 015：order_summary View

建议文件：

```text
015_create_order_summary_view.sql
```

```sql
create or replace view public.order_summary
with (security_invoker = true)
as
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
          and p.amount is not null
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
          and p.amount is not null
        then p.amount
        else 0
      end
    ),
    0
  ) as pending_amount,

  coalesce(
    sum(
      case
        when p.type = 'REFUND'
          and p.status = 'PAID'
          and p.amount is not null
        then p.amount
        else 0
      end
    ),
    0
  ) as refunded_amount,

  min(
    case
      when p.status in ('PENDING', 'OVERDUE')
      then p.due_at
      else null
    end
  ) as next_payment_due,

  count(*) filter (
    where p.status in ('PENDING', 'OVERDUE')
  ) as pending_payment_count

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

# 20. Migration 016：创建订单 RPC

这是第一版最重要的 RPC。

前端不要：

```text
insert orders
insert order_items
insert payments
insert release_events
```

分别请求。

应该一次调用：

```text
create_order
```

保证事务一致性。

---

# 21. create_order 入参设计

前端提交 JSON：

```json
{
  "order": {
    "platform_id": null,
    "store_id": null,
    "order_no": "TB123456",
    "order_url": "https://example.com",
    "ordered_at": "2026-09-18",
    "currency": "CNY",
    "goods_amount": 1299,
    "discount_amount": 0,
    "shipping_amount": 0,
    "tax_amount": 0,
    "extra_amount": 0,
    "total_amount": 1299,
    "payment_mode": "DEPOSIT_BALANCE",
    "note": null
  },
  "items": [
    {
      "product_id": "00000000-0000-0000-0000-000000000000",
      "quantity": 1,
      "unit_price": 1299,
      "subtotal": 1299,
      "note": null
    }
  ],
  "payments": [
    {
      "type": "DEPOSIT",
      "name": "定金",
      "amount": 300,
      "currency": "CNY",
      "status": "PAID",
      "paid_at": "2026-09-18T12:00:00+08:00",
      "sort_order": 1
    },
    {
      "type": "BALANCE",
      "name": "尾款",
      "amount": 999,
      "currency": "CNY",
      "status": "PENDING",
      "due_at": "2027-03-20",
      "sort_order": 2
    }
  ],
  "expected_release": {
    "date": "2027-05-01",
    "precision": "MONTH"
  }
}
```

---

# 22. create_order RPC SQL

建议文件：

```text
016_create_order_rpc.sql
```

```sql
create or replace function public.create_order(
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_order_id uuid;

  v_item jsonb;
  v_payment jsonb;

  v_expected_release jsonb;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  insert into public.orders (
    user_id,
    platform_id,
    store_id,
    order_no,
    order_url,
    ordered_at,
    currency,
    goods_amount,
    discount_amount,
    shipping_amount,
    tax_amount,
    extra_amount,
    total_amount,
    payment_mode,
    note
  )
  values (
    v_user_id,

    nullif(p_payload->'order'->>'platform_id', '')::uuid,

    nullif(p_payload->'order'->>'store_id', '')::uuid,

    nullif(p_payload->'order'->>'order_no', ''),

    nullif(p_payload->'order'->>'order_url', ''),

    (p_payload->'order'->>'ordered_at')::date,

    coalesce(
      nullif(p_payload->'order'->>'currency', ''),
      'CNY'
    ),

    coalesce(
      (p_payload->'order'->>'goods_amount')::numeric,
      0
    ),

    coalesce(
      (p_payload->'order'->>'discount_amount')::numeric,
      0
    ),

    coalesce(
      (p_payload->'order'->>'shipping_amount')::numeric,
      0
    ),

    coalesce(
      (p_payload->'order'->>'tax_amount')::numeric,
      0
    ),

    coalesce(
      (p_payload->'order'->>'extra_amount')::numeric,
      0
    ),

    coalesce(
      (p_payload->'order'->>'total_amount')::numeric,
      0
    ),

    (p_payload->'order'->>'payment_mode')::public.payment_mode,

    nullif(p_payload->'order'->>'note', '')
  )
  returning id
  into v_order_id;


  for v_item in
    select *
    from jsonb_array_elements(
      coalesce(
        p_payload->'items',
        '[]'::jsonb
      )
    )
  loop
    insert into public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      subtotal,
      note
    )
    values (
      v_order_id,

      (v_item->>'product_id')::uuid,

      coalesce(
        (v_item->>'quantity')::integer,
        1
      ),

      coalesce(
        (v_item->>'unit_price')::numeric,
        0
      ),

      coalesce(
        (v_item->>'subtotal')::numeric,
        0
      ),

      nullif(v_item->>'note', '')
    );
  end loop;


  for v_payment in
    select *
    from jsonb_array_elements(
      coalesce(
        p_payload->'payments',
        '[]'::jsonb
      )
    )
  loop
    insert into public.payments (
      order_id,
      type,
      name,
      amount,
      currency,
      status,
      expected_at,
      due_at,
      paid_at,
      payment_method,
      transaction_no,
      note,
      sort_order
    )
    values (
      v_order_id,

      v_payment->>'type',

      nullif(v_payment->>'name', ''),

      case
        when v_payment ? 'amount'
          and v_payment->>'amount' is not null
          and v_payment->>'amount' <> ''
        then (v_payment->>'amount')::numeric
        else null
      end,

      coalesce(
        nullif(v_payment->>'currency', ''),
        p_payload->'order'->>'currency',
        'CNY'
      ),

      coalesce(
        nullif(v_payment->>'status', '')::public.payment_status,
        'PENDING'::public.payment_status
      ),

      case
        when nullif(v_payment->>'expected_at', '') is not null
        then (v_payment->>'expected_at')::date
        else null
      end,

      case
        when nullif(v_payment->>'due_at', '') is not null
        then (v_payment->>'due_at')::date
        else null
      end,

      case
        when nullif(v_payment->>'paid_at', '') is not null
        then (v_payment->>'paid_at')::timestamptz
        else null
      end,

      nullif(v_payment->>'payment_method', ''),

      nullif(v_payment->>'transaction_no', ''),

      nullif(v_payment->>'note', ''),

      coalesce(
        (v_payment->>'sort_order')::integer,
        0
      )
    );
  end loop;


  v_expected_release :=
    p_payload->'expected_release';

  if v_expected_release is not null
     and nullif(v_expected_release->>'date', '') is not null
  then
    insert into public.release_events (
      order_id,
      type,
      new_date,
      date_precision,
      occurred_at
    )
    values (
      v_order_id,
      'EXPECTED_RELEASE',
      (v_expected_release->>'date')::date,
      coalesce(
        nullif(
          v_expected_release->>'precision',
          ''
        ),
        'DAY'
      ),
      now()
    );
  end if;


  insert into public.order_events (
    order_id,
    type,
    title,
    description,
    occurred_at,
    metadata
  )
  values (
    v_order_id,
    'ORDER_CREATED',
    '创建订单',
    null,
    now(),
    jsonb_build_object(
      'source',
      'create_order_rpc'
    )
  );


  return v_order_id;
end;
$$;
```

---

# 23. create_order RPC 权限

建议：

```sql
revoke all
on function public.create_order(jsonb)
from public;

grant execute
on function public.create_order(jsonb)
to authenticated;
```

这样只有登录用户可以调用。

---

# 24. create_order 前端调用

Supabase JS：

```ts
const { data, error } = await supabase.rpc(
  'create_order',
  {
    p_payload: payload
  }
)

if (error) {
  throw error
}

const orderId = data
```

---

# 25. 前端 CreateOrderPayload

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

    payment_mode:
      | 'FULL'
      | 'DEPOSIT_BALANCE'
      | 'INSTALLMENT'
      | 'CUSTOM'

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
    type:
      | 'FULL'
      | 'DEPOSIT'
      | 'BALANCE'
      | 'INSTALLMENT'
      | 'SHIPPING'
      | 'TAX'
      | 'SUPPLEMENT'
      | 'REFUND'
      | 'OTHER'

    name?: string | null

    amount?: number | null

    currency: string

    status:
      | 'PENDING'
      | 'PAID'
      | 'OVERDUE'
      | 'CANCELLED'
      | 'REFUNDED'
      | 'PARTIALLY_REFUNDED'

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

# 26. Migration 017：标记付款 RPC

建议提供：

```text
mark_payment_paid
```

避免前端直接修改多个字段并忘记生成时间轴。

```sql
create or replace function public.mark_payment_paid(
  p_payment_id uuid,
  p_amount numeric,
  p_paid_at timestamptz,
  p_payment_method text default null,
  p_transaction_no text default null,
  p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_payment_name text;
begin

  select
    p.order_id,
    coalesce(
      p.name,
      case
        when p.type = 'FULL'
          then '全款'
        when p.type = 'DEPOSIT'
          then '定金'
        when p.type = 'BALANCE'
          then '尾款'
        when p.type = 'INSTALLMENT'
          then '阶段款'
        else p.type
      end
    )
  into
    v_order_id,
    v_payment_name
  from public.payments p
  join public.orders o
    on o.id = p.order_id
  where p.id = p_payment_id
    and o.user_id = auth.uid();


  if v_order_id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;


  update public.payments
  set
    amount = coalesce(
      p_amount,
      amount
    ),
    status = 'PAID',
    paid_at = coalesce(
      p_paid_at,
      now()
    ),
    payment_method =
      nullif(
        p_payment_method,
        ''
      ),
    transaction_no =
      nullif(
        p_transaction_no,
        ''
      ),
    note =
      coalesce(
        nullif(
          p_note,
          ''
        ),
        note
      )
  where id = p_payment_id;


  insert into public.order_events (
    order_id,
    type,
    title,
    description,
    occurred_at,
    metadata
  )
  values (
    v_order_id,
    'PAYMENT_PAID',
    '支付' || v_payment_name,
    null,
    coalesce(
      p_paid_at,
      now()
    ),
    jsonb_build_object(
      'payment_id',
      p_payment_id,
      'amount',
      p_amount
    )
  );

end;
$$;
```

授权：

```sql
revoke all
on function public.mark_payment_paid(
  uuid,
  numeric,
  timestamptz,
  text,
  text,
  text
)
from public;

grant execute
on function public.mark_payment_paid(
  uuid,
  numeric,
  timestamptz,
  text,
  text,
  text
)
to authenticated;
```

---

# 27. Migration 018：延期 RPC

建议：

```text
delay_release
```

```sql
create or replace function public.delay_release(
  p_order_id uuid,
  p_old_date date,
  p_new_date date,
  p_precision text default 'MONTH',
  p_source text default null,
  p_source_url text default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
begin

  if not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.user_id = auth.uid()
  ) then
    raise exception 'ORDER_NOT_FOUND';
  end if;


  insert into public.release_events (
    order_id,
    type,
    old_date,
    new_date,
    date_precision,
    occurred_at,
    source,
    source_url,
    note
  )
  values (
    p_order_id,
    'DELAY',
    p_old_date,
    p_new_date,
    p_precision,
    now(),
    nullif(p_source, ''),
    nullif(p_source_url, ''),
    nullif(p_note, '')
  )
  returning id
  into v_event_id;


  insert into public.order_events (
    order_id,
    type,
    title,
    description,
    occurred_at,
    metadata
  )
  values (
    p_order_id,
    'RELEASE_DELAYED',
    '商品延期',
    null,
    now(),
    jsonb_build_object(
      'old_date',
      p_old_date,
      'new_date',
      p_new_date,
      'release_event_id',
      v_event_id
    )
  );


  return v_event_id;
end;
$$;
```

---

# 28. Migration 019：标记厂商出货 RPC

```sql
create or replace function public.mark_released(
  p_order_id uuid,
  p_release_date date,
  p_source text default null,
  p_source_url text default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
begin

  if not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.user_id = auth.uid()
  ) then
    raise exception 'ORDER_NOT_FOUND';
  end if;


  insert into public.release_events (
    order_id,
    type,
    new_date,
    date_precision,
    occurred_at,
    source,
    source_url,
    note
  )
  values (
    p_order_id,
    'RELEASED',
    p_release_date,
    'DAY',
    now(),
    nullif(p_source, ''),
    nullif(p_source_url, ''),
    nullif(p_note, '')
  )
  returning id
  into v_event_id;


  insert into public.order_events (
    order_id,
    type,
    title,
    description,
    occurred_at,
    metadata
  )
  values (
    p_order_id,
    'PRODUCT_RELEASED',
    '厂商已出货',
    null,
    now(),
    jsonb_build_object(
      'release_date',
      p_release_date,
      'release_event_id',
      v_event_id
    )
  );


  return v_event_id;
end;
$$;
```

---

# 29. Migration 020：创建物流 RPC

可选。

第一版也可以直接 Insert。

如果需要统一生成时间轴，可以使用：

```sql
create or replace function public.create_shipment(
  p_order_id uuid,
  p_carrier text,
  p_tracking_no text,
  p_shipped_at timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shipment_id uuid;
begin

  if not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.user_id = auth.uid()
  ) then
    raise exception 'ORDER_NOT_FOUND';
  end if;


  insert into public.shipments (
    order_id,
    carrier,
    tracking_no,
    status,
    shipped_at,
    note
  )
  values (
    p_order_id,
    nullif(p_carrier, ''),
    nullif(p_tracking_no, ''),
    'SHIPPED',
    coalesce(
      p_shipped_at,
      now()
    ),
    nullif(p_note, '')
  )
  returning id
  into v_shipment_id;


  insert into public.order_events (
    order_id,
    type,
    title,
    description,
    occurred_at,
    metadata
  )
  values (
    p_order_id,
    'SHIPMENT_CREATED',
    '店铺已发货',
    null,
    coalesce(
      p_shipped_at,
      now()
    ),
    jsonb_build_object(
      'shipment_id',
      v_shipment_id,
      'carrier',
      p_carrier,
      'tracking_no',
      p_tracking_no
    )
  );


  return v_shipment_id;
end;
$$;
```

---

# 30. 标记签收 RPC

```sql
create or replace function public.mark_shipment_delivered(
  p_shipment_id uuid,
  p_delivered_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
begin

  select s.order_id
  into v_order_id
  from public.shipments s
  join public.orders o
    on o.id = s.order_id
  where s.id = p_shipment_id
    and o.user_id = auth.uid();


  if v_order_id is null then
    raise exception 'SHIPMENT_NOT_FOUND';
  end if;


  update public.shipments
  set
    status = 'DELIVERED',
    delivered_at = coalesce(
      p_delivered_at,
      now()
    )
  where id = p_shipment_id;


  insert into public.order_events (
    order_id,
    type,
    title,
    occurred_at,
    metadata
  )
  values (
    v_order_id,
    'SHIPMENT_DELIVERED',
    '包裹已签收',
    coalesce(
      p_delivered_at,
      now()
    ),
    jsonb_build_object(
      'shipment_id',
      p_shipment_id
    )
  );

end;
$$;
```

---

# 31. 订单是否自动完成

第一版不建议简单写：

```text
一个 Shipment DELIVERED
→
Order COMPLETED
```

因为：

```text
一个订单可能多个 Shipment
```

推荐判断：

```text
所有 Shipment 均 DELIVERED

并且

没有待付款 Payment
```

才自动视为已完成。

---

# 32. 可选：refresh_order_status RPC

```sql
create or replace function public.refresh_order_status(
  p_order_id uuid
)
returns public.order_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_has_pending_payment boolean;
  v_has_unfinished_shipment boolean;
  v_current_status public.order_status;
begin

  select status
  into v_current_status
  from public.orders
  where id = p_order_id
    and user_id = auth.uid();


  if v_current_status is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;


  if v_current_status in (
    'CANCELLED',
    'REFUNDED',
    'ARCHIVED'
  ) then
    return v_current_status;
  end if;


  select exists (
    select 1
    from public.payments p
    where p.order_id = p_order_id
      and p.status in (
        'PENDING',
        'OVERDUE'
      )
  )
  into v_has_pending_payment;


  select exists (
    select 1
    from public.shipments s
    where s.order_id = p_order_id
      and s.status <> 'DELIVERED'
  )
  into v_has_unfinished_shipment;


  if not v_has_pending_payment
     and exists (
       select 1
       from public.shipments s
       where s.order_id = p_order_id
     )
     and not v_has_unfinished_shipment
  then
    update public.orders
    set status = 'COMPLETED'
    where id = p_order_id;

    return 'COMPLETED';
  end if;


  update public.orders
  set status = 'ACTIVE'
  where id = p_order_id;


  return 'ACTIVE';
end;
$$;
```

---

# 33. Dashboard RPC：summary

建议：

```text
get_dashboard_summary
```

返回：

- 待付款数量
- 待付款金额
- 本月预计出货
- 运输中数量
- 已完成收藏数量

```sql
create or replace function public.get_dashboard_summary()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(

    'pending_payment_count',
    (
      select count(*)
      from public.payments p
      join public.orders o
        on o.id = p.order_id
      where o.user_id = auth.uid()
        and p.status in (
          'PENDING',
          'OVERDUE'
        )
    ),

    'pending_payment_amount',
    (
      select coalesce(
        sum(p.amount),
        0
      )
      from public.payments p
      join public.orders o
        on o.id = p.order_id
      where o.user_id = auth.uid()
        and p.status in (
          'PENDING',
          'OVERDUE'
        )
        and p.amount is not null
    ),

    'in_transit_count',
    (
      select count(*)
      from public.shipments s
      join public.orders o
        on o.id = s.order_id
      where o.user_id = auth.uid()
        and s.status in (
          'SHIPPED',
          'IN_TRANSIT'
        )
    ),

    'completed_order_count',
    (
      select count(*)
      from public.orders o
      where o.user_id = auth.uid()
        and o.status = 'COMPLETED'
    )

  );
$$;
```

---

# 34. 未来付款趋势 RPC

```sql
create or replace function public.get_future_payment_monthly(
  p_months integer default 12
)
returns table (
  month date,
  amount numeric
)
language sql
security invoker
set search_path = ''
as $$
  select
    date_trunc(
      'month',
      p.due_at
    )::date as month,

    sum(p.amount)::numeric as amount

  from public.payments p

  join public.orders o
    on o.id = p.order_id

  where o.user_id = auth.uid()

    and p.status in (
      'PENDING',
      'OVERDUE'
    )

    and p.amount is not null

    and p.due_at >= date_trunc(
      'month',
      current_date
    )

    and p.due_at <
      date_trunc(
        'month',
        current_date
      )
      +
      make_interval(
        months => p_months
      )

  group by 1

  order by 1;
$$;
```

---

# 35. 实际消费趋势 RPC

```sql
create or replace function public.get_payment_monthly_stats(
  p_months integer default 12
)
returns table (
  month date,
  paid_amount numeric,
  refund_amount numeric,
  net_amount numeric
)
language sql
security invoker
set search_path = ''
as $$
  select

    date_trunc(
      'month',
      p.paid_at
    )::date as month,

    sum(
      case
        when p.type <> 'REFUND'
          and p.status = 'PAID'
        then coalesce(
          p.amount,
          0
        )
        else 0
      end
    )::numeric
    as paid_amount,

    sum(
      case
        when p.type = 'REFUND'
          and p.status = 'PAID'
        then coalesce(
          p.amount,
          0
        )
        else 0
      end
    )::numeric
    as refund_amount,

    (
      sum(
        case
          when p.type <> 'REFUND'
            and p.status = 'PAID'
          then coalesce(
            p.amount,
            0
          )
          else 0
        end
      )

      -

      sum(
        case
          when p.type = 'REFUND'
            and p.status = 'PAID'
          then coalesce(
            p.amount,
            0
          )
          else 0
        end
      )
    )::numeric
    as net_amount

  from public.payments p

  join public.orders o
    on o.id = p.order_id

  where o.user_id = auth.uid()

    and p.paid_at >=
      date_trunc(
        'month',
        current_date
      )
      -
      make_interval(
        months => greatest(
          p_months - 1,
          0
        )
      )

  group by 1

  order by 1;
$$;
```

---

# 36. 最新预计出货 View

可以做一个 View：

```sql
create or replace view public.latest_release_status
with (security_invoker = true)
as
select distinct on (
  re.order_id
)

  re.order_id,

  re.id as release_event_id,

  re.type,

  re.new_date,

  re.date_precision,

  re.occurred_at

from public.release_events re

where re.type in (
  'EXPECTED_RELEASE',
  'DELAY',
  'RELEASED'
)

order by
  re.order_id,
  re.occurred_at desc,
  re.created_at desc;
```

订单列表可以直接 Join。

---

# 37. Storage Bucket

建议创建：

```text
product-images
attachments
```

Supabase Dashboard 创建即可。

如果使用 SQL：

```sql
insert into storage.buckets (
  id,
  name,
  public
)
values
(
  'product-images',
  'product-images',
  false
),
(
  'attachments',
  'attachments',
  false
)
on conflict (id) do nothing;
```

---

# 38. Storage 路径规范

商品图片：

```text
{user_id}/{product_id}/cover.webp
```

附件：

```text
{user_id}/{order_id}/{uuid}.png
```

---

# 39. Storage RLS

例如商品图：

```sql
create policy "product_images_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1]
      = auth.uid()::text
);
```

Insert：

```sql
create policy "product_images_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1]
      = auth.uid()::text
);
```

Update：

```sql
create policy "product_images_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1]
      = auth.uid()::text
);
```

Delete：

```sql
create policy "product_images_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1]
      = auth.uid()::text
);
```

附件 Bucket 同理。

---

# 40. 初始化默认平台

不建议创建全局平台表。

因为第一版希望：

```text
每个用户都能自由编辑平台
```

推荐注册后调用：

```text
init_user_defaults
```

---

# 41. init_user_defaults RPC

```sql
create or replace function public.init_user_defaults()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;


  insert into public.platforms (
    user_id,
    name,
    default_currency
  )
  values
    (
      v_user_id,
      '淘宝',
      'CNY'
    ),
    (
      v_user_id,
      '京东',
      'CNY'
    ),
    (
      v_user_id,
      'Bilibili会员购',
      'CNY'
    ),
    (
      v_user_id,
      'Hpoi',
      'CNY'
    ),
    (
      v_user_id,
      'AmiAmi',
      'JPY'
    ),
    (
      v_user_id,
      'Good Smile',
      'JPY'
    ),
    (
      v_user_id,
      '闲鱼',
      'CNY'
    ),
    (
      v_user_id,
      '其他',
      'CNY'
    )
  on conflict (
    user_id,
    name
  )
  do nothing;

end;
$$;
```

---

# 42. 推荐 Migration 文件顺序

```text
supabase/
└─ migrations/
   ├─ 001_create_enums.sql
   ├─ 002_create_platforms_stores.sql
   ├─ 003_create_products.sql
   ├─ 004_create_orders.sql
   ├─ 005_create_payments.sql
   ├─ 006_create_release_events.sql
   ├─ 007_create_shipments.sql
   ├─ 008_create_order_events.sql
   ├─ 009_create_attachments.sql
   ├─ 010_create_tags.sql
   ├─ 011_create_updated_at_triggers.sql
   ├─ 012_enable_rls.sql
   ├─ 013_create_top_level_rls.sql
   ├─ 014_create_child_table_rls.sql
   ├─ 015_create_order_summary_view.sql
   ├─ 016_create_order_rpc.sql
   ├─ 017_create_payment_rpc.sql
   ├─ 018_create_release_rpc.sql
   ├─ 019_create_shipment_rpc.sql
   ├─ 020_create_dashboard_rpc.sql
   └─ 021_create_storage.sql
```

---

# 43. Supabase CLI

初始化：

```bash
npx supabase init
```

启动本地：

```bash
npx supabase start
```

新建 migration：

```bash
npx supabase migration new create_orders
```

本地重建数据库：

```bash
npx supabase db reset
```

生成数据库 TypeScript 类型：

```bash
npx supabase gen types typescript \
  --local \
  > src/types/database.types.ts
```

线上项目：

```bash
npx supabase gen types typescript \
  --project-id <project-id> \
  > src/types/database.types.ts
```

---

# 44. TypeScript 类型策略

推荐：

```text
database.types.ts
```

作为数据库原始类型。

业务层不要直接到处引用：

```ts
Database['public']['Tables']['orders']['Row']
```

建议再封装：

```text
types/
├─ database.types.ts
├─ order.ts
├─ product.ts
├─ payment.ts
├─ shipment.ts
└─ release.ts
```

---

# 45. 数据库 Row 与业务 Model 分层

例如：

```ts
export type OrderRow =
  Database['public']['Tables']['orders']['Row']
```

业务 Model：

```ts
export interface OrderDetailModel {
  order: OrderRow

  items: OrderItemModel[]

  payments: PaymentRow[]

  releaseEvents: ReleaseEventRow[]

  shipments: ShipmentModel[]

  summary: {
    paidAmount: number

    pendingAmount: number

    refundedAmount: number

    nextPaymentDue?: string
  }
}
```

---

# 46. 前端获取订单详情

推荐 Query：

```ts
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

    order_events(*)
  `)
  .eq('id', orderId)
  .single()
```

---

# 47. 订单列表 Query

列表不要把所有嵌套数据全部拉回来。

建议：

```ts
const { data } = await supabase
  .from('orders')
  .select(`
    id,
    order_no,
    ordered_at,
    currency,
    total_amount,
    payment_mode,
    status,

    platform:platforms(
      id,
      name
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
        manufacturer
      )
    ),

    payments(
      id,
      type,
      amount,
      status,
      due_at,
      paid_at
    )
  `)
```

---

# 48. 数据完整性校验建议

`create_order` 中建议后续追加：

### 商品不能为空

```text
items.length >= 1
```

### total_amount >= 0

### quantity > 0

### Payment amount >= 0

### paid_at 与 status 对应

如果：

```text
status = PAID
```

建议：

```text
paid_at
```

必须存在。

这些可以：

- Zod 前端校验
- RPC 二次校验

双层处理。

---

# 49. Payment 金额总和不强校验

不要强制：

```text
sum(payments.amount)
=
orders.total_amount
```

因为现实存在：

```text
运费待定
补邮待定
退款
补差价
优惠
税费
```

只做提示。

---

# 50. 订单 DisplayStatus 不存库

不要创建：

```text
display_status
```

数据库字段。

DisplayStatus 属于：

```text
派生业务状态
```

前端 / View / RPC 计算即可。

推荐逻辑：

```text
CANCELLED
>
PAYMENT_OVERDUE
>
WAITING_PAYMENT
>
SHIPMENT_EXCEPTION
>
IN_TRANSIT
>
WAITING_SHIPMENT
>
WAITING_RELEASE
>
COMPLETED
```

---

# 51. 日期精度

所有出货日期建议保存：

```text
date
+
date_precision
```

例如：

```text
2027-05-01
MONTH
```

前端显示：

```text
2027年05月
```

不是：

```text
2027-05-01
```

---

# 52. 时区原则

订单下单日：

```text
date
```

付款实际时间：

```text
timestamptz
```

物流时间：

```text
timestamptz
```

出货预计：

```text
date
```

这样最合理。

用户显示时再转到用户设置的 timezone。

---

# 53. 金额类型

数据库统一：

```text
numeric(14, 2)
```

不要使用：

```text
float
double
```

前端：

```text
number
```

足够用于一般收藏品记录。

如果以后涉及严格会计精度，可以考虑 decimal 库。

---

# 54. 删除策略

产品：

```text
已有 order_items 引用
→
禁止删除
```

数据库已经使用：

```sql
on delete restrict
```

推荐提供：

```text
status = ARCHIVED
```

而不是删除。

订单：

V0.1 可以真实删除。

后续可改：

```text
soft delete
deleted_at
```

---

# 55. 订单取消

取消不是删除。

例如：

```sql
update public.orders
set status = 'CANCELLED'
where id = ...
```

相关 Payment：

建议：

```text
未支付 Payment → CANCELLED
```

已经支付的不自动改。

如果退款：

新增：

```text
REFUND Payment
```

---

# 56. 退款模型

例如：

```text
定金
¥300 PAID

退款
¥300 PAID
```

统计：

```text
总付款 ¥300

退款 ¥300

净支出 ¥0
```

不需要把原定金改成 `REFUNDED` 才能完成统计。

`REFUNDED` 更适合标记付款节点本身完全退款后的业务状态。

---

# 57. 首版推荐执行顺序

数据库开发建议按：

```text
1. Enum

2. Tables

3. Indexes

4. Trigger

5. RLS

6. RLS Policies

7. Views

8. RPC

9. Storage

10. Seed / defaults
```

完成后执行：

```bash
npx supabase db reset
```

确认整个 Migration 可以从 0 完整执行。

---

# 58. V0.1 数据库验收场景

必须至少测试以下场景。

---

## 场景 A：全款现货

```text
Order

Payment
FULL ¥899 PAID

Shipment
SHIPPED
↓
DELIVERED
```

最终：

```text
Order COMPLETED
```

---

## 场景 B：全款预售

```text
Payment
FULL ¥899 PAID

Release
EXPECTED_RELEASE

状态
已全款 · 等待出货
```

之后：

```text
RELEASED

Shipment

DELIVERED
```

---

## 场景 C：定金尾款

```text
DEPOSIT ¥300 PAID

BALANCE ¥999 PENDING

EXPECTED_RELEASE
```

以后：

```text
DELAY

BALANCE PAID

RELEASED

SHIPMENT

DELIVERED
```

---

## 场景 D：GK

```text
INSTALLMENT
¥800 PAID

INSTALLMENT
¥1000 PAID

BALANCE
¥2280 PENDING

SHIPPING
NULL PENDING
```

后续：

```text
SHIPPING
补成 ¥35

PAID
```

---

## 场景 E：退款取消

```text
DEPOSIT
¥300 PAID

REFUND
¥300 PAID

Order
CANCELLED
```

净支出：

```text
¥0
```

---

## 场景 F：拆单发货

```text
Order

Item A ×1
Item B ×2

Shipment A
包含 Item A ×1

Shipment B
包含 Item B ×2
```

全部签收后：

```text
Order COMPLETED
```

---

# 59. 第一版数据库最终结构

```text
platforms
stores

products
tags
product_tags

orders
order_items

payments

release_events

shipments
shipment_items

order_events

attachments
```

View：

```text
order_summary
latest_release_status
```

主要 RPC：

```text
create_order

mark_payment_paid

delay_release

mark_released

create_shipment

mark_shipment_delivered

refresh_order_status

get_dashboard_summary

get_future_payment_monthly

get_payment_monthly_stats

init_user_defaults
```

---

# 60. 下一步

完成数据库后，下一阶段就可以直接进入前端实现。

推荐继续拆：

```text
05-HobiLog-V0.1-TypeScript类型与API层.md

06-HobiLog-V0.1-Vue3页面与组件拆分.md

07-HobiLog-V0.1-状态机与业务规则.md
```

其中优先级最高的是：

```text
05 TypeScript 类型 + API 层
```

因为完成它以后：

```text
OrderCreate
OrderList
OrderDetail
```

三个核心页面就可以正式开始编码。
