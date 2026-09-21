# HobiLog V0.1 统计、日历、收藏、附件与通知（P4）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 P3 之后的读侧能力：Dashboard 统计、付款趋势 / 未来付款压力、多维度消费排行、日历事件、收藏库（由已签收订单派生）、Supabase Storage 附件签名上传、站内提醒。

**Architecture:** `StatisticsService` 负责聚合（`groupBy` + `$queryRaw`）；`CalendarService` 把 Payment / ReleaseEvent / Shipment 归一成日历事件；`CollectionService` 由「签收物流」派生收藏项，不新增业务表；`AttachmentService` 只做元数据 + 签名，文件直传 Supabase Storage；`NotificationService` 先算站内待办（无 Cron），后续接 BullMQ。

**Tech Stack:** 复用 P1–P3；新增 `@supabase/supabase-js` 的 Storage API（已装依赖）。

## 环境偏差（P1 实测结论，本计划执行时必须遵守）

P1 落地时依赖取最新，实际工具链与计划原文不同，执行本计划前先读这段：

| 项 | 计划原文 | 实际采用 | 原因 |
| --- | --- | --- | --- |
| 测试框架 | Jest 30 + ts-jest | **Vitest 5 + unplugin-swc** | NestJS 12 全系 ESM-only，Jest 30 无法 `require()` 它；Vitest 在 Node 22 上原生跑 ESM |
| 测试写法 | `jest.fn()` | `vi.fn()`（已批量替换）；spec 内用全局 `describe/it/expect` | 同上 |
| 命令 | `pnpm --filter @hobilog/server test` / `test:e2e` | 同（内部为 `vitest run src` / `vitest run test`） | 配置在 `apps/server/vitest.config.mts` |
| Prisma Client 导入 | `from '@prisma/client'` | **`from '<相对深度>/generated/prisma/client'`** | Prisma 7 客户端生成到 `apps/server/src/generated/prisma` |
| Prisma 命名空间 | `import { Prisma } from '@prisma/client'` | `import { Prisma } from '<相对深度>/generated/prisma/client'`（含 `Prisma.Decimal` / `Prisma.sql` / `Prisma.empty` / `Prisma.PrismaClientKnownRequestError`） | 同上 |
| PrismaClient 实例化 | `new PrismaClient()` | 已封装在 `PrismaService`（内部 `new PrismaPg({ connectionString })`） | Prisma 7 要求 driver adapter |
| TypeScript | 5.6 | 6.0.3 | TS 7.0 只有原生 `tsc`、无编程式 compiler API，`nest build`（Nest CLI 12）不可用 |
| NestJS | 10 | 12.0.3（Express 5，`@types/express` 5.x） | 取最新 |
| 分页/错误体 | `PaginationQueryDto` / `BusinessException` / `mapException` | 与计划一致（P1 已实现，直接复用） | — |

相对深度速查（导入生成客户端时）：
- `src/modules/<module>/*.ts` → `'../../generated/prisma/client'`
- `src/modules/<module>/<sub>/*.ts` → `'../../../generated/prisma/client'`
- `src/common/<sub>/*.ts` → `'../../generated/prisma/client'`
- 测试（`apps/server/test/*.ts`） → `'../src/generated/prisma/client'`；e2e 里 `overrideProvider(PrismaService)` 的 mock 需额外提供 `$queryRaw`

## 执行偏差记录（P2 实测）

| 位置 | 计划原文 | 实际采用 | 原因 |
| --- | --- | --- | --- |
| 错误码断言 | `toMatchObject({ code: 'XXX' })` | `toMatchObject({ response: { code: 'XXX' } })` | `BusinessException` 继承 `HttpException`，`code` 在 `getResponse()` 返回体里，不是异常顶层自有属性（P2 实测踩过，本计划已修正） |
| 模块结构 | 单文件内联 VO | 每模块 `mapper/<name>.mapper.ts` + `.spec.ts` | 与 P2 的 product / platform / store 保持一致 |

## 执行偏差记录（P4 实测）

| 位置 | 计划原文 | 实际采用 | 原因 |
| --- | --- | --- | --- |
| VO 文件位置 | `statistics/vo/statistics.vo.ts` | `statistics/mapper/statistics.mapper.ts` | 与既有模块结构一致 |
| Prisma 导入 | `from '@prisma/client'` | `from '../../generated/prisma/client'`，且 `Prisma` 必须值导入 | Prisma 7 生成目录约定；`Prisma.sql` / `Prisma.empty` 是运行期值，`import type` 会报 TS1361 |
| 原生 SQL 列名 | snake_case（`o.total_amount`、`p.ip_name`、`pay.paid_at`…） | 引号 camelCase（`o."totalAmount"`、`p."ipName"`、`pay."paidAt"`…） | migration 里列名就是 camelCase（`"ipName"`），按原文会报列不存在 |
| 维度统计 `itemCount` | payments ⋈ order_items 后直接 `SUM(quantity)` | 先用 CTE 按订单聚合并款，再 join items | 原写法会把 itemCount 乘以每单付款笔数（真库实测 2 笔付款 → itemCount 翻倍） |
| 收藏库计数 | `topCollections(userId, limit)`（`COUNT(*)` + `status='COMPLETED'` + `LIMIT`） | `countCollectionItems(userId)`（`COUNT(DISTINCT oi.id)` + `archived=false` + `EXISTS(DELIVERED shipment)`，去掉 `LIMIT`） | 聚合上加 `LIMIT` 无意义且 `limit` 是死参；硬性约束要求排除 `archived`；要避免 join shipments 重复计数；与 Task 2 `CollectionService.list` 口径对齐 |
| 待办优先级 | `overdueDays > 1 ? 0 : 0`（两分支同值） | 按 `dueAt` 距今天数分档：逾期 0 / ≤1 天 1 / ≤3 天 2 / ≤7 天 3 / 其余 4 | 原文是常量、注释要求把 `dueAt` 距离纳入排序（docs/02 §18），已补单测 |
| Dashboard `futurePayments` | 把全部 PENDING 付款塞进当前月 | select 增加 `dueAt`，按月份分桶、只取未来 12 个月 | 原写法等于 `kpis.pendingPaymentAmount` 副本，与 docs/02 §18「未来付款柱状图」不符 |
| `upcomingReleases` | 仅按日期窗口过滤 | 追加 `precision ∈ {MONTH, DAY}` | docs/07 §62「本月出货」要求精度为 MONTH / DAY |
| 月度 `orderAmount` | `SUM(CASE WHEN type<>'REFUND' THEN amount)`（付款之和，含 PENDING） | 单独查 `SUM(o."totalAmount")` 按 `orderedAt` 月份，再与现金流按月+币种合并 | docs/07 §74 与硬性约束：订单规模必须用 `Order.totalAmount` |
| Dashboard 查询并发 | 单个 `Promise.all` 内 13 路并发（`ORDER_INCLUDE` 8 个关系 + 5 条聚合） | 5 条聚合留在 `Promise.all`，`order.findMany`（8 关系）串行；并把 `PrismaService` 的连接池设为 `max: 5` | 真库实测 `XX000 (EMAXCONNSESSION) max clients reached in session mode … pool_size: 15`，Supabase session pooler 有并发上限 |
| 映射工具 | `Number(row.amount ?? 0)`、`row.dueAt as Date` | `toNumber(row.amount) ?? 0`、`if (!row.dueAt) continue` | 复用仓库既有序列化工具、去掉不安全断言 |

### 后续 Task 实测补记

