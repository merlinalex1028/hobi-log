# HobiLog V0.1 Prisma Schema、Migration 与数据库设计

> 正式架构采用 NestJS + Prisma + Supabase PostgreSQL。本文件替代旧版“Supabase RPC 为核心”的数据库方案。

## 1. 数据库职责

数据库负责数据持久化、外键、唯一约束、索引和事务底座；业务规则主要放在 NestJS Service。

不再把以下动作作为 PostgreSQL RPC 的核心实现：

```text
create_order
mark_payment_paid
delay_release
create_shipment
```

这些动作由 Service + Prisma Transaction 完成。

## 2. Prisma 初始化

```bash
pnpm --filter server add @prisma/client
pnpm --filter server add -D prisma
pnpm --filter server exec prisma init
```

环境变量：

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

`DATABASE_URL` 用于应用运行，`DIRECT_URL` 用于 migration 等直连场景。

## 3. schema.prisma 基础

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## 4. Enum

```prisma
enum PaymentMode {
  FULL
  DEPOSIT_BALANCE
  INSTALLMENT
  CUSTOM
}

enum OrderStatus {
  ACTIVE
  COMPLETED
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  PENDING
  PAID
  CANCELLED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum ShipmentStatus {
  WAITING
  SHIPPED
  IN_TRANSIT
  DELIVERED
  EXCEPTION
  RETURNED
}
```

`OVERDUE` 建议动态计算，不强制落库。

## 5. UserProfile

```prisma
model UserProfile {
  id              String   @id @db.Uuid
  username        String?
  avatarUrl       String?
  defaultCurrency String   @default("CNY")
  timezone        String   @default("Asia/Shanghai")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  products  Product[]
  orders    Order[]
  platforms Platform[]
  stores    Store[]
  tags      Tag[]

  @@map("user_profiles")
}
```

`id` 与 Supabase Auth User ID 保持一致。

## 6. Platform / Store

```prisma
model Platform {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @db.Uuid
  name            String
  logoUrl         String?
  website         String?
  region          String?
  defaultCurrency String?
  note            String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user   UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  stores Store[]
  orders Order[]

  @@unique([userId, name])
  @@index([userId])
  @@map("platforms")
}

model Store {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @db.Uuid
  platformId String?  @db.Uuid
  name       String
  url        String?
  contact    String?
  note       String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user     UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  platform Platform? @relation(fields: [platformId], references: [id], onDelete: SetNull)
  orders   Order[]

  @@index([userId])
  @@index([platformId])
  @@map("stores")
}
```

## 7. Product

```prisma
model Product {
  id                   String   @id @default(uuid()) @db.Uuid
  userId               String   @db.Uuid
  name                 String
  originalName         String?
  coverUrl             String?
  category             String   @default("OTHER")
  ipName               String?
  characterName        String?
  manufacturer         String?
  seriesName           String?
  scale                String?
  version              String?
  sku                  String?
  officialPrice        Decimal? @db.Decimal(14, 2)
  officialCurrency     String?
  announcedAt          DateTime? @db.Date
  originalReleaseDate  DateTime? @db.Date
  releaseDatePrecision String?
  description          String?
  status               String   @default("ACTIVE")
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  user          UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  orderItems    OrderItem[]
  releaseEvents ReleaseEvent[]
  attachments   Attachment[]
  productTags   ProductTag[]

  @@index([userId])
  @@index([name])
  @@index([ipName])
  @@index([characterName])
  @@index([manufacturer])
  @@map("products")
}
```

## 8. Order / OrderItem

```prisma
model Order {
  id             String      @id @default(uuid()) @db.Uuid
  userId         String      @db.Uuid
  platformId     String?     @db.Uuid
  storeId        String?     @db.Uuid
  orderNo        String?
  orderUrl       String?
  orderedAt      DateTime    @db.Date
  currency       String      @default("CNY")
  goodsAmount    Decimal     @default(0) @db.Decimal(14, 2)
  discountAmount Decimal     @default(0) @db.Decimal(14, 2)
  shippingAmount Decimal     @default(0) @db.Decimal(14, 2)
  taxAmount      Decimal     @default(0) @db.Decimal(14, 2)
  extraAmount    Decimal     @default(0) @db.Decimal(14, 2)
  totalAmount    Decimal     @default(0) @db.Decimal(14, 2)
  paymentMode    PaymentMode
  status         OrderStatus @default(ACTIVE)
  archived       Boolean     @default(false)
  note           String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  user          UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  platform      Platform? @relation(fields: [platformId], references: [id], onDelete: SetNull)
  store         Store? @relation(fields: [storeId], references: [id], onDelete: SetNull)
  items         OrderItem[]
  payments      Payment[]
  releaseEvents ReleaseEvent[]
  shipments     Shipment[]
  orderEvents   OrderEvent[]
  attachments   Attachment[]

  @@index([userId])
  @@index([orderedAt])
  @@index([status])
  @@map("orders")
}

model OrderItem {
  id        String   @id @default(uuid()) @db.Uuid
  orderId   String   @db.Uuid
  productId String   @db.Uuid
  quantity  Int      @default(1)
  unitPrice Decimal  @default(0) @db.Decimal(14, 2)
  subtotal  Decimal  @default(0) @db.Decimal(14, 2)
  note      String?
  createdAt DateTime @default(now())

  order         Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product       Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  shipmentItems ShipmentItem[]

  @@index([orderId])
  @@index([productId])
  @@map("order_items")
}
```

