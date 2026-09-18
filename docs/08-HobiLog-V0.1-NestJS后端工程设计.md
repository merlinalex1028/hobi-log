# HobiLog V0.1 NestJS 后端工程设计

> 定义正式后端工程结构、认证、模块边界、Controller / Service 规则、事务、Swagger、配置与测试。

## 1. 总体架构

```text
Vue3 Web
   │ REST + JSON
   │ Bearer Supabase Access Token
   ↓
NestJS API
   │
   ├─ Auth
   ├─ Product
   ├─ Order
   ├─ Payment
   ├─ Release
   ├─ Shipment
   ├─ Platform / Store
   ├─ Attachment
   ├─ Statistics
   └─ Notification
   │
   ├─ Prisma → Supabase PostgreSQL
   └─ Supabase Admin SDK → Storage
```

## 2. Server 目录

```text
apps/server/src/
├─ main.ts
├─ app.module.ts
├─ common/
│  ├─ decorators/
│  ├─ filters/
│  ├─ guards/
│  ├─ interceptors/
│  └─ types/
├─ config/
├─ database/
│  ├─ prisma.module.ts
│  └─ prisma.service.ts
└─ modules/
   ├─ auth/
   ├─ product/
   ├─ order/
   ├─ payment/
   ├─ release/
   ├─ shipment/
   ├─ platform/
   ├─ store/
   ├─ attachment/
   ├─ statistics/
   └─ notification/
```

## 3. Auth

登录继续使用 Supabase Auth。

Web 取得 `access_token` 后：

```http
Authorization: Bearer <access_token>
```

NestJS Guard：

1. 读取 Token
2. 验证 Supabase 用户
3. 得到 User ID
4. 注入 Request

V0.1 可直接使用 Supabase SDK `auth.getUser(token)`；后续可切本地 JWKS 验证。

## 4. CurrentUser

```ts
export interface AuthUser {
  id: string
  email?: string
}
```

```ts
@Get(':id')
getDetail(
  @CurrentUser() user: AuthUser,
  @Param('id') id: string,
) {
  return this.orderService.getDetail(user.id, id)
}
```

## 5. Controller 原则

Controller 只负责：

```text
参数
DTO 校验
读取当前用户
调用 Service
返回结果
```

不写 Prisma Query、事务、金额计算或状态机。

## 6. Service 原则

Service 负责：

```text
业务规则
用户数据隔离
事务
跨实体操作
状态机
```

## 7. Repository

V0.1 不要求每个模块强行 Repository。

简单模块：

```text
Service → PrismaService
```

复杂查询可增加：

```text
OrderRepository
StatisticsRepository
```

## 8. Order Module

```text
order/
├─ order.module.ts
├─ order.controller.ts
├─ order.service.ts
├─ dto/
│  ├─ create-order.dto.ts
│  ├─ update-order.dto.ts
│  ├─ query-order.dto.ts
│  └─ cancel-order.dto.ts
├─ vo/
│  ├─ order-list.vo.ts
│  └─ order-detail.vo.ts
└─ mapper/
   └─ order.mapper.ts
```

## 9. OrderService.create

流程：

```text
验证 Product 都属于当前用户
验证 Platform / Store
验证付款节点
验证金额
↓
prisma.$transaction
↓
Order
OrderItems
Payments
ExpectedRelease
```

## 10. Product 所属校验

```ts
const count = await prisma.product.count({
  where: {
    id: { in: productIds },
    userId,
  },
})

if (count !== productIds.length) {
  throw new BadRequestException('INVALID_PRODUCTS')
}
```

## 11. Payment Module

API：

```text
POST  /orders/:orderId/payments
PATCH /payments/:id
POST  /payments/:id/paid
POST  /payments/:id/refund
```

`markPaid` 建议事务完成：

```text
校验归属
校验可付款
更新 Payment
必要时创建补差价
刷新订单状态
```

## 12. Release Module

```text
POST /orders/:orderId/release/delay
POST /orders/:orderId/release/released
POST /orders/:orderId/release/store-arrived
```

## 13. Shipment Module

```text
POST  /orders/:orderId/shipments
PATCH /shipments/:id
POST  /shipments/:id/delivered
```

ShipmentItem 必须来自当前订单；数量合计不能超过 OrderItem 数量。

## 14. Attachment

推荐 signed URL：

```text
POST /attachments/upload-url
POST /attachments
DELETE /attachments/:id
```

Server 校验目标订单/商品归属、MIME 和文件大小。

## 15. Statistics

```text
GET /statistics/dashboard
GET /statistics/payments/monthly
GET /statistics/payments/future
GET /statistics/categories
GET /statistics/platforms
GET /statistics/manufacturers
GET /statistics/ips
```

使用 Prisma aggregate / groupBy / `$queryRaw`。

## 16. Notification

V0.1 可先留模块骨架。

后续扩展：

```text
Cron
BullMQ
Redis
Email
Bark
Telegram
Web Push
```

提醒调度绝不放 Vue。

## 17. ValidationPipe

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
```

## 18. Swagger

推荐从 V0.1 就启用：

```text
/api/docs
```

用于联调和接口测试。

## 19. 配置

```env
PORT=3000

DATABASE_URL=
DIRECT_URL=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

WEB_ORIGIN=http://localhost:5173
```

`SUPABASE_SERVICE_ROLE_KEY` 只能存在 Server。

## 20. 统一错误

推荐：

```json
{
  "statusCode": 404,
  "code": "ORDER_NOT_FOUND",
  "message": "订单不存在"
}
```

Prisma 错误统一映射，例如：

```text
P2002 → 409
P2025 → 404
```

## 21. 分页

```text
page
pageSize
```

返回：

```json
{
  "items": [],
  "total": 128,
  "page": 1,
  "pageSize": 20
}
```

## 22. 事务场景

必须事务：

```text
创建订单
取消订单 + 取消未付节点
付款 + 补差价
退款
创建拆单物流
签收 + 刷新订单状态
```

普通单表编辑无需强行事务。

## 23. 测试

重点单元测试：

```text
Payment Summary
DisplayStatus
Create Order
Cancel Order
Refund
Multi Shipment Completion
```

后续用 Supertest 做 E2E。

## 24. 后端开发顺序

```text
1. Prisma + Config
2. Supabase Auth Guard
3. Product
4. Platform / Store
5. Order Create / List / Detail
6. Payment
7. Release
8. Shipment
9. Statistics
10. Attachment
11. Notification
```

## 25. 后端验收

必须验证：

```text
用户 A 无法读取用户 B 数据
全款订单
定金尾款
多阶段付款
尾款逾期
延期
厂商出货
拆单物流
签收
退款
取消订单
Dashboard 统计
```

## 26. 边界总结

```text
Vue
不可信客户端。

NestJS
业务权威入口。

Prisma
数据库访问层。

PostgreSQL
数据事实来源。

Supabase Auth
身份来源。

Supabase Storage
文件存储。
```