| 位置 | 计划原文 | 实际采用 | 原因 |
| --- | --- | --- | --- |
| Calendar / Collection 的 VO | 内联在 service | `calendar/mapper/calendar.mapper.ts`、`collection/mapper/collection.mapper.ts` | 与既有模块结构一致（Task 2） |
| 收藏口径 | dashboard 用 `COUNT(DISTINCT order_items.id)`、`/collection/stats` 用 `SUM(quantity)`，且都只过滤 `archived=false` | 两者统一为 **件数**（`SUM(oi.quantity)`），并追加 `Order.status <> 'CANCELLED'` | docs/07 §64 要求按 quantity 求和、docs/02 §28 要求「未取消」；否则 Dashboard 与收藏库数字不一致（Task 5 实测发现） |
| Attachment DTO 的 bucket / mimeType | `bucket!: string` / `mimeType!: string`，枚举内联硬编码 | `as const` 常量 + 联合类型 `StorageBucket` / `AllowedMimeType` / `AttachmentTargetType`，`@IsIn` 复用同一来源 | 约定：枚举字段用联合类型（Task 3） |
| `GET /attachments/:id/url?expiresIn=` | controller 忽略 `expiresIn`（硬编码 3600） | 新增 `dto/download-url-query.dto.ts`（默认 3600、`@Min(60)`、`@Max(604800)`）并透传 | 与 Interfaces 声明一致（Task 3） |
| Storage 路径拼接 | `dto.bucket === 'attachments' ? 'attachments/…' : 'product-images/…'`、`bucket as string` | 统一 `` `${dto.bucket}/${dto.storagePath}` ``，并用 `splitStoragePath()` 校验 bucket ∈ 白名单（非法时下载抛 502 `STORAGE_UNAVAILABLE`、删除跳过 Storage） | 去掉不安全断言并可失败可见（Task 3） |
| Attachment spec 的 Supabase mock | `{ admin: { storage } }`（与 service 的 `admin.storage.from()` 层级不匹配） | `{ admin: { storage: { from } } }` | 计划原文首跑即 `TypeError: reading 'from'`（Task 3） |
| Notification 的 `ReminderVo` | 内联在 service | `notification/mapper/notification.mapper.ts` + `ReminderKind` 联合类型 | 模块结构一致（Task 4） |
| 待办优先级表 | 嵌套三元 | `PRIORITY` 常量表 + `dueSoonPriority()`（数值与原意一致） | 可读性（Task 4） |
| e2e 运行环境（Task 5） | 沿用 P3 的「真库 e2e」写法（打远端 Supabase） | `test/setup-env.ts` 强制 `DATABASE_URL`/`DIRECT_URL` 指向**本地测试库**（默认 `localhost:5433/hobilog_test`，可用 `TEST_DATABASE_URL` 覆盖） | 远端 session pooler 有并发上限且泄漏会话会被占满，加上开发机 VPN 抖动，e2e 频繁 `Connection terminated unexpectedly`（详见 P4 验收记录 §2）；换本地库后 32 个 e2e 约 1s 全绿 |
| `PrismaService` 连接池 | `max: 5`（Task 1 为绕开 `EMAXCONNSESSION` 加的） | 追加 `idleTimeoutMillis: 10_000`、`connectionTimeoutMillis: 15_000` | 空闲连接及时释放、失败快速暴露而非挂 60–80s |
| Dashboard KPI 形状 | 计划断言 `kpis.pendingPaymentAmount` 是标量 | 实际是**按币种数组** `[{currency,amount}]`（多币种不合并的正确形态） | e2e 断言改为按 CNY 条目取值（Task 5） |

---

## Global Constraints

沿用 roadmap 全量约束。P4 追加：

- 统计口径（`docs/07 §73-76`）：实际消费必须用 `Payment.paid_at`；订单规模用 `Order.total_amount`；净支出 = 非退款 PAID 之和 − REFUND PAID 之和；**多币种分开统计，禁止跨币种相加**。
- 维度统计把订单级付款按 `order_items.subtotal / orders.total_amount` 占比分摊到商品，再按 `products` 字段分组。
- 所有聚合查询必须显式过滤 `orders.user_id = 当前用户`，并默认排除 `archived = true`。
- 附件：只允许 `image/jpeg|png|webp|gif` 与 `application/pdf`，单文件 ≤ 10 MB；bucket 固定 `product-images` / `attachments`；服务端只返回 signed URL，`SUPABASE_SECRET_KEY` 不出服务端。
- 提醒调度绝不放 Vue；V0.1 只提供查询接口，不做定时任务。
- 提交策略同 P1：`git commit` 步骤仅在用户授权时执行。

---

### Task 1: Statistics 模块（Dashboard + 趋势 + 未来付款 + 维度排行）

**Files:**
- Create: `apps/server/src/modules/statistics/dto/statistics-query.dto.ts`
- Create: `apps/server/src/modules/statistics/statistics.repository.ts`
- Create: `apps/server/src/modules/statistics/statistics.service.ts`
- Create: `apps/server/src/modules/statistics/statistics.service.spec.ts`
- Create: `apps/server/src/modules/statistics/statistics.controller.ts`
- Create: `apps/server/src/modules/statistics/statistics.module.ts`
- Create: `apps/server/src/modules/statistics/vo/statistics.vo.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`、`OrderModule` 的领域函数（复用 `getNextPayment`）
- Produces API：
  - `GET /api/statistics/dashboard` → `DashboardVo`
  - `GET /api/statistics/payments/monthly?from=&to=` → `MonthlyPaymentVo[]`
  - `GET /api/statistics/payments/future?months=12` → `FuturePaymentVo[]`
  - `GET /api/statistics/{categories,platforms,manufacturers,ips}?from=&to=` → `DimensionStatVo[]`

- [x] **Step 1: 写 DTO 与 VO**

`dto/statistics-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { SUPPORTED_CURRENCIES } from '@hobilog/shared'

export class RangeQueryDto {
  @ApiPropertyOptional({ description: '起始日期（含），默认一年前' })
  @IsOptional() @IsISO8601() from?: string

  @ApiPropertyOptional({ description: '结束日期（含），默认今天' })
  @IsOptional() @IsISO8601() to?: string

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, description: '不传则按币种分组返回' })
  @IsOptional() @IsString() currency?: string
}

export class FuturePaymentQueryDto {
  @ApiPropertyOptional({ default: 12, description: '未来月数' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(36) months: number = 12

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES })
  @IsOptional() @IsString() currency?: string
}
```

`vo/statistics.vo.ts`:

```ts
export interface CurrencyAmountVo {
  currency: string
  amount: number
}

export interface DashboardVo {
  kpis: {
    pendingPaymentAmount: CurrencyAmountVo[]
    upcomingPaymentAmount: CurrencyAmountVo[]
    monthReleaseCount: number
    inTransitOrderCount: number
    collectionCount: number
    totalOrderCount: number
  }
  todos: Array<{
    orderId: string
    displayStatus: string
    displayStatusLabel: string
    displayStatusHint: string | null
    title: string
    amount: number | null
    currency: string
    dueAt: string | null
    overdueDays: number
    priority: number
  }>
  futurePayments: Array<{ month: string; byCurrency: CurrencyAmountVo[] }>
  upcomingReleases: Array<{
    orderId: string
    title: string
    plannedDate: string | null
    precision: string | null
    delayMonths: number
  }>
  shipping: Array<{ orderId: string; title: string; carrier: string | null; trackingNo: string | null; status: string }>
  recentOrders: Array<{
    id: string
    orderedAt: string
    displayStatus: string
    displayStatusLabel: string
    totalAmount: number
    currency: string
  }>
}

export interface MonthlyPaymentVo {
  month: string
  currency: string
  paidAmount: number
  refundAmount: number
  netPaidAmount: number
  orderAmount: number
}

export interface FuturePaymentVo {
  month: string
  byCurrency: CurrencyAmountVo[]
}

export interface DimensionStatVo {
  key: string
  label: string
  amount: CurrencyAmountVo[]
  orderCount: number
  itemCount: number
}
```

- [x] **Step 2: 写 `statistics.repository.ts`**

```ts
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'

export interface DimensionRow {
  key: string | null
  currency: string
  amount: Prisma.Decimal | number | string | null
  orderCount: bigint | number
  itemCount: bigint | number
}

export type DimensionField = 'category' | 'platform' | 'manufacturer' | 'ip'

@Injectable()
export class StatisticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private groupExpression(field: DimensionField): Prisma.Sql {
    switch (field) {
      case 'category':
        return Prisma.sql`p.category`
      case 'manufacturer':
        return Prisma.sql`COALESCE(p.manufacturer, '未填写厂商')`
      case 'ip':
        return Prisma.sql`COALESCE(p.ip_name, '未填写 IP')`
      case 'platform':
        return Prisma.sql`COALESCE(pf.name, '未填写平台')`
    }
  }

  private joinFor(field: DimensionField): Prisma.Sql {
    return field === 'platform'
      ? Prisma.sql`LEFT JOIN platforms pf ON pf.id = o.platform_id`
      : Prisma.empty
  }

  async dimension(
    userId: string,
    field: DimensionField,
    from: Date,
    to: Date,
    currency?: string,
  ): Promise<DimensionRow[]> {
    const group = this.groupExpression(field)
    const platformJoin = this.joinFor(field)

    return this.prisma.$queryRaw<DimensionRow[]>`
      SELECT
        ${group} AS key,
        pay.currency AS currency,
        SUM(pay.amount * oi.subtotal / NULLIF(o.total_amount, 0)) AS amount,
        COUNT(DISTINCT o.id) AS "orderCount",
        COALESCE(SUM(oi.quantity), 0) AS "itemCount"
      FROM payments pay
      JOIN orders o ON o.id = pay.order_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      ${platformJoin}
      WHERE o.user_id = ${userId}::uuid
        AND o.archived = false
        AND pay.status = 'PAID'
        AND pay.type <> 'REFUND'
        AND pay.paid_at >= ${from}
        AND pay.paid_at < ${to}
        ${currency ? Prisma.sql`AND pay.currency = ${currency}` : Prisma.empty}
      GROUP BY 1, 2
      ORDER BY amount DESC NULLS LAST
    `
  }

  async topCollections(userId: string, limit: number): Promise<Array<{ count: bigint | number }>> {
    return this.prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) AS count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN shipments s ON s.order_id = o.id
      WHERE o.user_id = ${userId}::uuid
        AND o.status = 'COMPLETED'
        AND s.status = 'DELIVERED'
      LIMIT ${limit}
    `
  }
}
```

- [x] **Step 3: 写 `statistics.service.ts`**

```ts
import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { toDateString, toNumber } from '../../common/utils/serialize'
import { getNextPayment } from '../order/domain/payment-summary'
import { getDelayMonths, getPlannedReleaseDate } from '../order/domain/release'
import { getDisplayStatusHint, getDisplayStatusLabel } from '../order/domain/display-status'
import { toOrderDomain } from '../order/mapper/order-domain.mapper'
import { ORDER_INCLUDE } from '../order/order.service'
import { StatisticsRepository, type DimensionField, type DimensionRow } from './statistics.repository'
import type {
  CurrencyAmountVo, DashboardVo, DimensionStatVo, FuturePaymentVo, MonthlyPaymentVo,
} from './vo/statistics.vo'