## 9. Payment

```prisma
model Payment {
  id            String        @id @default(uuid()) @db.Uuid
  orderId       String        @db.Uuid
  type          String
  name          String?
  amount        Decimal?      @db.Decimal(14, 2)
  currency      String        @default("CNY")
  status        PaymentStatus @default(PENDING)
  expectedAt    DateTime?     @db.Date
  dueAt         DateTime?     @db.Date
  paidAt        DateTime?
  paymentMethod String?
  transactionNo String?
  note          String?
  sortOrder     Int           @default(0)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  order         Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([status])
  @@index([dueAt])
  @@index([paidAt])
  @@map("payments")
}
```

Payment Type 由 Service 校验：

```text
FULL
DEPOSIT
BALANCE
INSTALLMENT
SHIPPING
TAX
SUPPLEMENT
REFUND
OTHER
```

## 10. ReleaseEvent

```prisma
model ReleaseEvent {
  id            String    @id @default(uuid()) @db.Uuid
  orderId       String    @db.Uuid
  productId     String?   @db.Uuid
  type          String
  oldDate       DateTime? @db.Date
  newDate       DateTime? @db.Date
  datePrecision String?
  occurredAt    DateTime  @default(now())
  source        String?
  sourceUrl     String?
  note          String?
  createdAt     DateTime  @default(now())

  order         Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product       Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([type])
  @@index([occurredAt])
  @@map("release_events")
}
```

## 11. Shipment / ShipmentItem

```prisma
model Shipment {
  id                  String         @id @default(uuid()) @db.Uuid
  orderId             String         @db.Uuid
  carrier             String?
  trackingNo          String?
  status              ShipmentStatus @default(WAITING)
  shippedAt           DateTime?
  estimatedDeliveryAt DateTime?
  deliveredAt         DateTime?
  note                String?
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  order               Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  items               ShipmentItem[]

  @@index([orderId])
  @@index([status])
  @@index([trackingNo])
  @@map("shipments")
}

model ShipmentItem {
  id          String    @id @default(uuid()) @db.Uuid
  shipmentId  String    @db.Uuid
  orderItemId String    @db.Uuid
  quantity    Int       @default(1)
  createdAt   DateTime  @default(now())

  shipment    Shipment  @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  orderItem   OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)

  @@unique([shipmentId, orderItemId])
  @@map("shipment_items")
}
```

## 12. OrderEvent / Attachment / Tag

```prisma
model OrderEvent {
  id          String   @id @default(uuid()) @db.Uuid
  orderId     String   @db.Uuid
  type        String
  title       String
  description String?
  occurredAt  DateTime @default(now())
  metadata    Json?
  createdAt   DateTime @default(now())

  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([occurredAt])
  @@map("order_events")
}

model Attachment {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  orderId     String?  @db.Uuid
  productId   String?  @db.Uuid
  type        String   @default("OTHER")
  fileName    String
  storagePath String
  mimeType    String?
  fileSize    BigInt?
  createdAt   DateTime @default(now())

  order       Order?   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product? @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("attachments")
}

model Tag {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  name      String
  createdAt DateTime @default(now())

  user      UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  products  ProductTag[]

  @@unique([userId, name])
  @@map("tags")
}

model ProductTag {
  productId String @db.Uuid
  tagId     String @db.Uuid

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  tag     Tag @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([productId, tagId])
  @@map("product_tags")
}
```

## 13. Migration

```bash
pnpm --filter server exec prisma migrate dev --name init
pnpm --filter server exec prisma generate
pnpm --filter server exec prisma studio
```

生产：

```bash
pnpm --filter server exec prisma migrate deploy
```

## 14. PrismaService

```ts
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit
{
  async onModuleInit() {
    await this.$connect()
  }
}
```

## 15. 创建订单事务

```ts
return this.prisma.$transaction(async tx => {
  const order = await tx.order.create({
    data: {
      userId,
      ...orderData,
    },
  })

  await tx.orderItem.createMany({
    data: items.map(item => ({
      orderId: order.id,
      ...item,
    })),
  })

  await tx.payment.createMany({
    data: payments.map((payment, index) => ({
      orderId: order.id,
      sortOrder: index,
      ...payment,
    })),
  })

  if (expectedRelease) {
    await tx.releaseEvent.create({
      data: {
        orderId: order.id,
        type: 'EXPECTED_RELEASE',
        newDate: expectedRelease.date,
        datePrecision: expectedRelease.precision,
      },
    })
  }

  return order
})
```

## 16. 权限原则

后端 userId 永远来自经过验证的 Supabase Token。

不要信任：

```text
body.userId
query.userId
```

查询必须绑定：

```ts
where: {
  id,
  userId,
}
```

## 17. RLS 定位

浏览器不再直接访问核心业务表，因此 RLS 不再承担主要业务鉴权。

建议收紧 `anon/authenticated` 对业务表的直接访问权限；Prisma 使用服务端数据库连接。

## 18. Decimal

Prisma Decimal 返回 `Prisma.Decimal`，Server Mapper / VO 返回 JSON 前统一转换为 number 或 string。

本项目日常金额可使用 number 返回前端。

## 19. 验收场景

必须测试：

```text
全款现货
全款预售
定金尾款
多阶段 GK
金额待定补邮
退款取消
拆单发货
多包裹签收
```

每一种都完整走：

```text
HTTP API
→ NestJS Service
→ Prisma Transaction
→ PostgreSQL
```