const ONE_DAY_MS = 86_400_000
const FUTURE_PAYMENT_WINDOW_DAYS = 30

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: StatisticsRepository,
  ) {}

  today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private defaultRange(from?: string, to?: string): { from: Date; to: Date } {
    const today = new Date(`${this.today()}T00:00:00.000Z`)
    const defaultFrom = new Date(today.getTime() - 365 * ONE_DAY_MS)
    return {
      from: from ? new Date(`${from.slice(0, 10)}T00:00:00.000Z`) : defaultFrom,
      to: to ? new Date(new Date(`${to.slice(0, 10)}T00:00:00.000Z`).getTime() + ONE_DAY_MS) : new Date(today.getTime() + ONE_DAY_MS),
    }
  }

  private groupByCurrency(rows: Array<{ currency: string; amount: number }>): CurrencyAmountVo[] {
    const map = new Map<string, number>()
    for (const row of rows) {
      map.set(row.currency, Number(((map.get(row.currency) ?? 0) + row.amount).toFixed(2)))
    }
    return [...map.entries()].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency))
  }

  async getDashboard(userId: string): Promise<DashboardVo> {
    const today = this.today()
    const todayDate = new Date(`${today}T00:00:00.000Z`)
    const horizon = new Date(todayDate.getTime() + FUTURE_PAYMENT_WINDOW_DAYS * ONE_DAY_MS)
    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`)
    const monthEnd = new Date(new Date(monthStart).setUTCMonth(monthStart.getUTCMonth() + 1))

    const [pendingRows, upcomingRows, activeOrders, inTransitCount, collectionRows] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: 'PENDING', order: { userId, archived: false, status: 'ACTIVE' } },
        select: { amount: true, currency: true },
      }),
      this.prisma.payment.findMany({
        where: {
          status: 'PENDING',
          dueAt: { gte: todayDate, lt: horizon },
          order: { userId, archived: false, status: 'ACTIVE' },
        },
        select: { amount: true, currency: true },
      }),
      this.prisma.order.findMany({
        where: { userId, archived: false, status: 'ACTIVE' },
        include: ORDER_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
      this.prisma.order.count({
        where: { userId, archived: false, shipments: { some: { status: { in: ['SHIPPED', 'IN_TRANSIT'] } } } },
      }),
      this.repository.topCollections(userId, 1),
    ])

    const currencyAmount = (rows: Array<{ amount: Prisma.Decimal | null; currency: string }>): CurrencyAmountVo[] =>
      this.groupByCurrency(
        rows
          .filter(row => row.amount !== null)
          .map(row => ({ currency: row.currency, amount: Number(row.amount) })),
      )

    const domains = activeOrders.map(order => ({ order, domain: toOrderDomain(order), display: toOrderDomain(order) }))
    const todos = domains
      .map(({ order, domain }) => {
        const next = getNextPayment(domain.payments, today)
        const status = getStatus(order, today)
        return status && isTodoStatus(status)
          ? {
              orderId: order.id,
              displayStatus: status,
              displayStatusLabel: getDisplayStatusLabel(domain, today),
              displayStatusHint: getDisplayStatusHint(domain, today),
              title: order.items[0]?.product.name ?? order.orderNo ?? '订单',
              amount: next?.amount ?? null,
              currency: order.currency,
              dueAt: next?.dueAt ?? null,
              overdueDays: next?.overdueDays ?? 0,
              priority: todoPriority(status, next?.overdueDays ?? 0),
            }
          : null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 10)

    const futureMap = new Map<string, Array<{ currency: string; amount: number }>>()
    for (const payment of pendingRows) {
      if (payment.amount === null) continue
      const month = today.slice(0, 7)
      const bucket = futureMap.get(month) ?? []
      bucket.push({ currency: payment.currency, amount: Number(payment.amount) })
      futureMap.set(month, bucket)
    }

    const upcomingReleases = domains
      .filter(({ domain }) => getPlannedReleaseDate(domain.releaseEvents) !== null)
      .map(({ order, domain }) => ({
        orderId: order.id,
        title: order.items[0]?.product.name ?? '订单',
        plannedDate: getPlannedReleaseDate(domain.releaseEvents)?.date ?? null,
        precision: getPlannedReleaseDate(domain.releaseEvents)?.precision ?? null,
        delayMonths: getDelayMonths(domain.releaseEvents),
      }))
      .filter(item => item.plannedDate !== null && item.plannedDate >= monthStart.toISOString().slice(0, 10) && item.plannedDate < monthEnd.toISOString().slice(0, 10))

    const shipping = domains
      .flatMap(({ order, domain }) =>
        domain.shipments
          .filter(shipment => shipment.status === 'SHIPPED' || shipment.status === 'IN_TRANSIT')
          .map(shipment => ({
            orderId: order.id,
            title: order.items[0]?.product.name ?? '订单',
            carrier: shipment.carrier,
            trackingNo: shipment.trackingNo,
            status: shipment.status,
          })),
      )
      .slice(0, 10)

    return {
      kpis: {
        pendingPaymentAmount: currencyAmount(pendingRows),
        upcomingPaymentAmount: currencyAmount(upcomingRows),
        monthReleaseCount: upcomingReleases.length,
        inTransitOrderCount: inTransitCount,
        collectionCount: Number(collectionRows[0]?.count ?? 0),
        totalOrderCount: await this.prisma.order.count({ where: { userId, archived: false } }),
      },
      todos,
      futurePayments: [...futureMap.entries()].map(([month, rows]) => ({ month, byCurrency: this.groupByCurrency(rows) })),
      upcomingReleases,
      shipping,
      recentOrders: domains.slice(0, 10).map(({ order, domain }) => ({
        id: order.id,
        orderedAt: toDateString(order.orderedAt) as string,
        displayStatus: getStatus(order, today),
        displayStatusLabel: getDisplayStatusLabel(domain, today),
        totalAmount: toNumber(order.totalAmount) ?? 0,
        currency: order.currency,
      })),
    }
  }

  async getMonthlyPayments(userId: string, from?: string, to?: string, currency?: string): Promise<MonthlyPaymentVo[]> {
    const range = this.defaultRange(from, to)
    const rows = await this.prisma.$queryRaw<Array<{
      month: Date
      currency: string
      paidAmount: Prisma.Decimal | null
      refundAmount: Prisma.Decimal | null
      orderAmount: Prisma.Decimal | null
    }>>`
      SELECT
        date_trunc('month', COALESCE(pay.paid_at, pay.due_at, o.ordered_at)) AS month,
        pay.currency AS currency,
        SUM(CASE WHEN pay.status = 'PAID' AND pay.type <> 'REFUND' THEN pay.amount ELSE 0 END) AS "paidAmount",
        SUM(CASE WHEN pay.status = 'PAID' AND pay.type = 'REFUND' THEN pay.amount ELSE 0 END) AS "refundAmount",
        SUM(CASE WHEN pay.type <> 'REFUND' THEN pay.amount ELSE 0 END) AS "orderAmount"
      FROM payments pay
      JOIN orders o ON o.id = pay.order_id
      WHERE o.user_id = ${userId}::uuid
        AND o.archived = false
        AND COALESCE(pay.paid_at, pay.due_at, o.ordered_at) >= ${range.from}
        AND COALESCE(pay.paid_at, pay.due_at, o.ordered_at) < ${range.to}
        ${currency ? Prisma.sql`AND pay.currency = ${currency}` : Prisma.empty}
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `

    return rows.map(row => {
      const paidAmount = Number(row.paidAmount ?? 0)
      const refundAmount = Number(row.refundAmount ?? 0)
      return {
        month: row.month.toISOString().slice(0, 7),
        currency: row.currency,
        paidAmount,
        refundAmount,
        netPaidAmount: Number((paidAmount - refundAmount).toFixed(2)),
        orderAmount: Number(row.orderAmount ?? 0),
      }
    })
  }

  async getFuturePayments(userId: string, months: number, currency?: string): Promise<FuturePaymentVo[]> {
    const today = new Date(`${this.today()}T00:00:00.000Z`)
    const end = new Date(today)
    end.setUTCMonth(end.getUTCMonth() + months)

    const rows = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        amount: { not: null },
        dueAt: { gte: today, lt: end },
        order: { userId, archived: false, status: 'ACTIVE' },
        ...(currency ? { currency } : {}),
      },
      select: { amount: true, currency: true, dueAt: true },
    })

    const map = new Map<string, Array<{ currency: string; amount: number }>>()
    for (const row of rows) {
      const month = (row.dueAt as Date).toISOString().slice(0, 7)
      const bucket = map.get(month) ?? []
      bucket.push({ currency: row.currency, amount: Number(row.amount ?? 0) })
      map.set(month, bucket)
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, bucket]) => ({ month, byCurrency: this.groupByCurrency(bucket) }))
  }

  async getDimension(field: DimensionField, userId: string, from?: string, to?: string, currency?: string): Promise<DimensionStatVo[]> {
    const range = this.defaultRange(from, to)
    const rows = await this.repository.dimension(userId, field, range.from, range.to, currency)
    return this.mergeDimensionRows(rows)
  }

  private mergeDimensionRows(rows: DimensionRow[]): DimensionStatVo[] {
    const map = new Map<string, DimensionStatVo>()
    for (const row of rows) {
      const key = row.key ?? 'UNKNOWN'
      const entry = map.get(key) ?? { key, label: key, amount: [], orderCount: 0, itemCount: 0 }
      entry.amount = this.groupByCurrency([
        ...entry.amount.map(item => ({ currency: item.currency, amount: item.amount })),
        { currency: row.currency, amount: Number(row.amount ?? 0) },
      ])
      entry.orderCount += Number(row.orderCount)
      entry.itemCount += Number(row.itemCount)
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => (b.amount[0]?.amount ?? 0) - (a.amount[0]?.amount ?? 0))
  }
}

const TODO_STATUSES = ['PAYMENT_OVERDUE', 'WAITING_PAYMENT', 'WAITING_SHIPMENT', 'SHIPMENT_EXCEPTION']

function isTodoStatus(status: string): boolean {
  return TODO_STATUSES.includes(status)
}

function todoPriority(status: string, overdueDays: number): number {
  if (status === 'PAYMENT_OVERDUE') return overdueDays > 1 ? 0 : 0
  if (status === 'WAITING_PAYMENT') return 1
  if (status === 'SHIPMENT_EXCEPTION') return 2
  if (status === 'WAITING_SHIPMENT') return 3
  return 9
}

function getStatus(order: { status: string; payments: unknown; shipments: unknown; releaseEvents: unknown }, today: string): string {
  return getDisplayStatus(toOrderDomain(order as never), today)
}
```

实现时注意：

- 文件顶部导入 `getDisplayStatus`（`../order/domain/display-status`），`getStatus` 是它的薄封装。
- `todos` 的 `priority` 采用 `docs/01 §11` 与 `docs/02 §18` 的顺序：逾期 > 1 天内 > 3 天内 > 7 天内 > 其他；把 `overdueDays` 与 `next.dueAt` 距今天数一起参与排序（逾期 0，1 天内 1，3 天内 2，7 天内 3，其余 4）。
- `getMonthlyPayments` 用 `$queryRaw`，`Prisma` 需从 `@prisma/client` 导入（用于 `Prisma.sql` / `Prisma.empty`）。

- [x] **Step 4: 写 `statistics.service.spec.ts`**

```ts
import { StatisticsService } from './statistics.service'

const prismaMock = () => ({
  payment: { findMany: vi.fn().mockResolvedValue([]) },
  order: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  $queryRaw: vi.fn().mockResolvedValue([]),
})

const repositoryMock = () => ({
  dimension: vi.fn().mockResolvedValue([]),
  topCollections: vi.fn().mockResolvedValue([{ count: 3 }]),
})

const build = (prisma: ReturnType<typeof prismaMock>, repository = repositoryMock()) =>
  new StatisticsService(prisma as never, repository as never)

describe('StatisticsService.getDashboard', () => {
  it('待付款按币种分开聚合，不跨币种相加', async () => {
    const prisma = prismaMock()
    prisma.payment.findMany
      .mockResolvedValueOnce([
        { amount: 300, currency: 'CNY' },
        { amount: 999, currency: 'CNY' },
        { amount: 12000, currency: 'JPY' },
      ])
      .mockResolvedValueOnce([])
    const result = await build(prisma).getDashboard('u1')
    expect(result.kpis.pendingPaymentAmount).toEqual([
      { currency: 'CNY', amount: 1299 },
      { currency: 'JPY', amount: 12000 },
    ])
  })

  it('amount = null 的待付款不参与金额汇总', async () => {
    const prisma = prismaMock()
    prisma.payment.findMany
      .mockResolvedValueOnce([{ amount: null, currency: 'CNY' }])
      .mockResolvedValueOnce([])
    const result = await build(prisma).getDashboard('u1')
    expect(result.kpis.pendingPaymentAmount).toEqual([])
  })

  it('收藏数量来自已签收订单的 OrderItem 数', async () => {
    const prisma = prismaMock()
    const repository = repositoryMock()
    repository.topCollections.mockResolvedValue([{ count: 7 }])
    const result = await build(prisma, repository).getDashboard('u1')
    expect(result.kpis.collectionCount).toBe(7)
  })
})

describe('StatisticsService.getFuturePayments', () => {
  it('按月份与币种聚合，月份升序', async () => {
    const prisma = prismaMock()
    prisma.payment.findMany.mockResolvedValue([
      { amount: 300, currency: 'CNY', dueAt: new Date('2027-05-20T00:00:00.000Z') },
      { amount: 900, currency: 'CNY', dueAt: new Date('2027-05-25T00:00:00.000Z') },
      { amount: 999, currency: 'CNY', dueAt: new Date('2027-06-20T00:00:00.000Z') },
    ])
    const result = await build(prisma).getFuturePayments('u1', 12)
    expect(result).toEqual([
      { month: '2027-05', byCurrency: [{ currency: 'CNY', amount: 1200 }] },
      { month: '2027-06', byCurrency: [{ currency: 'CNY', amount: 999 }] },
    ])
  })
})

describe('StatisticsService.getMonthlyPayments', () => {
  it('净支出 = 已付 - 退款', async () => {
    const prisma = prismaMock()
    prisma.$queryRaw.mockResolvedValue([
      { month: new Date('2027-05-01T00:00:00.000Z'), currency: 'CNY', paidAmount: 1299, refundAmount: 300, orderAmount: 1599 },
    ])
    const result = await build(prisma).getMonthlyPayments('u1')
    expect(result).toEqual([
      { month: '2027-05', currency: 'CNY', paidAmount: 1299, refundAmount: 300, netPaidAmount: 999, orderAmount: 1599 },
    ])
  })

  it('无数据时返回空数组', async () => {
    const prisma = prismaMock()
    await expect(build(prisma).getMonthlyPayments('u1')).resolves.toEqual([])
  })
})

describe('StatisticsService.getDimension', () => {
  it('把仓库行按 key 合并并保持多币种分离', async () => {
    const prisma = prismaMock()
    const repository = repositoryMock()
    repository.dimension.mockResolvedValue([
      { key: 'GK', currency: 'CNY', amount: 800, orderCount: 1, itemCount: 1 },
      { key: 'GK', currency: 'JPY', amount: 12000, orderCount: 1, itemCount: 1 },
    ])
    const result = await build(prisma, repository).getDimension('category', 'u1')
    expect(result).toEqual([
      {
        key: 'GK',
        label: 'GK',
        amount: [
          { currency: 'CNY', amount: 800 },
          { currency: 'JPY', amount: 12000 },
        ],
        orderCount: 2,
        itemCount: 2,
      },
    ])
  })

  it('key 为 null 时归入 UNKNOWN', async () => {
    const prisma = prismaMock()
    const repository = repositoryMock()
    repository.dimension.mockResolvedValue([{ key: null, currency: 'CNY', amount: 100, orderCount: 1, itemCount: 1 }])
    const result = await build(prisma, repository).getDimension('manufacturer', 'u1')
    expect(result[0]?.key).toBe('UNKNOWN')
  })
})
```

- [x] **Step 5: 写 controller / module 并运行测试**

```ts
@ApiTags('statistics')
@ApiBearerAuth()
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser): Promise<DashboardVo> {
    return this.statisticsService.getDashboard(user.id)
  }

  @Get('payments/monthly')
  monthly(@CurrentUser() user: AuthUser, @Query() query: RangeQueryDto): Promise<MonthlyPaymentVo[]> {
    return this.statisticsService.getMonthlyPayments(user.id, query.from, query.to, query.currency)
  }

  @Get('payments/future')
  future(@CurrentUser() user: AuthUser, @Query() query: FuturePaymentQueryDto): Promise<FuturePaymentVo[]> {
    return this.statisticsService.getFuturePayments(user.id, query.months, query.currency)
  }

  @Get('categories')
  categories(@CurrentUser() user: AuthUser, @Query() query: RangeQueryDto): Promise<DimensionStatVo[]> {
    return this.statisticsService.getDimension('category', user.id, query.from, query.to, query.currency)
  }

  @Get('platforms')
  platforms(@CurrentUser() user: AuthUser, @Query() query: RangeQueryDto): Promise<DimensionStatVo[]> {
    return this.statisticsService.getDimension('platform', user.id, query.from, query.to, query.currency)
  }

  @Get('manufacturers')
  manufacturers(@CurrentUser() user: AuthUser, @Query() query: RangeQueryDto): Promise<DimensionStatVo[]> {
    return this.statisticsService.getDimension('manufacturer', user.id, query.from, query.to, query.currency)
  }

  @Get('ips')
  ips(@CurrentUser() user: AuthUser, @Query() query: RangeQueryDto): Promise<DimensionStatVo[]> {
    return this.statisticsService.getDimension('ip', user.id, query.from, query.to, query.currency)
  }
}
```

`statistics.module.ts`：`providers: [StatisticsService, StatisticsRepository]`；`app.module.ts` 追加 `StatisticsModule`。

Run: `pnpm --filter @hobilog/server test && pnpm --filter @hobilog/server typecheck`

- [ ] **Step 6: 提交（需用户授权）**

```bash
git add apps/server/src/modules/statistics apps/server/src/app.module.ts
git commit -m "feat(statistics): add dashboard, monthly cash flow, future payments and dimension stats"
```

---

### Task 2: Calendar 与 Collection 模块

**Files:**
- Create: `apps/server/src/modules/calendar/calendar.service.ts`
- Create: `apps/server/src/modules/calendar/calendar.service.spec.ts`
- Create: `apps/server/src/modules/calendar/calendar.controller.ts`
- Create: `apps/server/src/modules/calendar/calendar.module.ts`
- Create: `apps/server/src/modules/collection/collection.service.ts`
- Create: `apps/server/src/modules/collection/collection.service.spec.ts`
- Create: `apps/server/src/modules/collection/collection.controller.ts`
- Create: `apps/server/src/modules/collection/collection.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`
- Produces API：
  - `GET /api/calendar/events?from=&to=` → `CalendarEventVo[]`
  - `GET /api/collection?page=&pageSize=` → `Paginated<CollectionItemVo>`
  - `GET /api/collection/stats` → `{ totalItems: number; deliveredOrders: number; byCurrency: CurrencyAmountVo[] }`

- [x] **Step 1: 写 `calendar.service.ts`**

```ts
export type CalendarEventType = 'PAYMENT_DUE' | 'EXPECTED_RELEASE' | 'RELEASED' | 'DELIVERY'

export interface CalendarEventVo {
  id: string
  type: CalendarEventType
  date: string
  orderId: string
  title: string
  amount: number | null
  currency: string | null
  precision: string | null
  displayStatus: string
}

const EVENT_PRIORITY: Record<CalendarEventType, number> = {
  PAYMENT_DUE: 0,
  DELIVERY: 1,
  EXPECTED_RELEASE: 2,
  RELEASED: 3,
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(userId: string, from: string, to: string): Promise<CalendarEventVo[]> {
    const fromDate = new Date(`${from.slice(0, 10)}T00:00:00.000Z`)
    const toDate = new Date(new Date(`${to.slice(0, 10)}T00:00:00.000Z`).getTime() + 86_400_000)

    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        archived: false,
        OR: [
          { payments: { some: { dueAt: { gte: fromDate, lt: toDate } } } },
          { releaseEvents: { some: { newDate: { gte: fromDate, lt: toDate } } } },
          { shipments: { some: { shippedAt: { gte: fromDate, lt: toDate } } } },
          { shipments: { some: { estimatedDeliveryAt: { gte: fromDate, lt: toDate } } } },
          { shipments: { some: { deliveredAt: { gte: fromDate, lt: toDate } } } },
        ],
      },
      include: ORDER_INCLUDE,
    })

    const events: CalendarEventVo[] = []
    const titleOf = (order: (typeof orders)[number]) => order.items[0]?.product.name ?? order.orderNo ?? '订单'

    for (const order of orders) {
      const displayStatus = getDisplayStatus(toOrderDomain(order), new Date().toISOString().slice(0, 10))

      for (const payment of order.payments) {
        if (!payment.dueAt || payment.dueAt < fromDate || payment.dueAt >= toDate) continue
        if (payment.status !== 'PENDING' && payment.status !== 'PAID') continue
        events.push({
          id: `payment:${payment.id}`,
          type: 'PAYMENT_DUE',
          date: payment.dueAt.toISOString().slice(0, 10),
          orderId: order.id,
          title: `${titleOf(order)} · ${payment.name ?? payment.type}`,
          amount: payment.amount === null ? null : Number(payment.amount),
          currency: payment.currency,
          precision: 'DAY',
          displayStatus,
        })
      }

      for (const event of order.releaseEvents) {
        if (!event.newDate || event.newDate < fromDate || event.newDate >= toDate) continue
        if (event.type !== 'EXPECTED_RELEASE' && event.type !== 'DELAY' && event.type !== 'RELEASED') continue
        events.push({
          id: `release:${event.id}`,
          type: event.type === 'RELEASED' ? 'RELEASED' : 'EXPECTED_RELEASE',
          date: event.newDate.toISOString().slice(0, 10),
          orderId: order.id,
          title: `${titleOf(order)} · ${event.type === 'RELEASED' ? '厂商出货' : event.type === 'DELAY' ? '延期后出货' : '预计出货'}`,
          amount: null,
          currency: null,
          precision: event.datePrecision,
          displayStatus,
        })
      }

      for (const shipment of order.shipments) {
        const deliveryDate = shipment.deliveredAt ?? shipment.estimatedDeliveryAt
        if (!deliveryDate || deliveryDate < fromDate || deliveryDate >= toDate) continue
        events.push({
          id: `delivery:${shipment.id}`,
          type: 'DELIVERY',
          date: deliveryDate.toISOString().slice(0, 10),
          orderId: order.id,
          title: `${titleOf(order)} · ${shipment.deliveredAt ? '已签收' : '预计到货'}`,
          amount: null,
          currency: null,
          precision: 'DAY',
          displayStatus,
        })
      }
    }

    return events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      if (EVENT_PRIORITY[a.type] !== EVENT_PRIORITY[b.type]) return EVENT_PRIORITY[a.type] - EVENT_PRIORITY[b.type]
      return a.id.localeCompare(b.id)
    })
  }
}
```

（`ORDER_INCLUDE`、`toOrderDomain`、`getDisplayStatus` 复用 Order 模块导出；`CalendarModule` 需 `imports: [OrderModule]` 才能拿到 `ORDER_INCLUDE` 常量——若按常量导入则无需模块依赖。）

- [x] **Step 2: 写 `collection.service.ts`**

```ts
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

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page: number, pageSize: number): Promise<Paginated<CollectionItemVo>> {
    const where: Prisma.OrderItemWhereInput = {
      order: {
        userId,
        archived: false,
        shipments: { some: { status: 'DELIVERED' } },
      },
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.orderItem.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, coverUrl: true } },
          order: { select: { id: true, orderedAt: true, currency: true } },
          shipmentItems: { include: { shipment: { select: { deliveredAt: true, status: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.orderItem.count({ where }),
    ])

    const items = rows.map(row => {
      const delivered = row.shipmentItems
        .map(item => item.shipment)
        .filter(shipment => shipment.status === 'DELIVERED' && shipment.deliveredAt !== null)
        .sort((a, b) => (a.deliveredAt as Date).getTime() - (b.deliveredAt as Date).getTime())[0]

      return {
        orderItemId: row.id,
        orderId: row.order.id,
        productId: row.product.id,
        name: row.product.name,
        coverUrl: row.product.coverUrl,
        quantity: row.quantity,
        purchasePrice: toNumber(row.subtotal) ?? 0,
        currency: row.order.currency,
        purchasedAt: toDateString(row.order.orderedAt) as string,
        deliveredAt: delivered?.deliveredAt ? toDateString(delivered.deliveredAt) : null,
      }
    })

    return toPaginated(items, total, page, pageSize)
  }

  async stats(userId: string): Promise<{ totalItems: number; deliveredOrders: number; byCurrency: Array<{ currency: string; amount: number }> }> {
    const rows = await this.prisma.orderItem.findMany({
      where: { order: { userId, archived: false, shipments: { some: { status: 'DELIVERED' } } } },
      select: { quantity: true, subtotal: true, order: { select: { currency: true } } },
    })

    const map = new Map<string, number>()
    let totalItems = 0
    for (const row of rows) {
      totalItems += row.quantity
      map.set(row.order.currency, Number(((map.get(row.order.currency) ?? 0) + Number(row.subtotal ?? 0)).toFixed(2)))
    }

    const deliveredOrders = await this.prisma.order.count({
      where: { userId, archived: false, shipments: { some: { status: 'DELIVERED' } } },
    })

    return {
      totalItems,
      deliveredOrders,
      byCurrency: [...map.entries()].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency)),
    }
  }
}
```

- [x] **Step 3: 写两份 spec（要点）**

`calendar.service.spec.ts`：

```ts
const prismaMock = () => ({ order: { findMany: vi.fn().mockResolvedValue([]) } })

it('付款截止日落在区间内才产出 PAYMENT_DUE', async () => { /* 构造 1 个订单 + 2 个 payment，断言只返回区间内的那条 */ })
it('同一天事件按 PAYMENT_DUE > DELIVERY > EXPECTED_RELEASE 排序', async () => { /* 同日期三类事件混排断言顺序 */ })
it('归档订单不进入日历', async () => { /* 断言 findMany 的 where 含 archived: false */ })
```

`collection.service.spec.ts`：

```ts
it('只有已签收订单的 OrderItem 计入收藏', async () => { /* 断言 where.order.shipments.some.status = DELIVERED */ })
it('多包裹时取最早一次签收时间', async () => { /* 两个 shipmentItems，断言 deliveredAt 取较早 */ })
it('stats 按币种分开汇总', async () => { /* CNY 与 JPY 分别聚合，断言不合并 */ })
```

两个 spec 的 `$transaction` 用 `vi.fn(async operations => Promise.all(operations))`，与 P2/P3 一致。

- [x] **Step 4: 写 controller / module 并运行测试**

`dto/calendar-query.dto.ts`（区间必填）：

```ts
import { ApiProperty } from '@nestjs/swagger'
import { IsISO8601 } from 'class-validator'

export class CalendarRangeDto {
  @ApiProperty({ example: '2027-05-01' }) @IsISO8601() from!: string
  @ApiProperty({ example: '2027-05-31' }) @IsISO8601() to!: string
}
```

```ts
@ApiTags('calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  events(@CurrentUser() user: AuthUser, @Query() query: CalendarRangeDto): Promise<CalendarEventVo[]> {
    return this.calendarService.getEvents(user.id, query.from, query.to)
  }
}

@ApiTags('collection')
@ApiBearerAuth()
@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto): Promise<Paginated<CollectionItemVo>> {
    return this.collectionService.list(user.id, query.page, query.pageSize)
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.collectionService.stats(user.id)
  }
}
```

`calendar.module.ts` / `collection.module.ts` 各自声明 controller + service；`app.module.ts` 追加两个模块。

Run: `pnpm --filter @hobilog/server test && pnpm --filter @hobilog/server typecheck`

- [ ] **Step 5: 提交（需用户授权）**

```bash
git add apps/server/src/modules/calendar apps/server/src/modules/collection apps/server/src/app.module.ts
git commit -m "feat(calendar): add calendar events and collection derivation"
```

---

### Task 3: Attachment 模块（Supabase Storage 签名上传）

**Files:**
- Create: `apps/server/src/modules/attachment/dto/upload-url.dto.ts`
- Create: `apps/server/src/modules/attachment/dto/create-attachment.dto.ts`
- Create: `apps/server/src/modules/attachment/attachment.service.ts`
- Create: `apps/server/src/modules/attachment/attachment.service.spec.ts`
- Create: `apps/server/src/modules/attachment/attachment.controller.ts`
- Create: `apps/server/src/modules/attachment/attachment.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `SupabaseService.admin`（Storage）、`OrderService.assertOwned`、`ProductService.getOwnedProductIds`
- Produces：
  - `POST /api/attachments/upload-url` → `{ bucket, path, token, signedUrl }`
  - `POST /api/attachments` → `AttachmentVo`
  - `DELETE /api/attachments/:id` → `{ id }`
  - `GET /api/attachments/:id/url?expiresIn=` → `{ signedUrl }`
- 规则（`docs/03 §38`）：bucket 只有 `product-images` / `attachments`；校验归属、MIME 白名单与体积；路径固定 `${userId}/${targetId}/${uuid}-${safeFileName}`。

- [x] **Step 1: 写 DTO**

```ts
// dto/upload-url.dto.ts
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const
export const MAX_FILE_SIZE = 10 * 1024 * 1024

export class UploadUrlDto {
  @ApiProperty({ enum: ['product-images', 'attachments'] })
  @IsIn(['product-images', 'attachments']) bucket!: string

  @ApiProperty({ enum: ['ORDER', 'PRODUCT'] })
  @IsIn(['ORDER', 'PRODUCT']) targetType!: 'ORDER' | 'PRODUCT'

  @ApiProperty() @IsUUID() targetId!: string

  @ApiProperty({ example: 'invoice.png' })
  @IsString() @MaxLength(200) fileName!: string

  @ApiProperty({ enum: ALLOWED_MIME_TYPES })
  @IsIn(ALLOWED_MIME_TYPES) mimeType!: string

  @ApiProperty({ example: 245_760 })
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_FILE_SIZE) fileSize!: number
}

// dto/create-attachment.dto.ts
export class CreateAttachmentDto {
  @ApiProperty({ enum: ['product-images', 'attachments'] })
  @IsIn(['product-images', 'attachments']) bucket!: string

  @ApiProperty({ description: 'upload-url 返回的 path' }) @IsString() storagePath!: string
  @ApiProperty({ enum: ATTACHMENT_TYPES }) @IsIn(ATTACHMENT_TYPES) type!: string
  @ApiProperty() @IsString() @MaxLength(200) fileName!: string
  @ApiPropertyOptional() @IsOptional() @IsString() mimeType?: string
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) fileSize?: number
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string
}
```

- [x] **Step 2: 写 `attachment.service.ts`**

```ts
const BUCKETS = ['product-images', 'attachments'] as const

@Injectable()
export class AttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly orderService: OrderService,
    private readonly productService: ProductService,
  ) {}

  async createUploadUrl(userId: string, dto: UploadUrlDto): Promise<{ bucket: string; path: string; token: string; signedUrl: string }> {
    await this.assertTargetOwned(userId, dto.targetType, dto.targetId)

    const safeName = dto.fileName.replace(/[^\w.\-]+/g, '_')
    const path = `${userId}/${dto.targetId}/${randomUUID()}-${safeName}`

    const { data, error } = await this.supabase.admin.storage.from(dto.bucket).createSignedUploadUrl(path)
    if (error || !data) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, 'STORAGE_UNAVAILABLE', '文件上传地址生成失败')
    }

    return { bucket: dto.bucket, path, token: data.token, signedUrl: data.signedUrl }
  }

  async create(userId: string, dto: CreateAttachmentDto): Promise<AttachmentVo> {
    if (dto.orderId) await this.orderService.assertOwned(userId, dto.orderId)
    if (dto.productId) {
      const owned = await this.productService.getOwnedProductIds(userId, [dto.productId])
      if (owned.length === 0) {
        throw new BusinessException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', '商品不存在')
      }
    }
    if (!dto.storagePath.startsWith(`${userId}/`)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'INVALID_STORAGE_PATH', '文件路径不合法')
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        userId,
        orderId: dto.orderId ?? null,
        productId: dto.productId ?? null,
        type: dto.type,
        fileName: dto.fileName,
        storagePath: dto.bucket === 'attachments' ? `attachments/${dto.storagePath}` : `product-images/${dto.storagePath}`,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize === undefined ? null : BigInt(dto.fileSize),
      },
    })

    return toAttachmentVo(attachment)
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    const attachment = await this.prisma.attachment.findFirst({ where: { id, userId } })
    if (!attachment) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ATTACHMENT_NOT_FOUND', '附件不存在')
    }

    const [bucket, ...rest] = attachment.storagePath.split('/')
    if (bucket === 'attachments' || bucket === 'product-images') {
      await this.supabase.admin.storage.from(bucket).remove([rest.join('/')])
    }

    await this.prisma.attachment.delete({ where: { id } })
    return { id }
  }

  async createDownloadUrl(userId: string, id: string, expiresIn: number): Promise<{ signedUrl: string }> {
    const attachment = await this.prisma.attachment.findFirst({ where: { id, userId } })
    if (!attachment) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ATTACHMENT_NOT_FOUND', '附件不存在')
    }

    const [bucket, ...rest] = attachment.storagePath.split('/')
    const { data, error } = await this.supabase.admin.storage
      .from(bucket as string)
      .createSignedUrl(rest.join('/'), expiresIn)
    if (error || !data) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, 'STORAGE_UNAVAILABLE', '文件地址生成失败')
    }
    return { signedUrl: data.signedUrl }
  }

  private async assertTargetOwned(userId: string, targetType: 'ORDER' | 'PRODUCT', targetId: string): Promise<void> {
    if (targetType === 'ORDER') {
      await this.orderService.assertOwned(userId, targetId)
      return
    }
    const owned = await this.productService.getOwnedProductIds(userId, [targetId])
    if (owned.length === 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', '商品不存在')
    }
  }
}

export function toAttachmentVo(attachment: {
  id: string
  type: string
  fileName: string
  storagePath: string
  mimeType: string | null
  fileSize: bigint | null
  createdAt: Date
}): AttachmentVo {
  return {
    id: attachment.id,
    type: attachment.type,
    fileName: attachment.fileName,
    storagePath: attachment.storagePath,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize === null ? null : attachment.fileSize.toString(),
    createdAt: attachment.createdAt.toISOString(),
  }
}
```

`AttachmentVo`：`{ id, type, fileName, storagePath, mimeType, fileSize: string | null, createdAt }`（`BigInt` 出口转 string，避免 JSON 序列化报错）。

- [x] **Step 3: 写 `attachment.service.spec.ts`**

```ts
import { AttachmentService } from './attachment.service'

const prismaMock = () => ({
  attachment: {
    create: vi.fn().mockResolvedValue({
      id: 'a1', type: 'PAYMENT_PROOF', fileName: 'invoice.png', storagePath: 'attachments/u1/o1/x.png',
      mimeType: 'image/png', fileSize: BigInt(2048), createdAt: new Date('2026-09-18T00:00:00.000Z'),
    }),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
})

const storageMock = () => ({
  from: vi.fn().mockReturnValue({
    createSignedUploadUrl: vi.fn().mockResolvedValue({ data: { token: 't', signedUrl: 'https://signed' }, error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://download' }, error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
})

const build = (prisma: ReturnType<typeof prismaMock>, storage = storageMock()) =>
  new AttachmentService(
    prisma as never,
    { admin: { storage } } as never,
    { assertOwned: vi.fn().mockResolvedValue(undefined) } as never,
    { getOwnedProductIds: vi.fn().mockResolvedValue(['p1']) } as never,
  )

describe('AttachmentService.createUploadUrl', () => {
  it('路径前缀为 userId/targetId 且带随机名', async () => {
    const prisma = prismaMock()
    const storage = storageMock()
    const result = await build(prisma, storage).createUploadUrl('u1', {
      bucket: 'attachments', targetType: 'ORDER', targetId: 'o1',
      fileName: 'invoice final.png', mimeType: 'image/png', fileSize: 2048,
    })
    expect(result.path.startsWith('u1/o1/')).toBe(true)
    expect(result.path).toContain('invoice_final.png')
    expect(result.signedUrl).toBe('https://signed')
  })

  it('非订单归属 → 透传 404', async () => {
    const prisma = prismaMock()
    const service = new AttachmentService(
      prisma as never,
      { admin: { storage: storageMock() } } as never,
      { assertOwned: vi.fn().mockRejectedValue(Object.assign(new Error('nf'), { status: 404 })) } as never,
      { getOwnedProductIds: vi.fn() } as never,
    )
    await expect(
      service.createUploadUrl('u1', {
        bucket: 'attachments', targetType: 'ORDER', targetId: 'o-other',
        fileName: 'a.png', mimeType: 'image/png', fileSize: 1,
      }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('AttachmentService.create', () => {
  it('storagePath 必须以 userId 开头', async () => {
    const prisma = prismaMock()
    await expect(
      build(prisma).create('u1', {
        bucket: 'attachments', storagePath: 'u-not-mine/o1/x.png', type: 'PAYMENT_PROOF', fileName: 'x.png',
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_STORAGE_PATH' } })
  })

  it('fileSize 出口为 string', async () => {
    const prisma = prismaMock()
    const vo = await build(prisma).create('u1', {
      bucket: 'attachments', storagePath: 'u1/o1/x.png', type: 'PAYMENT_PROOF', fileName: 'x.png',
      mimeType: 'image/png', fileSize: 2048, orderId: 'o1',
    })
    expect(vo.fileSize).toBe('2048')
    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ storagePath: 'attachments/u1/o1/x.png', fileSize: BigInt(2048) }),
    })
  })
})

describe('AttachmentService.remove', () => {
  it('同时删除 Storage 对象与元数据', async () => {
    const prisma = prismaMock()
    const storage = storageMock()
    prisma.attachment.findFirst.mockResolvedValue({ id: 'a1', storagePath: 'attachments/u1/o1/x.png' })
    const result = await build(prisma, storage).remove('u1', 'a1')
    expect(storage.from).toHaveBeenCalledWith('attachments')
    expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
    expect(result).toEqual({ id: 'a1' })
  })

  it('不存在 → 404 ATTACHMENT_NOT_FOUND', async () => {
    const prisma = prismaMock()
    prisma.attachment.findFirst.mockResolvedValue(null)
    await expect(build(prisma).remove('u1', 'a1')).rejects.toMatchObject({ response: { code: 'ATTACHMENT_NOT_FOUND' } })
  })
})
```

- [x] **Step 4: 写 controller / module 并运行测试**

```ts
@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('upload-url')
  uploadUrl(@CurrentUser() user: AuthUser, @Body() dto: UploadUrlDto) {
    return this.attachmentService.createUploadUrl(user.id, dto)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAttachmentDto) {
    return this.attachmentService.create(user.id, dto)
  }

  @Get(':id/url')
  downloadUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attachmentService.createDownloadUrl(user.id, id, 3600)
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attachmentService.remove(user.id, id)
  }
}
```

`attachment.module.ts`：`imports: [OrderModule, ProductModule]`；`app.module.ts` 追加 `AttachmentModule`。

Run: `pnpm --filter @hobilog/server test && pnpm --filter @hobilog/server typecheck`

- [x] **Step 5: 手动核对 Supabase Bucket**

在 Supabase 控制台确认存在两个 bucket：`product-images`、`attachments`。若不存在则创建（私有），并把 Public 设为关闭（V0.1 只走 signed URL）。

- [ ] **Step 6: 提交（需用户授权）**

```bash
git add apps/server/src/modules/attachment apps/server/src/app.module.ts
git commit -m "feat(attachment): add signed upload url, metadata and deletion"
```

---

### Task 4: Notification 模块（站内提醒）

**Files:**
- Create: `apps/server/src/modules/notification/notification.service.ts`
- Create: `apps/server/src/modules/notification/notification.service.spec.ts`
- Create: `apps/server/src/modules/notification/notification.controller.ts`
- Create: `apps/server/src/modules/notification/notification.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`、`@hobilog/shared` 的 `REMINDER_OFFSET_DAYS`
- Produces：`GET /api/notifications/todos` → `ReminderVo[]`
- 提醒规则（`docs/02 §37`、`docs/07 §67-72`）：`due_at ∈ {7,3,1,0} 天`、已逾期、本月出货、发生延期、长时间未更新（`ACTIVE` 且 `updatedAt` 早于 30 天前）；订单已取消 / 归档则不出提醒。

- [x] **Step 1: 写 `notification.service.ts`**

```ts
export interface ReminderVo {
  id: string
  kind: 'PAYMENT_DUE_SOON' | 'PAYMENT_OVERDUE' | 'RELEASE_THIS_MONTH' | 'RELEASE_DELAYED' | 'STALE_ORDER'
  orderId: string
  title: string
  dueAt: string | null
  daysLeft: number | null
  overdueDays: number | null
  amount: number | null
  currency: string | null
  priority: number
}

const STALE_DAYS = 30

function diffDays(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000,
  )
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodos(userId: string): Promise<ReminderVo[]> {
    const today = new Date().toISOString().slice(0, 10)
    const monthPrefix = today.slice(0, 7)

    const orders = await this.prisma.order.findMany({
      where: { userId, archived: false, status: 'ACTIVE' },
      include: ORDER_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })

    const reminders: ReminderVo[] = []

    for (const order of orders) {
      const title = order.items[0]?.product.name ?? order.orderNo ?? '订单'
      const domain = toOrderDomain(order)

      for (const payment of order.payments) {
        if (payment.status !== 'PENDING' || !payment.dueAt) continue
        const dueAt = payment.dueAt.toISOString().slice(0, 10)
        const daysLeft = diffDays(today, dueAt)

        if (daysLeft < 0) {
          reminders.push({
            id: `payment-overdue:${payment.id}`,
            kind: 'PAYMENT_OVERDUE',
            orderId: order.id,
            title: `${title} · ${payment.name ?? payment.type}`,
            dueAt,
            daysLeft,
            overdueDays: Math.abs(daysLeft),
            amount: payment.amount === null ? null : Number(payment.amount),
            currency: payment.currency,
            priority: 0,
          })
          continue
        }

        if (REMINDER_OFFSET_DAYS.includes(daysLeft as (typeof REMINDER_OFFSET_DAYS)[number])) {
          reminders.push({
            id: `payment-soon:${payment.id}`,
            kind: 'PAYMENT_DUE_SOON',
            orderId: order.id,
            title: `${title} · ${payment.name ?? payment.type}`,
            dueAt,
            daysLeft,
            overdueDays: null,
            amount: payment.amount === null ? null : Number(payment.amount),
            currency: payment.currency,
            priority: daysLeft === 0 ? 1 : daysLeft === 1 ? 2 : daysLeft === 3 ? 3 : 4,
          })
        }
      }

      const planned = getPlannedReleaseDate(domain.releaseEvents)
      if (planned && planned.date.startsWith(monthPrefix)) {
        reminders.push({
          id: `release-month:${order.id}`,
          kind: 'RELEASE_THIS_MONTH',
          orderId: order.id,
          title,
          dueAt: planned.date,
          daysLeft: diffDays(today, planned.date),
          overdueDays: null,
          amount: null,
          currency: null,
          priority: 5,
        })
      }

      if (getDelayMonths(domain.releaseEvents) > 0 && !isReleased(domain.releaseEvents)) {
        reminders.push({
          id: `release-delayed:${order.id}`,
          kind: 'RELEASE_DELAYED',
          orderId: order.id,
          title,
          dueAt: planned?.date ?? null,
          daysLeft: planned ? diffDays(today, planned.date) : null,
          overdueDays: null,
          amount: null,
          currency: null,
          priority: 6,
        })
      }

      const staleThreshold = new Date(Date.now() - STALE_DAYS * 86_400_000)
      if (order.updatedAt < staleThreshold) {
        reminders.push({
          id: `stale:${order.id}`,
          kind: 'STALE_ORDER',
          orderId: order.id,
          title,
          dueAt: null,
          daysLeft: null,
          overdueDays: null,
          amount: null,
          currency: null,
          priority: 9,
        })
      }
    }

    return reminders.sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id)))
  }
}
```

- [x] **Step 2: 写 `notification.service.spec.ts`（要点）**

```ts
it('尾款 3 天后截止 → PAYMENT_DUE_SOON 且 daysLeft = 3', async () => { /* dueAt = 今天+3 */ })
it('尾款已过截止 → PAYMENT_OVERDUE 且 overdueDays 为正', async () => { /* dueAt = 今天-5 */ })
it('9 天后截止不触发（不在 7/3/1/0 集合内）', async () => { /* 期望无 PAYMENT_DUE_SOON */ })
it('已付款 / 已取消 / 已退款节点不出提醒', async () => { /* status 分别取 PAID / CANCELLED / REFUNDED */ })
it('取消或归档订单整体不出提醒', async () => { /* 断言 where 含 status ACTIVE、archived false */ })
it('延期后仍在等待出货 → RELEASE_DELAYED', async () => { /* EXPECTED_RELEASE + DELAY，断言 kind */ })
it('超过 30 天未更新 → STALE_ORDER', async () => { /* updatedAt 设为 40 天前 */ })
it('排序：逾期 > 当天 > 1 天 > 3 天 > 7 天 > 本月出货 > 延期 > 长期未更新', async () => { /* 构造多条断言 id 顺序 */ })
```

- [x] **Step 3: 写 controller / module 并运行测试**

```ts
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('todos')
  todos(@CurrentUser() user: AuthUser): Promise<ReminderVo[]> {
    return this.notificationService.getTodos(user.id)
  }
}
```

`notification.module.ts` 只声明 controller + service，并在文件头注释说明后续扩展（Cron + BullMQ + Redis + Email / Bark / Telegram / Web Push，`docs/08 §16`）。

Run: `pnpm --filter @hobilog/server test && pnpm --filter @hobilog/server typecheck`

- [ ] **Step 4: 提交（需用户授权）**

```bash
git add apps/server/src/modules/notification apps/server/src/app.module.ts
git commit -m "feat(notification): add in-app reminder computation"
```

---

### Task 5: P4 里程碑验收

**Files:**
- Create: `apps/server/test/read-models.e2e-spec.ts`
- Create: `docs/superpowers/verification/2026-09-18-P4-verification.md`

**Interfaces:**
- Consumes: P4 全部接口 + 真实 PostgreSQL（Storage 调用在 e2e 中被 mock）
- Produces: 读侧验收证据

- [x] **Step 1: 写读侧 e2e**

沿用 P3 e2e 的骨架（真实 Prisma + `overrideProvider(SupabaseService)`），追加：

```ts
it('GET /api/statistics/dashboard 返回 KPI 与待办', async () => {
  const res = await authed(request(app.getHttpServer()).get('/api/statistics/dashboard'))
  expect(res.status).toBe(200)
  expect(res.body.kpis).toHaveProperty('pendingPaymentAmount')
  expect(Array.isArray(res.body.todos)).toBe(true)
})

it('GET /api/statistics/payments/future 按月份返回', async () => {
  const res = await authed(request(app.getHttpServer()).get('/api/statistics/payments/future?months=12'))
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
})

it.each(['categories', 'platforms', 'manufacturers', 'ips'])(
  'GET /api/statistics/%s 返回数组且不跨币种相加',
  async dimension => {
    const res = await authed(request(app.getHttpServer()).get(`/api/statistics/${dimension}`))
    expect(res.status).toBe(200)
    for (const row of res.body as Array<{ amount: Array<{ currency: string; amount: number }> }>) {
      const currencies = row.amount.map(item => item.currency)
      expect(new Set(currencies).size).toBe(currencies.length)
    }
  },
)

it('GET /api/calendar/events 同一天付款优先于出货', async () => {
  const res = await authed(
    request(app.getHttpServer()).get('/api/calendar/events?from=2027-05-01&to=2027-05-31'),
  )
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
})

it('GET /api/collection 与 /stats 一致', async () => {
  const list = await authed(request(app.getHttpServer()).get('/api/collection'))
  const stats = await authed(request(app.getHttpServer()).get('/api/collection/stats'))
  expect(list.status).toBe(200)
  expect(stats.status).toBe(200)
  expect(stats.body.totalItems).toBeGreaterThanOrEqual(list.body.items.length)
})

it('GET /api/notifications/todos 返回提醒数组', async () => {
  const res = await authed(request(app.getHttpServer()).get('/api/notifications/todos'))
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
})

it('附件上传地址：归属校验通过时返回 path 前缀为 userId', async () => {
  const res = await authed(request(app.getHttpServer()).post('/api/attachments/upload-url')).send({
    bucket: 'attachments', targetType: 'ORDER', targetId: orderId,
    fileName: 'invoice.png', mimeType: 'image/png', fileSize: 1024,
  })
  expect(res.status).toBe(201)
  expect(String(res.body.path).startsWith(USER_A)).toBe(true)
})
```

（`orderId` 复用 P3 e2e 中创建的订单；Storage 的 `createSignedUploadUrl` 需在 `overrideProvider(SupabaseService)` 的 mock 中返回 `{ data: { token: 't', signedUrl: 'https://signed' }, error: null }`。）

- [x] **Step 2: 运行全部检查**

Run:

```bash
pnpm -r build
pnpm -r test
pnpm --filter @hobilog/server test:e2e
pnpm -r typecheck
```

Expected: 全绿；`read-models.e2e-spec.ts` 全 PASS。

- [x] **Step 3: 写验收记录并汇报**

`docs/superpowers/verification/2026-09-18-P4-verification.md` 记录命令、期望、实际、结论（含「多币种不合并」「归档订单不出现在统计与日历」两条口径验证）。

汇报格式：

```text
P4 完成：Statistics（dashboard / monthly / future / categories / platforms / manufacturers / ips）
+ Calendar + Collection + Attachment（signed URL）+ Notification（站内提醒）
口径验证：实际消费按 paid_at；多币种分离；归档订单排除
下一步：P5 前端 Web（Vue3 页面与联调）
```

- [ ] **Step 4: 提交（需用户授权）**

```bash
git add apps/server/test/read-models.e2e-spec.ts docs/superpowers/verification
git commit -m "test(statistics): add read-model acceptance against postgres"
```
