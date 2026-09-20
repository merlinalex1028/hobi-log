# HobiLog V0.1 订单生命周期（P3）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 HobiLog 核心：订单创建（事务）/ 列表（Tab + 筛选 + 分页）/ 详情（summaries + timeline）/ 编辑 / 取消，以及 Payment、ReleaseEvent、Shipment 的全部业务动作与状态机派生。

**Architecture:** 先写**纯函数领域层** `src/modules/order/domain/*`（无 IO、`today` 由调用方注入、100% 单测覆盖 12 个验收场景），再由 Service 负责归属校验、事务与持久化。所有写操作结束前调用 `OrderService.refreshStatus()`，让 `orders.status` 只反映 `ACTIVE / COMPLETED`，其余状态一律派生。

**Tech Stack:** 复用 P1/P2 全栈（NestJS 10 / Prisma 5 / class-validator / Jest + Supertest）。

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
| 错误码断言 | `toMatchObject({ code: 'XXX' })` | `toMatchObject({ response: { code: 'XXX' } })` | `BusinessException` 继承 `HttpException`，`code` 在 `getResponse()` 返回体里，不是异常顶层自有属性（P2 实测踩过，本计划已批量修正） |
| 单资源归属校验 | （P2 里 `INVALID_PLATFORM` / `INVALID_STORE`） | 404 + `<RESOURCE>_NOT_FOUND` | 单个资源「不存在或不属于当前用户」统一 404；400 `INVALID_*` 只用于批量 id 校验（本计划 `INVALID_PRODUCTS` / `INVALID_SHIPMENT_ITEMS`） |
| 模块结构 | 单文件内联 VO | 每模块 `mapper/<name>.mapper.ts` + `.spec.ts` | 与 P2 的 product / platform / store 保持一致 |
| `payment-summary.ts` / `shipment.ts` 的 OVERDUE 判断 | `status === 'PENDING' \|\| status === 'OVERDUE'` | 去掉 `'OVERDUE'` 分支（`isPending` 只判断 `'PENDING'`；`isOrderCompleted` 用 `status === 'PENDING' \|\| isOverdue(payment, today)`） | `PaymentStatus` 联合类型里没有 `OVERDUE`（不落库），原写法触发 TS2367 编译错误（Task 1 / 2 实测） |
| `display-status.ts` 的 `WAITING_PAYMENT` 提示 | `next.dueAt ? '…截止' : '暂无截止日期'` | `next.dueAt ? '…截止' : (next.amount === null ? '暂无截止日期' : null)` | 计划测试自相矛盾：`dueAt: null` 且金额已知的尾款期望 `null`，而 `dueAt: null` 且金额待定的邮费期望 `'暂无截止日期'`（Task 3 实测）。按「只有金额也待定才提示」可同时满足 |
| `display-status.spec.ts` 的 `it.each` 用例表 | 内联数组字面量 | 先声明 `nextPaymentCases: Array<[string, PaymentLike[], string]>` | `it.each` 不提供上下文类型，展开对象里的 `status` 被推断成 `string`，触发 TS2345（Task 3 实测） |
| `mapper/order-domain.mapper.ts` 导入 | `from '@prisma/client'` | `from '../../../generated/prisma/client'` | 约定：从生成目录导入（Task 4 实测） |
| VO 文件位置 | 另建 `vo/order-list.vo.ts` / `vo/order-detail.vo.ts` | `OrderListItemVo` / `TimelineItemVo` / `OrderDetailVo` 并入 `mapper/order.mapper.ts` | 与 P2 product / platform / store 一致（Task 4 实测） |
| DTO 枚举字段类型 | `paymentMode!: string`、`status?: string` | `PaymentMode`、`PaymentStatus`、`OrderStatus` | Prisma 枚举不接受 `string`，原写法 TS2322（Task 4 实测） |
| `refreshStatus` 类型断言 | `as OrderWithRelations` | `as unknown as OrderWithRelations` | 最小字段集对象与之无可比性，TS2352（Task 4 实测） |
| `order.service.ts` 导入 | 计划代码块用了 `OrderDomain` 但漏了 import | 补 `import type { OrderDomain } from './domain/types'` | 计划遗漏（Task 4 实测） |
| `QueryOrderDto.delayed` | `@Type(() => Boolean)` | `@Transform(({ value }) => value === true \|\| value === 'true')`，并加 `query-order.dto.spec.ts` | `Boolean('false') === true`，会把 `?delayed=false` 当成 true 过滤（Task 4 实测的潜在 bug） |
| `payment.service.ts` 的 `markPaid` 守卫 | `status !== 'PENDING' && status !== 'OVERDUE'` | `status !== 'PENDING'` | 同 #4：无 `OVERDUE` 枚举值；并补「PENDING 且已过期仍可标记付款」用例锁定语义（Task 5） |
| `CreatePaymentDto`（payment 模块） | 手写一份与 `CreateOrderDto` 内嵌 DTO 相同的字段 | `extends CreatePaymentDto`（from `../../order/dto/create-order.dto`）+ `sortOrder?` | 单一来源，避免两处校验规则漂移；字段集合不变（Task 5） |
| `release.service.ts` 依赖 | 计划 Interfaces 写 `OrderService.{assertOwned, getDomain}` | 用 `findOwnedWithRelations` + `toDomain` | `getDomain` 不存在，计划文字笔误（Task 6） |
| `BalanceOpenDto.paymentType` | `paymentType?: string` | 新常量 `BALANCE_OPEN_PAYMENT_TYPES = ['BALANCE','INSTALLMENT','OTHER']` + `@IsIn` | 约定 #6：枚举字段用联合类型（Task 6） |
| `CreateShipmentDto.status` / `UpdateShipmentDto.status` | `status?: string` | `'WAITING' \| 'SHIPPED'` / `ShipmentStatus` | 约定 #6（Task 7） |
| `ReleaseModule` / `ShipmentModule` | 计划未写 `exports` | 各自 `exports: [ReleaseService]` / `[ShipmentService]` | 与 `PaymentModule` 一致（Task 6 / 7） |
| 各 service spec 的 `tx` 脚手架 | `tx: Record<string, unknown>` + 内联对象 | 显式 `interface TxMock` + `txMock()` 工厂 | `tx.payment.update` 等被推断为 `unknown`，编译失败（Task 5 / 6 / 7） |
| e2e 的身份 mock（Task 8） | `Object.assign(new Error('invalid'), { status: 401 })` | `BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', …)` | 裸 `Error` 会被 `AllExceptionsFilter` 映射成 500（P2 已踩过） |
| e2e 的 app 装配（Task 8） | 只 `setGlobalPrefix` + filter | 追加 `createValidationPipe()` | 与 `main.ts` 一致（含 `whitelist + forbidNonWhitelisted`），e2e 才真正验证 DTO |
| e2e 的运行环境（Task 8） | 依赖 `test/setup-env.ts` 的 `??=` 兜底（`localhost:5432/hobilog_test`） | `setup-env.ts` 先用 `dotenv` 加载 `apps/server/.env`，再保留 `??=` 兜底 | 原写法下 e2e 根本连不上真实库（Task 8 实测踩到），改后 e2e 打到真实 Supabase PostgreSQL；单测无影响 |
| 场景 I 的调用顺序（Task 8） | 先签收第一个包裹，再创建第二个包裹 | 先建两个包裹（验证 `inTransitCount=2` 与超量 400）→ 依次签收（签收 A 后仍 `IN_TRANSIT`、签收 B 后 `COMPLETED`） | 与 `docs/07 §25` 冲突：完成条件 = 无待付款 + ≥1 物流 + 全部 DELIVERED，故首个包裹签收即 `COMPLETED`，后续建物流会 400 `ORDER_NOT_ACTIVE` |
| 远端库 e2e 的超时（Task 8） | 默认 5s | 该文件 `vi.setConfig({ testTimeout: 30_000 })` | 每个场景 1–3s 往返，默认超时会误报 |
| `setup-env.ts` 的路径解析（Task 8） | （初版用 `import.meta.url`） | `process.cwd()` 探测 + `existsSync` | TS 以 CommonJS 输出，`import.meta` 触发 TS1470 |

---

## Global Constraints

沿用 roadmap 全局约束与 P2 约束。P3 追加：

- 领域层纯函数禁止 import `PrismaService` 与 `new Date()`；`today: string`（`YYYY-MM-DD`）必须由调用方传入。
- 状态权威来源唯一：`payments` / `release_events` / `shipments`；禁止新增 `orders.payment_status` 等冗余字段。
- `PaymentStatus.OVERDUE` 不落库，一律由 `isOverdue(payment, today)` 派生。
- 退款用 `Payment(type = REFUND)` 且金额为正数；退款不修改原付款金额。
- 延期只新增 `ReleaseEvent(type = DELAY)`，`oldDate` 取当前计划出货日，禁止覆盖历史。
- 金额出口 `number`；`@db.Date` 出口 `YYYY-MM-DD`；timestamp 出口完整 ISO。
- 操作权限（`docs/07 §87`）：标记付款仅 `PENDING/OVERDUE`；退款仅 `PAID/PARTIALLY_REFUNDED`；延期仅 `ACTIVE` 且未 `RELEASED`；创建物流仅 `ACTIVE`；标记签收仅 `SHIPPED/IN_TRANSIT`。
- 提交策略同 P1：`git commit` 步骤仅在用户授权时执行。

---

### Task 1: 领域类型与付款汇总纯函数

**Files:**
- Create: `apps/server/src/modules/order/domain/types.ts`
- Create: `apps/server/src/modules/order/domain/payment-summary.ts`
- Create: `apps/server/src/modules/order/domain/payment-summary.spec.ts`

**Interfaces:**
- Consumes: `@hobilog/shared` 的 `PaymentStatus` / `OrderStatus` / `ShipmentStatus` / `PaymentSummaryStatus`
- Produces: `PaymentLike`、`ReleaseEventLike`、`ShipmentLike`、`OrderDomain`、`NextPaymentInfo`；`isOverdue`、`getPaidAmount`、`getRefundAmount`、`getNetPaidAmount`、`getPendingAmount`、`getPaymentProgress`、`getPaymentSummaryStatus`、`getNextPayment`、`getNextPaymentLabel`

- [x] **Step 1: 写 `domain/types.ts`**

```ts
import type { OrderStatus, PaymentStatus, ShipmentStatus } from '@hobilog/shared'

export interface PaymentLike {
  id: string
  type: string
  name: string | null
  amount: number | null
  status: PaymentStatus
  expectedAt: string | null
  dueAt: string | null
  paidAt: string | null
  sortOrder: number
}

export interface ReleaseEventLike {
  id: string
  type: string
  oldDate: string | null
  newDate: string | null
  datePrecision: string | null
  occurredAt: string
}

export interface ShipmentLike {
  id: string
  status: ShipmentStatus
  carrier: string | null
  trackingNo: string | null
  shippedAt: string | null
  estimatedDeliveryAt: string | null
  deliveredAt: string | null
}

export interface OrderDomain {
  id: string
  status: OrderStatus
  archived: boolean
  currency: string
  totalAmount: number
  payments: PaymentLike[]
  releaseEvents: ReleaseEventLike[]
  shipments: ShipmentLike[]
}
```

- [x] **Step 2: 写失败的 `payment-summary.spec.ts`**

```ts
import type { PaymentLike } from './types'
import {
  getNetPaidAmount, getNextPayment, getNextPaymentLabel, getPaidAmount, getPaymentProgress,
  getPaymentSummaryStatus, getPendingAmount, getRefundAmount, isOverdue,
} from './payment-summary'

const TODAY = '2027-03-20'

const payment = (patch: Partial<PaymentLike>): PaymentLike => ({
  id: 'pay', type: 'BALANCE', name: null, amount: 999, status: 'PENDING',
  expectedAt: null, dueAt: null, paidAt: null, sortOrder: 0, ...patch,
})

describe('isOverdue', () => {
  it('PENDING 且 dueAt 早于今天 → true', () => {
    expect(isOverdue(payment({ dueAt: '2027-03-19' }), TODAY)).toBe(true)
  })
  it('当天不算逾期', () => {
    expect(isOverdue(payment({ dueAt: TODAY }), TODAY)).toBe(false)
  })
  it('无 dueAt 不算逾期', () => {
    expect(isOverdue(payment({ dueAt: null }), TODAY)).toBe(false)
  })
  it('已付款不算逾期', () => {
    expect(isOverdue(payment({ status: 'PAID', dueAt: '2020-01-01' }), TODAY)).toBe(false)
  })
})

describe('金额汇总', () => {
  const payments = [
    payment({ id: 'd', type: 'DEPOSIT', amount: 300, status: 'PAID' }),
    payment({ id: 'b', amount: 999, dueAt: '2027-03-27' }),
    payment({ id: 's', type: 'SHIPPING', amount: null }),
    payment({ id: 'r', type: 'REFUND', amount: 300, status: 'PAID' }),
    payment({ id: 'c', amount: 100, status: 'CANCELLED' }),
  ]

  it('已支付 = PAID 且非 REFUND', () => {
    expect(getPaidAmount(payments)).toBe(300)
  })
  it('退款金额 = PAID 且 REFUND', () => {
    expect(getRefundAmount(payments)).toBe(300)
  })
  it('净支出 = 已支付 - 退款', () => {
    expect(getNetPaidAmount(payments)).toBe(0)
  })
  it('待付款只累加有金额的待付节点', () => {
    expect(getPendingAmount(payments)).toBe(999)
  })
  it('进度 = 已支付 / 总额（四舍五入）', () => {
    expect(getPaymentProgress(payments, 1299)).toBe(23)
  })
  it('总额为 0 时进度为 0', () => {
    expect(getPaymentProgress(payments, 0)).toBe(0)
  })
})

describe('getPaymentSummaryStatus', () => {
  it('存在逾期待付款 → OVERDUE', () => {
    expect(
      getPaymentSummaryStatus([payment({ type: 'DEPOSIT', status: 'PAID', amount: 300 }), payment({ dueAt: '2027-03-01' })], TODAY),
    ).toBe('OVERDUE')
  })
  it('已付 + 待付 → PARTIALLY_PAID', () => {
    expect(
      getPaymentSummaryStatus([payment({ type: 'DEPOSIT', status: 'PAID', amount: 300 }), payment({ dueAt: null })], TODAY),
    ).toBe('PARTIALLY_PAID')
  })
  it('全部已付 → PAID', () => {
    expect(getPaymentSummaryStatus([payment({ status: 'PAID', paidAt: '2027-03-18T00:00:00.000Z' })], TODAY)).toBe('PAID')
  })
  it('只有待付且从未付过 → UNPAID', () => {
    expect(getPaymentSummaryStatus([payment({ dueAt: null })], TODAY)).toBe('UNPAID')
  })
  it('金额待定（amount = null）仍算存在待付款', () => {
    expect(getPaymentSummaryStatus([payment({ type: 'SHIPPING', amount: null })], TODAY)).toBe('UNPAID')
  })
  it('没有任何付款节点 → UNPAID', () => {
    expect(getPaymentSummaryStatus([], TODAY)).toBe('UNPAID')
  })
})

describe('getNextPayment', () => {
  it('取最早 dueAt', () => {
    const next = getNextPayment([payment({ id: 'b', dueAt: '2027-04-01', sortOrder: 1 }), payment({ id: 'a', dueAt: '2027-03-25', sortOrder: 2 })], TODAY)
    expect(next?.id).toBe('a')
  })
  it('无 dueAt 的排在最后', () => {
    const next = getNextPayment([payment({ id: 'none', dueAt: null, sortOrder: 0 }), payment({ id: 'dated', dueAt: '2027-05-01', sortOrder: 9 })], TODAY)
    expect(next?.id).toBe('dated')
  })
  it('都没有 dueAt 时取 sortOrder 最小', () => {
    expect(getNextPayment([payment({ id: 'second', sortOrder: 2 }), payment({ id: 'first', sortOrder: 1 })], TODAY)?.id).toBe('first')
  })
  it('逾期节点带逾期天数', () => {
    const next = getNextPayment([payment({ id: 'later', dueAt: '2027-04-01' }), payment({ id: 'overdue', dueAt: '2027-03-15' })], TODAY)
    expect(next?.id).toBe('overdue')
    expect(next?.isOverdue).toBe(true)
    expect(next?.overdueDays).toBe(5)
  })
  it('已付款节点不参与', () => {
    expect(getNextPayment([payment({ status: 'PAID', dueAt: '2027-03-01' })], TODAY)).toBeNull()
  })
  it('CANCELLED / REFUNDED 节点不参与', () => {
    expect(getNextPayment([payment({ status: 'CANCELLED' }), payment({ status: 'REFUNDED' })], TODAY)).toBeNull()
  })
})

describe('getNextPaymentLabel', () => {
  it.each([
    ['DEPOSIT', '待付定金'],
    ['BALANCE', '待补尾款'],
    ['SHIPPING', '待补邮'],
    ['TAX', '待补税'],
    ['INSTALLMENT', '待阶段付款'],
    ['SUPPLEMENT', '待补差价'],
    ['FULL', '待付款'],
    ['OTHER', '待付款'],
  ])('%s → %s', (type, label) => {
    expect(getNextPaymentLabel(type)).toBe(label)
  })
})
```

- [x] **Step 3: 运行确认失败**

Run: `pnpm --filter @hobilog/server test`
Expected: FAIL，`Cannot find module './payment-summary'`。（实测一致）

- [x] **Step 4: 实现 `payment-summary.ts`**

```ts
import type { PaymentSummaryStatus } from '@hobilog/shared'
import type { PaymentLike } from './types'

const REFUND_TYPE = 'REFUND'

export interface NextPaymentInfo {
  id: string
  type: string
  name: string | null
  amount: number | null
  dueAt: string | null
  isOverdue: boolean
  overdueDays: number
}

function diffDays(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`)
  const toTime = Date.parse(`${to}T00:00:00.000Z`)
  return Math.round((toTime - fromTime) / 86_400_000)
}

export function isOverdue(payment: PaymentLike, today: string): boolean {
  if (payment.status !== 'PENDING') return false
  if (!payment.dueAt) return false
  return payment.dueAt < today
}

function isPending(payment: PaymentLike): boolean {
  return payment.status === 'PENDING' || payment.status === 'OVERDUE'
}

export function getPaidAmount(payments: PaymentLike[]): number {
  return payments
    .filter(payment => payment.status === 'PAID' && payment.type !== REFUND_TYPE)
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function getRefundAmount(payments: PaymentLike[]): number {
  return payments
    .filter(payment => payment.status === 'PAID' && payment.type === REFUND_TYPE)
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function getNetPaidAmount(payments: PaymentLike[]): number {
  return getPaidAmount(payments) - getRefundAmount(payments)
}

export function getPendingAmount(payments: PaymentLike[]): number {
  return payments
    .filter(payment => isPending(payment) && payment.amount !== null)
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function getPaymentProgress(payments: PaymentLike[], totalAmount: number): number {
  if (totalAmount <= 0) return 0
  const progress = Math.round((getPaidAmount(payments) / totalAmount) * 100)
  return Math.min(100, Math.max(0, progress))
}

export function getPaymentSummaryStatus(payments: PaymentLike[], today: string): PaymentSummaryStatus {
  const pending = payments.filter(isPending)
  if (pending.some(payment => isOverdue(payment, today))) return 'OVERDUE'
  if (pending.length > 0) {
    return getPaidAmount(payments) > 0 ? 'PARTIALLY_PAID' : 'UNPAID'
  }
  const hasRealPayment = payments.some(
    payment => payment.status !== 'CANCELLED' && payment.status !== 'REFUNDED' && payment.type !== REFUND_TYPE,
  )
  return hasRealPayment ? 'PAID' : 'UNPAID'
}

export function getNextPayment(payments: PaymentLike[], today: string): NextPaymentInfo | null {
  const candidates = payments.filter(isPending)
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => {
    const aDue = a.dueAt ?? '9999-12-31'
    const bDue = b.dueAt ?? '9999-12-31'
    if (aDue !== bDue) return aDue < bDue ? -1 : 1
    return a.sortOrder - b.sortOrder
  })
  const target = sorted[0]
  if (!target) return null
  const overdue = isOverdue(target, today)
  return {
    id: target.id,
    type: target.type,
    name: target.name,
    amount: target.amount,
    dueAt: target.dueAt,
    isOverdue: overdue,
    overdueDays: overdue && target.dueAt ? diffDays(target.dueAt, today) : 0,
  }
}

const NEXT_PAYMENT_LABELS: Record<string, string> = {
  DEPOSIT: '待付定金',
  BALANCE: '待补尾款',
  SHIPPING: '待补邮',
  TAX: '待补税',
  INSTALLMENT: '待阶段付款',
  SUPPLEMENT: '待补差价',
}

export function getNextPaymentLabel(type: string): string {
  return NEXT_PAYMENT_LABELS[type] ?? '待付款'
}
```

- [x] **Step 5: 运行测试并提交**

Run: `pnpm --filter @hobilog/server test` → Expected: PASS。（实测：payment-summary 30 tests，全套 15 files / 101 tests 全绿；typecheck 无错误）

```bash
git add apps/server/src/modules/order/domain
git commit -m "feat(order): add payment summary domain functions"
```

---

### Task 2: 出货 / 物流派生纯函数

**Files:**
- Create: `apps/server/src/modules/order/domain/release.ts`
- Create: `apps/server/src/modules/order/domain/release.spec.ts`
- Create: `apps/server/src/modules/order/domain/shipment.ts`
- Create: `apps/server/src/modules/order/domain/shipment.spec.ts`

**Interfaces:**
- Consumes: `Task 1` 的类型与 `getPaidAmount`
- Produces: `getReleaseStatus`、`isReleased`、`getPlannedReleaseDate`、`getDelayMonths`、`getDelayHistory`、`getShipmentSummaryStatus`、`hasShippedShipment`、`countInTransit`、`isOrderCompleted`

- [x] **Step 1: 写失败的 `release.spec.ts`**

```ts
import type { ReleaseEventLike } from './types'
import { getDelayHistory, getDelayMonths, getPlannedReleaseDate, getReleaseStatus, isReleased } from './release'

const event = (patch: Partial<ReleaseEventLike>): ReleaseEventLike => ({
  id: 'e1', type: 'EXPECTED_RELEASE', oldDate: null, newDate: '2027-01-01',
  datePrecision: 'MONTH', occurredAt: '2026-09-18T00:00:00.000Z', ...patch,
})

const delay = (patch: Partial<ReleaseEventLike> = {}) =>
  event({ id: 'e-delay', type: 'DELAY', oldDate: '2027-01-01', newDate: '2027-05-01', occurredAt: '2027-01-05T00:00:00.000Z', ...patch })

describe('getReleaseStatus', () => {
  it.each([
    ['无事件', [] as ReleaseEventLike[], 'UNKNOWN'],
    ['EXPECTED_RELEASE', [event({})], 'WAITING_RELEASE'],
    ['DELAY', [event({}), delay({ newDate: '2027-03-01' })], 'DELAYED'],
    ['RELEASED', [event({}), delay(), event({ id: 'e2', type: 'RELEASED', newDate: '2027-05-16' })], 'RELEASED'],
    ['STORE_ARRIVED', [event({ type: 'RELEASED' }), event({ id: 'e2', type: 'STORE_ARRIVED' })], 'STORE_ARRIVED'],
    ['SHIPMENT_READY', [event({ type: 'STORE_ARRIVED' }), event({ id: 'e2', type: 'SHIPMENT_READY' })], 'READY_TO_SHIP'],
  ])('%s → %s', (_name, events, expected) => {
    expect(getReleaseStatus(events)).toBe(expected)
  })

  it('进度序优先于时间序：后记录的 DELAY 不回退已 RELEASED', () => {
    expect(
      getReleaseStatus([
        event({ id: 'e2', type: 'RELEASED', occurredAt: '2027-05-16T00:00:00.000Z' }),
        delay({ occurredAt: '2027-05-20T00:00:00.000Z' }),
      ]),
    ).toBe('RELEASED')
  })
})

describe('getPlannedReleaseDate', () => {
  it('取最后一次调整后的日期与精度', () => {
    expect(
      getPlannedReleaseDate([
        event({}),
        delay({ occurredAt: '2027-01-05T00:00:00.000Z' }),
        delay({ id: 'e3', oldDate: '2027-05-01', newDate: '2027-07-18', datePrecision: 'DAY', occurredAt: '2027-03-05T00:00:00.000Z' }),
      ]),
    ).toEqual({ date: '2027-07-18', precision: 'DAY' })
  })

  it('无计划事件 → null', () => {
    expect(getPlannedReleaseDate([])).toBeNull()
  })
})

describe('getDelayMonths', () => {
  it('按初始预计 → 最新预计的月份差', () => {
    expect(getDelayMonths([event({}), delay()])).toBe(4)
  })

  it('多次延期不重复累加', () => {
    expect(
      getDelayMonths([
        event({}),
        delay({ newDate: '2027-03-01', occurredAt: '2027-01-05T00:00:00.000Z' }),
        delay({ id: 'e3', oldDate: '2027-03-01', newDate: '2027-05-01', occurredAt: '2027-03-05T00:00:00.000Z' }),
      ]),
    ).toBe(4)
  })

  it('无延期 → 0', () => {
    expect(getDelayMonths([event({})])).toBe(0)
  })
})

describe('getDelayHistory', () => {
  it('按发生时间升序返回 Δ 记录', () => {
    const history = getDelayHistory([
      delay({ id: 'late', oldDate: '2027-03-01', newDate: '2027-05-01', occurredAt: '2027-03-05T00:00:00.000Z' }),
      delay({ id: 'early', occurredAt: '2027-01-05T00:00:00.000Z' }),
    ])
    expect(history.map(item => item.oldDate)).toEqual(['2027-01-01', '2027-03-01'])
  })
})

describe('isReleased', () => {
  it.each([
    ['RELEASED', true],
    ['STORE_ARRIVED', true],
    ['SHIPMENT_READY', true],
    ['DELAY', false],
    ['EXPECTED_RELEASE', false],
  ])('%s → %s', (type, expected) => {
    expect(isReleased([event({ type })])).toBe(expected)
  })
})
```

- [x] **Step 2: 实现 `release.ts`**

```ts
import type { ReleaseStatus } from '@hobilog/shared'
import type { ReleaseEventLike } from './types'

const PROGRESS_RANK: Record<string, number> = {
  EXPECTED_RELEASE: 0,
  DELAY: 1,
  RELEASED: 2,
  STORE_ARRIVED: 3,
  SHIPMENT_READY: 4,
}

const RANK_TO_STATUS: Record<number, ReleaseStatus> = {
  0: 'WAITING_RELEASE',
  1: 'DELAYED',
  2: 'RELEASED',
  3: 'STORE_ARRIVED',
  4: 'READY_TO_SHIP',
}

function byOccurredAtAsc(a: ReleaseEventLike, b: ReleaseEventLike): number {
  return a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0
}

export function getReleaseStatus(events: ReleaseEventLike[]): ReleaseStatus {
  if (events.length === 0) return 'UNKNOWN'
  const maxRank = events.reduce((max, event) => Math.max(max, PROGRESS_RANK[event.type] ?? -1), -1)
  if (maxRank < 0) return 'UNKNOWN'
  return RANK_TO_STATUS[maxRank] ?? 'UNKNOWN'
}

export function isReleased(events: ReleaseEventLike[]): boolean {
  const status = getReleaseStatus(events)
  return status === 'RELEASED' || status === 'STORE_ARRIVED' || status === 'READY_TO_SHIP'
}

export function getPlannedReleaseDate(events: ReleaseEventLike[]): { date: string; precision: string } | null {
  const planned = events
    .filter(event => event.type === 'EXPECTED_RELEASE' || event.type === 'DELAY')
    .filter(event => event.newDate !== null)
    .sort(byOccurredAtAsc)
  const latest = planned[planned.length - 1]
  if (!latest?.newDate) return null
  return { date: latest.newDate, precision: latest.datePrecision ?? 'MONTH' }
}

function monthDiff(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear ?? 0) * 12 + (toMonth ?? 0) - ((fromYear ?? 0) * 12 + (fromMonth ?? 0))
}

export function getDelayMonths(events: ReleaseEventLike[]): number {
  const initial = events
    .filter(event => event.type === 'EXPECTED_RELEASE' && event.newDate !== null)
    .sort(byOccurredAtAsc)[0]
  const planned = getPlannedReleaseDate(events)
  if (!initial?.newDate || !planned) return 0
  return Math.max(0, monthDiff(initial.newDate, planned.date))
}

export function getDelayHistory(
  events: ReleaseEventLike[],
): Array<{ oldDate: string | null; newDate: string | null; occurredAt: string }> {
  return events
    .filter(event => event.type === 'DELAY')
    .sort(byOccurredAtAsc)
    .map(event => ({ oldDate: event.oldDate, newDate: event.newDate, occurredAt: event.occurredAt }))
}
```

- [x] **Step 3: 写失败的 `shipment.spec.ts`**

```ts
import type { OrderDomain, PaymentLike, ShipmentLike } from './types'
import { countInTransit, getShipmentSummaryStatus, hasShippedShipment, isOrderCompleted } from './shipment'

const shipment = (patch: Partial<ShipmentLike>): ShipmentLike => ({
  id: 'sh1', status: 'WAITING', carrier: null, trackingNo: null,
  shippedAt: null, estimatedDeliveryAt: null, deliveredAt: null, ...patch,
})

const paidFull: PaymentLike = {
  id: 'p1', type: 'FULL', name: null, amount: 1299, status: 'PAID',
  expectedAt: null, dueAt: null, paidAt: '2026-09-18T00:00:00.000Z', sortOrder: 0,
}

const base: OrderDomain = {
  id: 'o1', status: 'ACTIVE', archived: false, currency: 'CNY', totalAmount: 1299,
  payments: [paidFull], releaseEvents: [], shipments: [],
}

describe('getShipmentSummaryStatus', () => {
  it('无物流 → null', () => {
    expect(getShipmentSummaryStatus([])).toBeNull()
  })
  it('EXCEPTION 优先于 IN_TRANSIT', () => {
    expect(getShipmentSummaryStatus([shipment({ id: 'a', status: 'IN_TRANSIT' }), shipment({ id: 'b', status: 'EXCEPTION' })])).toBe('EXCEPTION')
  })
  it('I 场景：1 DELIVERED + 1 IN_TRANSIT → IN_TRANSIT', () => {
    expect(
      getShipmentSummaryStatus([
        shipment({ id: 'a', status: 'DELIVERED', deliveredAt: '2027-05-21T00:00:00.000Z' }),
        shipment({ id: 'b', status: 'IN_TRANSIT' }),
      ]),
    ).toBe('IN_TRANSIT')
  })
  it('全部 DELIVERED → DELIVERED', () => {
    expect(getShipmentSummaryStatus([shipment({ status: 'DELIVERED' })])).toBe('DELIVERED')
  })
})

describe('hasShippedShipment', () => {
  it('仅 WAITING 不算已发出', () => {
    expect(hasShippedShipment([shipment({ status: 'WAITING' })])).toBe(false)
  })
  it.each(['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'] as const)('%s 算已发出', status => {
    expect(hasShippedShipment([shipment({ status })])).toBe(true)
  })
})

describe('countInTransit', () => {
  it('统计 SHIPPED + IN_TRANSIT 包裹数', () => {
    expect(
      countInTransit([shipment({ id: 'a', status: 'SHIPPED' }), shipment({ id: 'b', status: 'IN_TRANSIT' }), shipment({ id: 'c', status: 'DELIVERED' })]),
    ).toBe(2)
  })
})

describe('isOrderCompleted', () => {
  it('无物流 → false（线下自提需手动标记完成）', () => {
    expect(isOrderCompleted(base, '2027-01-01')).toBe(false)
  })
  it('有未付节点 → false', () => {
    expect(
      isOrderCompleted(
        {
          ...base,
          payments: [...base.payments, { ...paidFull, id: 'p2', type: 'SHIPPING', amount: null, status: 'PENDING', paidAt: null }],
          shipments: [shipment({ status: 'DELIVERED' })],
        },
        '2027-01-01',
      ),
    ).toBe(false)
  })
  it('J 场景：全部签收且无待付款 → true', () => {
    expect(isOrderCompleted({ ...base, shipments: [shipment({ status: 'DELIVERED' })] }, '2027-01-01')).toBe(true)
  })
  it('逾期节点存在时不算完成', () => {
    expect(
      isOrderCompleted(
        {
          ...base,
          payments: [...base.payments, { ...paidFull, id: 'p3', type: 'BALANCE', status: 'PENDING', dueAt: '2027-03-01', paidAt: null }],
          shipments: [shipment({ status: 'DELIVERED' })],
        },
        '2027-03-20',
      ),
    ).toBe(false)
  })
  it('CANCELLED 付款节点不影响完成判定', () => {
    expect(
      isOrderCompleted(
        {
          ...base,
          payments: [...base.payments, { ...paidFull, id: 'p4', status: 'CANCELLED', paidAt: null }],
          shipments: [shipment({ status: 'DELIVERED' })],
        },
        '2027-01-01',
      ),
    ).toBe(true)
  })
})
```

- [x] **Step 4: 实现 `shipment.ts`**

```ts
import { SHIPMENT_SUMMARY_PRIORITY } from '@hobilog/shared'
import type { ShipmentStatus } from '@hobilog/shared'
import { isOverdue } from './payment-summary'
import type { OrderDomain, ShipmentLike } from './types'

const SHIPPED_STATUSES: ShipmentStatus[] = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED']
const IN_TRANSIT_STATUSES: ShipmentStatus[] = ['SHIPPED', 'IN_TRANSIT']

export function getShipmentSummaryStatus(shipments: ShipmentLike[]): ShipmentStatus | null {
  if (shipments.length === 0) return null
  return shipments.reduce<ShipmentStatus>(
    (best, shipment) =>
      SHIPMENT_SUMMARY_PRIORITY[shipment.status] < SHIPMENT_SUMMARY_PRIORITY[best] ? shipment.status : best,
    shipments[0]?.status ?? 'WAITING',
  )
}

export function hasShippedShipment(shipments: ShipmentLike[]): boolean {
  return shipments.some(shipment => SHIPPED_STATUSES.includes(shipment.status))
}

export function countInTransit(shipments: ShipmentLike[]): number {
  return shipments.filter(shipment => IN_TRANSIT_STATUSES.includes(shipment.status)).length
}

export function isOrderCompleted(order: OrderDomain, today: string): boolean {
  const hasPending = order.payments.some(
    payment => payment.status === 'PENDING' || payment.status === 'OVERDUE' || isOverdue(payment, today),
  )
  if (hasPending) return false
  if (order.shipments.length === 0) return false
  return order.shipments.every(shipment => shipment.status === 'DELIVERED')
}
```

- [x] **Step 5: 运行测试并提交**

Run: `pnpm --filter @hobilog/server test` → Expected: PASS。（实测：release 18 + shipment 15 tests，全套 17 files / 134 tests 全绿；typecheck 无错误）

```bash
git add apps/server/src/modules/order/domain
git commit -m "feat(order): add release and shipment derivation functions"
```

---

### Task 3: DisplayStatus（12 验收场景）

**Files:**
- Create: `apps/server/src/modules/order/domain/display-status.ts`
- Create: `apps/server/src/modules/order/domain/display-status.spec.ts`

**Interfaces:**
- Consumes: `Task 1` / `Task 2` 全部函数
- Produces: `getDisplayStatus(order, today): DisplayStatus`、`getDisplayStatusLabel(order, today): string`、`getDisplayStatusHint(order, today): string | null`

- [x] **Step 1: 写失败的 `display-status.spec.ts`**

```ts
import type { OrderDomain, PaymentLike, ReleaseEventLike, ShipmentLike } from './types'
import { getDisplayStatus, getDisplayStatusHint, getDisplayStatusLabel } from './display-status'

const TODAY = '2027-03-20'

const fullPaid: PaymentLike = {
  id: 'p1', type: 'FULL', name: null, amount: 1299, status: 'PAID',
  expectedAt: null, dueAt: null, paidAt: '2026-09-18T00:00:00.000Z', sortOrder: 0,
}
const depositPaid: PaymentLike = { ...fullPaid, id: 'p2', type: 'DEPOSIT', amount: 300 }
const balancePending: PaymentLike = {
  ...fullPaid, id: 'p3', type: 'BALANCE', amount: 999, status: 'PENDING', paidAt: null,
}
const balanceOverdue: PaymentLike = { ...balancePending, dueAt: '2027-03-01' }

const release = (type: string, newDate: string | null): ReleaseEventLike => ({
  id: `r-${type}`, type, oldDate: null, newDate, datePrecision: 'MONTH', occurredAt: '2026-09-18T00:00:00.000Z',
})

const shipment = (status: ShipmentLike['status']): ShipmentLike => ({
  id: `s-${status}`, status, carrier: '顺丰', trackingNo: 'SF1',
  shippedAt: '2027-05-18T00:00:00.000Z', estimatedDeliveryAt: null, deliveredAt: null,
})

const order = (patch: Partial<OrderDomain>): OrderDomain => ({
  id: 'o1', status: 'ACTIVE', archived: false, currency: 'CNY', totalAmount: 1299,
  payments: [fullPaid], releaseEvents: [], shipments: [], ...patch,
})

describe('getDisplayStatus 验收场景（docs/07 §96）', () => {
  it.each([
    ['A 全款现货：FULL PAID + DELIVERED', order({ shipments: [shipment('DELIVERED')] }), 'COMPLETED'],
    ['B 全款预售：FULL PAID + EXPECTED_RELEASE', order({ releaseEvents: [release('EXPECTED_RELEASE', '2027-05-01')] }), 'WAITING_RELEASE'],
    ['C 定金尾款：DEPOSIT PAID + BALANCE PENDING', order({ payments: [depositPaid, balancePending] }), 'WAITING_PAYMENT'],
    ['D 尾款逾期', order({ payments: [depositPaid, balanceOverdue] }), 'PAYMENT_OVERDUE'],
    ['F 厂商出货无物流', order({ releaseEvents: [release('RELEASED', '2027-05-16')] }), 'WAITING_SHIPMENT'],
    ['G 运输中', order({ releaseEvents: [release('RELEASED', '2027-05-16')], shipments: [shipment('IN_TRANSIT')] }), 'IN_TRANSIT'],
    ['H 物流异常', order({ shipments: [shipment('EXCEPTION')] }), 'SHIPMENT_EXCEPTION'],
    ['I 多包裹 1 DELIVERED + 1 IN_TRANSIT', order({ shipments: [shipment('DELIVERED'), shipment('IN_TRANSIT')] }), 'IN_TRANSIT'],
    ['J 全部签收', order({ shipments: [shipment('DELIVERED')] }), 'COMPLETED'],
    ['K 订单取消', order({ status: 'CANCELLED' }), 'CANCELLED'],
    ['L 退款结束', order({ status: 'REFUNDED' }), 'REFUNDED'],
    ['已付清未记录出货', order({}), 'WAITING_RELEASE'],
  ])('%s → %s', (_name, value, expected) => {
    expect(getDisplayStatus(value, TODAY)).toBe(expected)
  })

  it('E 延期 → WAITING_RELEASE 且标签体现延期', () => {
    const delayed = order({
      releaseEvents: [release('EXPECTED_RELEASE', '2027-01-01'), { ...release('DELAY', '2027-05-01'), oldDate: '2027-01-01' }],
    })
    expect(getDisplayStatus(delayed, TODAY)).toBe('WAITING_RELEASE')
    expect(getDisplayStatusLabel(delayed, TODAY)).toBe('延期 · 等待出货')
  })

  it('付款优先于出货：已 RELEASED 但尾款次日截止 → WAITING_PAYMENT', () => {
    expect(
      getDisplayStatus(
        order({ payments: [depositPaid, { ...balancePending, dueAt: '2027-03-21' }], releaseEvents: [release('RELEASED', '2027-05-16')] }),
        TODAY,
      ),
    ).toBe('WAITING_PAYMENT')
  })

  it('金额待定（amount = null）仍显示 WAITING_PAYMENT', () => {
    expect(
      getDisplayStatus(order({ payments: [fullPaid, { ...balancePending, id: 'p4', type: 'SHIPPING', amount: null, dueAt: null }] }), TODAY),
    ).toBe('WAITING_PAYMENT')
  })

  it('已被物流发出但仍有待付款 → WAITING_PAYMENT（付款优先）', () => {
    expect(getDisplayStatus(order({ payments: [depositPaid, balancePending], shipments: [shipment('IN_TRANSIT')] }), TODAY)).toBe('WAITING_PAYMENT')
  })
})

describe('getDisplayStatusLabel', () => {
  it.each([
    ['BALANCE', [depositPaid, balancePending], '待补尾款'],
    ['DEPOSIT', [{ ...fullPaid, type: 'DEPOSIT', status: 'PENDING', paidAt: null }], '待付定金'],
    ['SHIPPING', [fullPaid, { ...balancePending, type: 'SHIPPING', amount: null }], '待补邮'],
  ])('待付款按下一节点类型细化：%s', (_type, payments, expected) => {
    expect(getDisplayStatusLabel(order({ payments }), TODAY)).toBe(expected)
  })

  it('逾期标签带“已逾期”', () => {
    expect(getDisplayStatusLabel(order({ payments: [depositPaid, balanceOverdue] }), TODAY)).toBe('待补尾款 · 已逾期')
  })

  it('已签收用“已签收”文案', () => {
    expect(getDisplayStatusLabel(order({ shipments: [shipment('DELIVERED')] }), TODAY)).toBe('已签收')
  })
})

describe('getDisplayStatusHint', () => {
  it('逾期提示天数', () => {
    expect(getDisplayStatusHint(order({ payments: [depositPaid, balanceOverdue] }), TODAY)).toBe('已逾期 19 天')
  })

  it('待付款提示截止日', () => {
    expect(getDisplayStatusHint(order({ payments: [depositPaid, balancePending] }), TODAY)).toBeNull()
    expect(
      getDisplayStatusHint(order({ payments: [depositPaid, { ...balancePending, dueAt: '2027-03-27' }] }), TODAY),
    ).toBe('2027-03-27 截止')
  })

  it('无截止日提示“暂无截止日期”', () => {
    expect(getDisplayStatusHint(order({ payments: [{ ...fullPaid, type: 'SHIPPING', amount: null, status: 'PENDING', paidAt: null }] }), TODAY)).toBe('暂无截止日期')
  })

  it('运输中提示包裹数', () => {
    expect(getDisplayStatusHint(order({ shipments: [shipment('IN_TRANSIT'), shipment('IN_TRANSIT')] }), TODAY)).toBe('2 个包裹运输中')
  })

  it('等待出货提示预计月份', () => {
    expect(getDisplayStatusHint(order({ releaseEvents: [release('EXPECTED_RELEASE', '2027-05-01')] }), TODAY)).toBe('预计 2027年05月')
  })
})
```

- [x] **Step 2: 实现 `display-status.ts`**

```ts
import { DISPLAY_STATUS_LABELS } from '@hobilog/shared'
import type { DisplayStatus } from '@hobilog/shared'
import { getNextPayment, getNextPaymentLabel, isOverdue } from './payment-summary'
import { getDelayMonths, getPlannedReleaseDate, isReleased } from './release'
import { countInTransit, hasShippedShipment, isOrderCompleted } from './shipment'
import type { OrderDomain } from './types'

function hasOverduePayment(order: OrderDomain, today: string): boolean {
  return order.payments.some(payment => isOverdue(payment, today))
}

function hasPendingPayment(order: OrderDomain): boolean {
  return order.payments.some(payment => payment.status === 'PENDING' || payment.status === 'OVERDUE')
}

export function getDisplayStatus(order: OrderDomain, today: string): DisplayStatus {
  if (order.status === 'CANCELLED') return 'CANCELLED'
  if (order.status === 'REFUNDED') return 'REFUNDED'
  if (hasOverduePayment(order, today)) return 'PAYMENT_OVERDUE'
  if (hasPendingPayment(order)) return 'WAITING_PAYMENT'
  if (order.shipments.some(shipment => shipment.status === 'EXCEPTION')) return 'SHIPMENT_EXCEPTION'
  if (order.shipments.some(shipment => shipment.status === 'SHIPPED' || shipment.status === 'IN_TRANSIT')) {
    return 'IN_TRANSIT'
  }
  if (isReleased(order.releaseEvents) && !hasShippedShipment(order.shipments)) return 'WAITING_SHIPMENT'
  if (isOrderCompleted(order, today)) return 'COMPLETED'
  if (!isReleased(order.releaseEvents)) return 'WAITING_RELEASE'
  return 'ACTIVE'
}

export function getDisplayStatusLabel(order: OrderDomain, today: string): string {
  const status = getDisplayStatus(order, today)

  if (status === 'WAITING_PAYMENT' || status === 'PAYMENT_OVERDUE') {
    const next = getNextPayment(order.payments, today)
    if (next) {
      return next.isOverdue ? `${getNextPaymentLabel(next.type)} · 已逾期` : getNextPaymentLabel(next.type)
    }
  }

  if (status === 'WAITING_RELEASE' && getDelayMonths(order.releaseEvents) > 0) {
    return '延期 · 等待出货'
  }

  return DISPLAY_STATUS_LABELS[status]
}

export function getDisplayStatusHint(order: OrderDomain, today: string): string | null {
  const status = getDisplayStatus(order, today)

  if (status === 'PAYMENT_OVERDUE') {
    const next = getNextPayment(order.payments, today)
    return next?.overdueDays ? `已逾期 ${next.overdueDays} 天` : null
  }

  if (status === 'WAITING_PAYMENT') {
    const next = getNextPayment(order.payments, today)
    if (!next) return null
    return next.dueAt ? `${next.dueAt} 截止` : '暂无截止日期'
  }

  if (status === 'IN_TRANSIT') {
    const count = countInTransit(order.shipments)
    return count > 0 ? `${count} 个包裹运输中` : null
  }

  if (status === 'WAITING_RELEASE' || status === 'WAITING_SHIPMENT') {
    const planned = getPlannedReleaseDate(order.releaseEvents)
    return planned ? `预计 ${planned.date.slice(0, 7).replace('-', '年')}月` : null
  }

  return null
}
```

分支顺序必须与 `docs/07 §21` 一致：`CANCELLED → REFUNDED → PAYMENT_OVERDUE → WAITING_PAYMENT → SHIPMENT_EXCEPTION → IN_TRANSIT → WAITING_SHIPMENT → COMPLETED → WAITING_RELEASE → ACTIVE`（`COMPLETED` 判定内含「所有 Shipment 已签收」，故排在 `WAITING_SHIPMENT` 之后不影响 A/J 场景）。

- [x] **Step 3: 运行测试并提交**

Run: `pnpm --filter @hobilog/server test` → Expected: 12 场景 + 标签/提示用例全 PASS。（实测：display-status 26 tests，全套 18 files / 160 tests 全绿；typecheck 无错误）

```bash
git add apps/server/src/modules/order/domain
git commit -m "feat(order): add display status derivation covering acceptance scenarios"
```

---

### Task 4: Order 模块（创建事务 / 列表 Tab / 详情聚合 / 取消）

**Files:**
- Create: `apps/server/src/modules/order/dto/create-order.dto.ts`
- Create: `apps/server/src/modules/order/dto/update-order.dto.ts`
- Create: `apps/server/src/modules/order/dto/query-order.dto.ts`
- Create: `apps/server/src/modules/order/dto/cancel-order.dto.ts`
- Create: `apps/server/src/modules/order/mapper/order-domain.mapper.ts`
- Create: `apps/server/src/modules/order/mapper/order.mapper.ts`
- Create: `apps/server/src/modules/order/vo/order-list.vo.ts`
- Create: `apps/server/src/modules/order/vo/order-detail.vo.ts`
- Create: `apps/server/src/modules/order/order.service.ts`
- Create: `apps/server/src/modules/order/order.service.spec.ts`
- Create: `apps/server/src/modules/order/order.controller.ts`
- Create: `apps/server/src/modules/order/order.module.ts`
- Modify: `apps/server/src/modules/platform/platform.module.ts`（补 `exports: [PlatformService]`）
- Modify: `apps/server/src/modules/store/store.module.ts`（补 `exports: [StoreService]`）
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: 领域层、`ProductService.getOwnedProductIds`、`PlatformService.assertOwned`、`StoreService.assertOwned`、`serialize`、`PaginationQueryDto`
- Produces:
  - API：`GET /api/orders`、`POST /api/orders`、`GET /api/orders/:id`、`PATCH /api/orders/:id`、`POST /api/orders/:id/cancel`
  - `OrderListItemVo`、`OrderDetailVo`、`TimelineItemVo`
  - `ORDER_INCLUDE`、`buildTabWhere(tab, today)`、`OrderService.{create,list,getDetail,update,cancel,refreshStatus,assertOwned,findOwnedWithRelations,today}`

- [x] **Step 1: 写 DTO（4 个文件）**

`dto/create-order.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize, IsArray, IsBoolean, IsIn, IsISO8601, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested,
} from 'class-validator'
import { PAYMENT_MODES, PAYMENT_TYPES, SUPPORTED_CURRENCIES } from '@hobilog/shared'

export class CreateOrderItemDto {
  @ApiProperty() @IsUUID() productId!: string
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity: number = 1
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice!: number
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}

export class CreatePaymentDto {
  @ApiProperty({ enum: PAYMENT_TYPES }) @IsIn(PAYMENT_TYPES) type!: string
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string
  @ApiPropertyOptional({ nullable: true, description: 'null 表示金额待定' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount?: number | null
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() paidAt?: string
  @ApiPropertyOptional({ enum: ['PENDING', 'PAID'] }) @IsOptional() @IsIn(['PENDING', 'PAID']) status?: string
  @ApiPropertyOptional() @IsOptional() @IsString() paymentMethod?: string
  @ApiPropertyOptional() @IsOptional() @IsString() transactionNo?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}

export class ExpectedReleaseDto {
  @ApiProperty({ example: '2027-05-01' }) @IsISO8601() date!: string
  @ApiPropertyOptional({ enum: ['DAY', 'MONTH'] }) @IsOptional() @IsIn(['DAY', 'MONTH']) precision?: 'DAY' | 'MONTH'
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[]

  @ApiPropertyOptional() @IsOptional() @IsUUID() platformId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() storeId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) orderNo?: string
  @ApiPropertyOptional() @IsOptional() @IsString() orderUrl?: string
  @ApiProperty() @IsISO8601() orderedAt!: string
  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, default: 'CNY' })
  @IsOptional() @IsIn(SUPPORTED_CURRENCIES) currency: string = 'CNY'

  @ApiPropertyOptional({ default: true, description: '是否用 items 自动计算商品金额' })
  @IsOptional() @IsBoolean() autoCalculateGoodsAmount: boolean = true
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) goodsAmount: number = 0
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discountAmount: number = 0
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) shippingAmount: number = 0
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) taxAmount: number = 0
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) extraAmount: number = 0

  @ApiProperty({ enum: PAYMENT_MODES }) @IsIn(PAYMENT_MODES) paymentMode!: string

  @ApiProperty({ type: [CreatePaymentDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreatePaymentDto)
  payments!: CreatePaymentDto[]

  @ApiPropertyOptional({ type: ExpectedReleaseDto })
  @IsOptional() @ValidateNested() @Type(() => ExpectedReleaseDto) expectedRelease?: ExpectedReleaseDto

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
```

`dto/update-order.dto.ts`:

```ts
import { OmitType, PartialType } from '@nestjs/swagger'
import { CreateOrderDto } from './create-order.dto'

export class UpdateOrderDto extends PartialType(OmitType(CreateOrderDto, ['items', 'payments'] as const)) {}
```

`dto/query-order.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator'
import { ORDER_STATUSES, PAYMENT_SUMMARY_STATUSES, PRODUCT_CATEGORIES } from '@hobilog/shared'
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto'

export const ORDER_TABS = [
  'ALL', 'WAITING_PAYMENT', 'PAYMENT_OVERDUE', 'WAITING_RELEASE', 'WAITING_SHIPMENT',
  'IN_TRANSIT', 'SHIPMENT_EXCEPTION', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ARCHIVED',
] as const
export type OrderTab = (typeof ORDER_TABS)[number]

export class QueryOrderDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ORDER_TABS, default: 'ALL' })
  @IsOptional() @IsIn(ORDER_TABS) tab: OrderTab = 'ALL'

  @ApiPropertyOptional({ description: '关键词：订单号 / 商品名' })
  @IsOptional() @IsString() keyword?: string

  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional() @IsIn(ORDER_STATUSES) status?: string

  @ApiPropertyOptional({ enum: PAYMENT_SUMMARY_STATUSES })
  @IsOptional() @IsIn(PAYMENT_SUMMARY_STATUSES) paymentSummaryStatus?: string

  @ApiPropertyOptional() @IsOptional() @IsUUID() platformId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() storeId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() manufacturer?: string
  @ApiPropertyOptional() @IsOptional() @IsString() ipName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() characterName?: string

  @ApiPropertyOptional({ enum: PRODUCT_CATEGORIES })
  @IsOptional() @IsIn(PRODUCT_CATEGORIES) category?: string

  @ApiPropertyOptional({ description: '下单年份，如 2026' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) year?: number

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) priceMin?: number
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) priceMax?: number

  @ApiPropertyOptional({ description: '只看有延期记录的订单' })
  @IsOptional() @Type(() => Boolean) @IsBoolean() delayed?: boolean
}
```

`dto/cancel-order.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class CancelOrderDto {
  @ApiPropertyOptional({ default: false, description: '是否按已付款净额自动生成退款记录' })
  @IsOptional() @IsBoolean() refund: boolean = false

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
```

- [x] **Step 2: 写 domain mapper 与 VO 定义**

`mapper/order-domain.mapper.ts`:

```ts
import type { Prisma } from '@prisma/client'
import { toDateString, toIsoString, toNumber } from '../../../common/utils/serialize'
import type { OrderDomain, PaymentLike, ReleaseEventLike, ShipmentLike } from '../domain/types'

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: true } }
    payments: true
    releaseEvents: true
    shipments: { include: { items: true } }
    orderEvents: true
    attachments: true
    platform: true
    store: true
  }
}>

export function toPaymentLike(payment: OrderWithRelations['payments'][number]): PaymentLike {
  return {
    id: payment.id,
    type: payment.type,
    name: payment.name,
    amount: toNumber(payment.amount),
    status: payment.status,
    expectedAt: toDateString(payment.expectedAt),
    dueAt: toDateString(payment.dueAt),
    paidAt: toIsoString(payment.paidAt),
    sortOrder: payment.sortOrder,
  }
}

export function toReleaseEventLike(event: OrderWithRelations['releaseEvents'][number]): ReleaseEventLike {
  return {
    id: event.id,
    type: event.type,
    oldDate: toDateString(event.oldDate),
    newDate: toDateString(event.newDate),
    datePrecision: event.datePrecision,
    occurredAt: event.occurredAt.toISOString(),
  }
}

export function toShipmentLike(shipment: OrderWithRelations['shipments'][number]): ShipmentLike {
  return {
    id: shipment.id,
    status: shipment.status,
    carrier: shipment.carrier,
    trackingNo: shipment.trackingNo,
    shippedAt: toIsoString(shipment.shippedAt),
    estimatedDeliveryAt: toIsoString(shipment.estimatedDeliveryAt),
    deliveredAt: toIsoString(shipment.deliveredAt),
  }
}

export function toOrderDomain(order: OrderWithRelations): OrderDomain {
  return {
    id: order.id,
    status: order.status,
    archived: order.archived,
    currency: order.currency,
    totalAmount: toNumber(order.totalAmount) ?? 0,
    payments: order.payments.map(toPaymentLike).sort((a, b) => a.sortOrder - b.sortOrder),
    releaseEvents: order.releaseEvents.map(toReleaseEventLike),
    shipments: order.shipments.map(toShipmentLike),
  }
}
```

`vo/order-list.vo.ts`:

```ts
import type { DisplayStatus, OrderStatus, PaymentSummaryStatus, ReleaseStatus, ShipmentStatus } from '@hobilog/shared'
import type { NextPaymentInfo } from '../domain/payment-summary'

export interface OrderListItemVo {
  id: string
  orderNo: string | null
  orderedAt: string
  currency: string
  totalAmount: number
  paymentMode: string
  status: OrderStatus
  archived: boolean
  platformId: string | null
  platformName: string | null
  storeId: string | null
  storeName: string | null
  itemCount: number
  productSummaries: Array<{ productId: string; name: string; coverUrl: string | null }>
  displayStatus: DisplayStatus
  displayStatusLabel: string
  displayStatusHint: string | null
  paymentSummary: {
    status: PaymentSummaryStatus
    paidAmount: number
    pendingAmount: number
    refundAmount: number
    netPaidAmount: number
    progress: number
    nextPayment: NextPaymentInfo | null
  }
  releaseSummary: {
    status: ReleaseStatus
    plannedDate: string | null
    precision: string | null
    delayMonths: number
  }
  shipmentSummary: {
    status: ShipmentStatus | null
    carrier: string | null
    trackingNo: string | null
    inTransitCount: number
    total: number
  }
  updatedAt: string
}
```

`vo/order-detail.vo.ts`:

```ts
import type { OrderListItemVo } from './order-list.vo'

export interface TimelineItemVo {
  id: string
  type: string
  title: string
  description: string | null
  occurredAt: string
  source: 'ORDER' | 'PAYMENT' | 'RELEASE' | 'SHIPMENT'
}

export interface OrderDetailVo extends OrderListItemVo {
  orderUrl: string | null
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
  note: string | null
  createdAt: string
  items: Array<{
    id: string; productId: string; productName: string; coverUrl: string | null
    quantity: number; unitPrice: number; subtotal: number; note: string | null
  }>
  payments: Array<{
    id: string; type: string; name: string | null; amount: number | null; currency: string
    status: string; isOverdue: boolean; expectedAt: string | null; dueAt: string | null
    paidAt: string | null; paymentMethod: string | null; transactionNo: string | null
    note: string | null; sortOrder: number
  }>
  releaseEvents: Array<{
    id: string; type: string; label: string; oldDate: string | null; newDate: string | null
    datePrecision: string | null; occurredAt: string; source: string | null; sourceUrl: string | null; note: string | null
  }>
  shipments: Array<{
    id: string; carrier: string | null; trackingNo: string | null; status: string
    shippedAt: string | null; estimatedDeliveryAt: string | null; deliveredAt: string | null
    note: string | null; items: Array<{ orderItemId: string; productName: string; quantity: number }>
  }>
  attachments: Array<{
    id: string; type: string; fileName: string; storagePath: string; mimeType: string | null; createdAt: string
  }>
  orderEvents: Array<{ id: string; type: string; title: string; description: string | null; occurredAt: string }>
  timeline: TimelineItemVo[]
}
```

- [x] **Step 3: 写 `mapper/order.mapper.ts`（列表 / 详情 / timeline 聚合）**

```ts
import { RELEASE_EVENT_TYPE_LABELS } from '@hobilog/shared'
import { toDateString, toIsoString, toNumber } from '../../../common/utils/serialize'
import { getDisplayStatus, getDisplayStatusHint, getDisplayStatusLabel } from '../domain/display-status'
import {
  getNextPayment, getNetPaidAmount, getPaidAmount, getPaymentProgress, getPaymentSummaryStatus,
  getPendingAmount, getRefundAmount,
} from '../domain/payment-summary'
import { getDelayMonths, getPlannedReleaseDate, getReleaseStatus } from '../domain/release'
import { countInTransit, getShipmentSummaryStatus } from '../domain/shipment'
import type { OrderDetailVo, TimelineItemVo } from '../vo/order-detail.vo'
import type { OrderListItemVo } from '../vo/order-list.vo'
import type { OrderWithRelations } from './order-domain.mapper'
import { toOrderDomain } from './order-domain.mapper'

const REFUND_TYPE = 'REFUND'

export function toOrderListItemVo(order: OrderWithRelations, today: string): OrderListItemVo {
  const domain = toOrderDomain(order)
  const planned = getPlannedReleaseDate(domain.releaseEvents)
  const shipmentWithTracking = order.shipments.find(shipment => shipment.trackingNo !== null)

  return {
    id: order.id,
    orderNo: order.orderNo,
    orderedAt: toDateString(order.orderedAt) as string,
    currency: order.currency,
    totalAmount: toNumber(order.totalAmount) ?? 0,
    paymentMode: order.paymentMode,
    status: order.status,
    archived: order.archived,
    platformId: order.platformId,
    platformName: order.platform?.name ?? null,
    storeId: order.storeId,
    storeName: order.store?.name ?? null,
    itemCount: order.items.length,
    productSummaries: order.items.slice(0, 3).map(item => ({
      productId: item.productId,
      name: item.product.name,
      coverUrl: item.product.coverUrl,
    })),
    displayStatus: getDisplayStatus(domain, today),
    displayStatusLabel: getDisplayStatusLabel(domain, today),
    displayStatusHint: getDisplayStatusHint(domain, today),
    paymentSummary: {
      status: getPaymentSummaryStatus(domain.payments, today),
      paidAmount: getPaidAmount(domain.payments),
      pendingAmount: getPendingAmount(domain.payments),
      refundAmount: getRefundAmount(domain.payments),
      netPaidAmount: getNetPaidAmount(domain.payments),
      progress: getPaymentProgress(domain.payments, domain.totalAmount),
      nextPayment: getNextPayment(domain.payments, today),
    },
    releaseSummary: {
      status: getReleaseStatus(domain.releaseEvents),
      plannedDate: planned?.date ?? null,
      precision: planned?.precision ?? null,
      delayMonths: getDelayMonths(domain.releaseEvents),
    },
    shipmentSummary: {
      status: getShipmentSummaryStatus(domain.shipments),
      carrier: shipmentWithTracking?.carrier ?? null,
      trackingNo: shipmentWithTracking?.trackingNo ?? null,
      inTransitCount: countInTransit(domain.shipments),
      total: domain.shipments.length,
    },
    updatedAt: order.updatedAt.toISOString(),
  }
}

export function buildTimeline(order: OrderWithRelations): TimelineItemVo[] {
  const items: TimelineItemVo[] = []

  for (const payment of order.payments) {
    if (payment.status !== 'PAID' || !payment.paidAt) continue
    const isRefund = payment.type === REFUND_TYPE
    items.push({
      id: `payment:${payment.id}`,
      type: isRefund ? 'PAYMENT_REFUNDED' : 'PAYMENT_PAID',
      title: `${isRefund ? '退款' : '支付'}${payment.name ?? ''} ¥${Number(payment.amount ?? 0)}`,
      description: payment.note,
      occurredAt: payment.paidAt.toISOString(),
      source: 'PAYMENT',
    })
  }

  for (const event of order.releaseEvents) {
    items.push({
      id: `release:${event.id}`,
      type: event.type,
      title: RELEASE_EVENT_TYPE_LABELS[event.type as keyof typeof RELEASE_EVENT_TYPE_LABELS] ?? event.type,
      description:
        event.note ??
        (event.oldDate && event.newDate ? `${toDateString(event.oldDate)} → ${toDateString(event.newDate)}` : null),
      occurredAt: event.occurredAt.toISOString(),
      source: 'RELEASE',
    })
  }

  for (const shipment of order.shipments) {
    if (shipment.shippedAt) {
      items.push({
        id: `shipment-shipped:${shipment.id}`,
        type: 'SHIPMENT_SHIPPED',
        title: `店铺发货${shipment.carrier ? ` · ${shipment.carrier}` : ''}`,
        description: shipment.trackingNo,
        occurredAt: shipment.shippedAt.toISOString(),
        source: 'SHIPMENT',
      })
    }
    if (shipment.status === 'DELIVERED' && shipment.deliveredAt) {
      items.push({
        id: `shipment-delivered:${shipment.id}`,
        type: 'SHIPMENT_DELIVERED',
        title: '已签收',
        description: shipment.note,
        occurredAt: shipment.deliveredAt.toISOString(),
        source: 'SHIPMENT',
      })
    }
  }

  for (const event of order.orderEvents) {
    items.push({
      id: `order:${event.id}`,
      type: event.type,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt.toISOString(),
      source: 'ORDER',
    })
  }

  return items.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
}

export function toOrderDetailVo(order: OrderWithRelations, today: string): OrderDetailVo {
  const list = toOrderListItemVo(order, today)

  return {
    ...list,
    orderUrl: order.orderUrl,
    goodsAmount: toNumber(order.goodsAmount) ?? 0,
    discountAmount: toNumber(order.discountAmount) ?? 0,
    shippingAmount: toNumber(order.shippingAmount) ?? 0,
    taxAmount: toNumber(order.taxAmount) ?? 0,
    extraAmount: toNumber(order.extraAmount) ?? 0,
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      coverUrl: item.product.coverUrl,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice) ?? 0,
      subtotal: toNumber(item.subtotal) ?? 0,
      note: item.note,
    })),
    payments: [...order.payments]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(payment => ({
        id: payment.id,
        type: payment.type,
        name: payment.name,
        amount: toNumber(payment.amount),
        currency: payment.currency,
        status: payment.status,
        isOverdue: payment.status === 'PENDING' && (toDateString(payment.dueAt) ?? '9999-12-31') < today,
        expectedAt: toDateString(payment.expectedAt),
        dueAt: toDateString(payment.dueAt),
        paidAt: toIsoString(payment.paidAt),
        paymentMethod: payment.paymentMethod,
        transactionNo: payment.transactionNo,
        note: payment.note,
        sortOrder: payment.sortOrder,
      })),
    releaseEvents: order.releaseEvents.map(event => ({
      id: event.id,
      type: event.type,
      label: RELEASE_EVENT_TYPE_LABELS[event.type as keyof typeof RELEASE_EVENT_TYPE_LABELS] ?? event.type,
      oldDate: toDateString(event.oldDate),
      newDate: toDateString(event.newDate),
      datePrecision: event.datePrecision,
      occurredAt: event.occurredAt.toISOString(),
      source: event.source,
      sourceUrl: event.sourceUrl,
      note: event.note,
    })),
    shipments: order.shipments.map(shipment => ({
      id: shipment.id,
      carrier: shipment.carrier,
      trackingNo: shipment.trackingNo,
      status: shipment.status,
      shippedAt: toIsoString(shipment.shippedAt),
      estimatedDeliveryAt: toIsoString(shipment.estimatedDeliveryAt),
      deliveredAt: toIsoString(shipment.deliveredAt),
      note: shipment.note,
      items: shipment.items.map(item => ({
        orderItemId: item.orderItemId,
        productName: order.items.find(orderItem => orderItem.id === item.orderItemId)?.product.name ?? '',
        quantity: item.quantity,
      })),
    })),
    attachments: order.attachments.map(attachment => ({
      id: attachment.id,
      type: attachment.type,
      fileName: attachment.fileName,
      storagePath: attachment.storagePath,
      mimeType: attachment.mimeType,
      createdAt: attachment.createdAt.toISOString(),
    })),
    orderEvents: order.orderEvents.map(event => ({
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt.toISOString(),
    })),
    timeline: buildTimeline(order),
  }
}
```

- [x] **Step 4: 写 `order.service.ts`**

```ts
import { HttpStatus, Injectable } from '@nestjs/common'
import type { OrderStatus, Paginated } from '@hobilog/shared'
import type { Prisma } from '@prisma/client'
import { BusinessException } from '../../common/exceptions/business.exception'
import { toPaginated } from '../../common/types/paginated'
import { PrismaService } from '../../database/prisma.service'
import { PlatformService } from '../platform/platform.service'
import { ProductService } from '../product/product.service'
import { StoreService } from '../store/store.service'
import { isOrderCompleted } from './domain/shipment'
import type { CancelOrderDto } from './dto/cancel-order.dto'
import type { CreateOrderDto } from './dto/create-order.dto'
import type { OrderTab, QueryOrderDto } from './dto/query-order.dto'
import type { UpdateOrderDto } from './dto/update-order.dto'
import { toOrderDomain, type OrderWithRelations } from './mapper/order-domain.mapper'
import { toOrderDetailVo, toOrderListItemVo } from './mapper/order.mapper'
import type { OrderDetailVo } from './vo/order-detail.vo'
import type { OrderListItemVo } from './vo/order-list.vo'

export const ORDER_INCLUDE = {
  items: { include: { product: true } },
  payments: true,
  releaseEvents: true,
  shipments: { include: { items: true } },
  orderEvents: true,
  attachments: true,
  platform: true,
  store: true,
} satisfies Prisma.OrderInclude

const RELEASED_EVENT_TYPES = ['RELEASED', 'STORE_ARRIVED', 'SHIPMENT_READY'] as const
const SHIPPED_SHIPMENT_STATUSES = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'] as const

export function buildTabWhere(tab: OrderTab, today: string): Prisma.OrderWhereInput {
  const map: Record<OrderTab, Prisma.OrderWhereInput> = {
    ALL: { archived: false },
    ARCHIVED: { archived: true },
    WAITING_PAYMENT: { status: 'ACTIVE', payments: { some: { status: 'PENDING' } } },
    PAYMENT_OVERDUE: {
      status: 'ACTIVE',
      payments: { some: { status: 'PENDING', dueAt: { lt: new Date(`${today}T00:00:00.000Z`) } } },
    },
    WAITING_RELEASE: {
      status: 'ACTIVE',
      payments: { none: { status: 'PENDING' } },
      releaseEvents: { none: { type: { in: [...RELEASED_EVENT_TYPES] } } },
    },
    WAITING_SHIPMENT: {
      status: 'ACTIVE',
      payments: { none: { status: 'PENDING' } },
      releaseEvents: { some: { type: { in: [...RELEASED_EVENT_TYPES] } } },
      shipments: { none: { status: { in: [...SHIPPED_SHIPMENT_STATUSES] } } },
    },
    IN_TRANSIT: { shipments: { some: { status: { in: ['SHIPPED', 'IN_TRANSIT'] } } } },
    SHIPMENT_EXCEPTION: { shipments: { some: { status: 'EXCEPTION' } } },
    COMPLETED: { status: 'COMPLETED' },
    CANCELLED: { status: 'CANCELLED' },
    REFUNDED: { status: 'REFUNDED' },
  }
  return map[tab]
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly platformService: PlatformService,
    private readonly storeService: StoreService,
  ) {}

  today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  async create(userId: string, dto: CreateOrderDto): Promise<OrderDetailVo> {
    const productIds = [...new Set(dto.items.map(item => item.productId))]
    const owned = await this.productService.getOwnedProductIds(userId, productIds)
    if (owned.length !== productIds.length) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'INVALID_PRODUCTS', '商品不存在或不属于当前用户')
    }
    if (dto.platformId) await this.platformService.assertOwned(userId, dto.platformId)
    if (dto.storeId) await this.storeService.assertOwned(userId, dto.storeId)

    const items = dto.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: Number((item.unitPrice * item.quantity).toFixed(2)),
      note: item.note,
    }))

    const goodsAmount = dto.autoCalculateGoodsAmount
      ? Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
      : dto.goodsAmount
    const totalAmount = Number(
      (goodsAmount - dto.discountAmount + dto.shippingAmount + dto.taxAmount + dto.extraAmount).toFixed(2),
    )

    const orderId = await this.prisma.$transaction(async tx => {
      const order = await tx.order.create({
        data: {
          userId,
          platformId: dto.platformId ?? null,
          storeId: dto.storeId ?? null,
          orderNo: dto.orderNo,
          orderUrl: dto.orderUrl,
          orderedAt: new Date(`${dto.orderedAt.slice(0, 10)}T00:00:00.000Z`),
          currency: dto.currency,
          goodsAmount,
          discountAmount: dto.discountAmount,
          shippingAmount: dto.shippingAmount,
          taxAmount: dto.taxAmount,
          extraAmount: dto.extraAmount,
          totalAmount,
          paymentMode: dto.paymentMode,
          note: dto.note,
        },
        select: { id: true },
      })

      await tx.orderItem.createMany({ data: items.map(item => ({ orderId: order.id, ...item })) })

      await tx.payment.createMany({
        data: dto.payments.map((payment, index) => ({
          orderId: order.id,
          type: payment.type,
          name: payment.name,
          amount: payment.amount ?? null,
          currency: dto.currency,
          status: payment.status ?? 'PENDING',
          expectedAt: payment.expectedAt ? new Date(payment.expectedAt) : null,
          dueAt: payment.dueAt ? new Date(payment.dueAt) : null,
          paidAt: payment.paidAt ? new Date(payment.paidAt) : null,
          paymentMethod: payment.paymentMethod,
          transactionNo: payment.transactionNo,
          note: payment.note,
          sortOrder: index,
        })),
      })

      if (dto.expectedRelease) {
        await tx.releaseEvent.create({
          data: {
            orderId: order.id,
            type: 'EXPECTED_RELEASE',
            newDate: new Date(`${dto.expectedRelease.date.slice(0, 10)}T00:00:00.000Z`),
            datePrecision: dto.expectedRelease.precision ?? 'MONTH',
          },
        })
      }

      await tx.orderEvent.create({
        data: { orderId: order.id, type: 'ORDER_CREATED', title: '创建订单' },
      })

      return order.id
    })

    return this.getDetail(userId, orderId)
  }

  async list(userId: string, query: QueryOrderDto): Promise<Paginated<OrderListItemVo>> {
    const where: Prisma.OrderWhereInput = {
      userId,
      ...buildTabWhere(query.tab, this.today()),
      ...(query.status ? { status: query.status } : {}),
      ...(query.platformId ? { platformId: query.platformId } : {}),
      ...(query.storeId ? { storeId: query.storeId } : {}),
      ...(query.year
        ? {
            orderedAt: {
              gte: new Date(`${query.year}-01-01T00:00:00.000Z`),
              lt: new Date(`${query.year + 1}-01-01T00:00:00.000Z`),
            },
          }
        : {}),
      ...(query.priceMin !== undefined || query.priceMax !== undefined
        ? {
            totalAmount: {
              ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
              ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
            },
          }
        : {}),
      ...(query.manufacturer || query.ipName || query.characterName || query.category
        ? {
            items: {
              some: {
                product: {
                  ...(query.manufacturer ? { manufacturer: query.manufacturer } : {}),
                  ...(query.ipName ? { ipName: query.ipName } : {}),
                  ...(query.characterName ? { characterName: query.characterName } : {}),
                  ...(query.category ? { category: query.category } : {}),
                },
              },
            },
          }
        : {}),
      ...(query.delayed ? { releaseEvents: { some: { type: 'DELAY' } } } : {}),
      ...(query.keyword
        ? {
            OR: [
              { orderNo: { contains: query.keyword, mode: 'insensitive' as const } },
              { items: { some: { product: { name: { contains: query.keyword, mode: 'insensitive' as const } } } } },
            ],
          }
        : {}),
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: [{ orderedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ])

    const today = this.today()
    return toPaginated(rows.map(row => toOrderListItemVo(row, today)), total, query.page, query.pageSize)
  }

  async getDetail(userId: string, id: string): Promise<OrderDetailVo> {
    const order = await this.findOwnedWithRelations(userId, id)
    return toOrderDetailVo(order, this.today())
  }

  async update(userId: string, id: string, dto: UpdateOrderDto): Promise<OrderDetailVo> {
    await this.assertOwned(userId, id)
    await this.prisma.order.update({
      where: { id },
      data: {
        platformId: dto.platformId,
        storeId: dto.storeId,
        orderNo: dto.orderNo,
        orderUrl: dto.orderUrl,
        orderedAt: dto.orderedAt ? new Date(`${dto.orderedAt.slice(0, 10)}T00:00:00.000Z`) : undefined,
        currency: dto.currency,
        goodsAmount: dto.goodsAmount,
        discountAmount: dto.discountAmount,
        shippingAmount: dto.shippingAmount,
        taxAmount: dto.taxAmount,
        extraAmount: dto.extraAmount,
        note: dto.note,
        paymentMode: dto.paymentMode,
      },
    })
    return this.getDetail(userId, id)
  }

  async cancel(userId: string, id: string, dto: CancelOrderDto): Promise<OrderDetailVo> {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, select: { status: true } })
    if (!order) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', '订单不存在')
    }
    if (order.status !== 'ACTIVE') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'ORDER_NOT_CANCELLABLE', '只有进行中的订单可以取消')
    }

    await this.prisma.$transaction(async tx => {
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } })
      await tx.payment.updateMany({ where: { orderId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } })

      if (dto.refund) {
        const paid = await tx.payment.findMany({
          where: { orderId: id, status: 'PAID', type: { not: 'REFUND' } },
          select: { amount: true },
        })
        const refundTotal = Number(paid.reduce((sum, item) => sum + Number(item.amount ?? 0), 0).toFixed(2))
        if (refundTotal > 0) {
          await tx.payment.create({
            data: {
              orderId: id,
              type: 'REFUND',
              name: '取消订单退款',
              amount: refundTotal,
              status: 'PAID',
              paidAt: new Date(),
              note: dto.note,
              sortOrder: 999,
            },
          })
        }
      }

      await tx.orderEvent.create({
        data: { orderId: id, type: 'ORDER_CANCELLED', title: '取消订单', description: dto.note ?? null },
      })
    })

    return this.getDetail(userId, id)
  }

  async refreshStatus(userId: string, orderId: string): Promise<OrderStatus> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payments: true, shipments: true, releaseEvents: true },
    })
    if (!order) return 'ACTIVE'
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') return order.status

    const domain = toOrderDomain({ ...order, items: [], orderEvents: [], attachments: [], platform: null, store: null } as OrderWithRelations)
    const next: OrderStatus = isOrderCompleted(domain, this.today()) ? 'COMPLETED' : 'ACTIVE'
    if (next !== order.status) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: next } })
    }
    return next
  }

  async assertOwned(userId: string, orderId: string): Promise<void> {
    const count = await this.prisma.order.count({ where: { id: orderId, userId } })
    if (count === 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', '订单不存在')
    }
  }

  async findOwnedWithRelations(userId: string, orderId: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, include: ORDER_INCLUDE })
    if (!order) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', '订单不存在')
    }
    return order
  }

  toDomain(order: OrderWithRelations): OrderDomain {
    return toOrderDomain(order)
  }
}
```

（`OrderDomain` 从 `./domain/types` 导入；`toDomain` 为 P3 其余模块复用领域函数的唯一入口。）

说明：`refreshStatus` 直接复用 `toOrderDomain`，因此这里用最小字段集构造 `OrderWithRelations`（`items`/`orderEvents`/`attachments` 等不参与判定）。`releaseEvents` 参与 `OrderDomain` 但不参与 `isOrderCompleted` 判定。

- [x] **Step 5: 写 `order.service.spec.ts`**

```ts
import { OrderService, buildTabWhere } from './order.service'

const prismaMock = () => ({
  order: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  orderItem: { createMany: vi.fn() },
  payment: { createMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
  releaseEvent: { create: vi.fn() },
  orderEvent: { create: vi.fn() },
  $transaction: vi.fn(),
})

const buildService = (prisma: ReturnType<typeof prismaMock>, overrides: Record<string, unknown> = {}) =>
  new OrderService(
    prisma as never,
    { getOwnedProductIds: vi.fn().mockResolvedValue([]), ...overrides } as never,
    { assertOwned: vi.fn().mockResolvedValue(undefined) } as never,
    { assertOwned: vi.fn().mockResolvedValue(undefined) } as never,
  )

describe('buildTabWhere', () => {
  it('ALL → 仅排除归档', () => {
    expect(buildTabWhere('ALL', '2027-03-20')).toEqual({ archived: false })
  })
  it('ARCHIVED → archived true', () => {
    expect(buildTabWhere('ARCHIVED', '2027-03-20')).toEqual({ archived: true })
  })
  it('WAITING_PAYMENT → ACTIVE 且存在 PENDING 付款', () => {
    expect(buildTabWhere('WAITING_PAYMENT', '2027-03-20')).toEqual({
      status: 'ACTIVE',
      payments: { some: { status: 'PENDING' } },
    })
  })
  it('PAYMENT_OVERDUE → dueAt 早于今天', () => {
    expect(buildTabWhere('PAYMENT_OVERDUE', '2027-03-20')).toEqual({
      status: 'ACTIVE',
      payments: { some: { status: 'PENDING', dueAt: { lt: new Date('2027-03-20T00:00:00.000Z') } } },
    })
  })
  it('IN_TRANSIT → 存在 SHIPPED / IN_TRANSIT 物流', () => {
    expect(buildTabWhere('IN_TRANSIT', '2027-03-20')).toEqual({
      shipments: { some: { status: { in: ['SHIPPED', 'IN_TRANSIT'] } } },
    })
  })
  it('COMPLETED → status COMPLETED', () => {
    expect(buildTabWhere('COMPLETED', '2027-03-20')).toEqual({ status: 'COMPLETED' })
  })
})

describe('OrderService.create', () => {
  it('商品不属于当前用户 → 400 INVALID_PRODUCTS', async () => {
    const prisma = prismaMock()
    const service = buildService(prisma, { getOwnedProductIds: vi.fn().mockResolvedValue(['p1']) })
    await expect(
      service.create('u1', {
        items: [
          { productId: 'p1', quantity: 1, unitPrice: 100 },
          { productId: 'p2', quantity: 1, unitPrice: 100 },
        ],
        orderedAt: '2026-09-18',
        currency: 'CNY',
        paymentMode: 'FULL',
        autoCalculateGoodsAmount: true,
        goodsAmount: 0,
        discountAmount: 0,
        shippingAmount: 0,
        taxAmount: 0,
        extraAmount: 0,
        payments: [{ type: 'FULL', amount: 200 }],
      }),
    ).rejects.toMatchObject({ status: 400, response: { code: 'INVALID_PRODUCTS' } })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('自动计算商品金额与订单总额，并写入 Payments 与预计出货', async () => {
    const prisma = prismaMock()
    const tx = {
      order: { create: vi.fn().mockResolvedValue({ id: 'o1' }) },
      orderItem: { createMany: vi.fn() },
      payment: { createMany: vi.fn() },
      releaseEvent: { create: vi.fn() },
      orderEvent: { create: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    const service = buildService(prisma, { getOwnedProductIds: vi.fn().mockResolvedValue(['p1']) })
    service.getDetail = vi.fn().mockResolvedValue({ id: 'o1' } as never)

    await service.create('u1', {
      items: [{ productId: 'p1', quantity: 2, unitPrice: 649.5 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'FULL',
      autoCalculateGoodsAmount: true,
      goodsAmount: 0,
      discountAmount: 100,
      shippingAmount: 20,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'FULL', amount: 1199 }],
      expectedRelease: { date: '2027-05-01', precision: 'MONTH' },
    })

    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', goodsAmount: 1299, totalAmount: 1219 }),
      select: { id: true },
    })
    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: [{ orderId: 'o1', productId: 'p1', quantity: 2, unitPrice: 649.5, subtotal: 1299, note: undefined }],
    })
    expect(tx.payment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: 'o1',
          type: 'FULL',
          amount: 1199,
          status: 'PENDING',
          currency: 'CNY',
          sortOrder: 0,
        }),
      ],
    })
    expect(tx.releaseEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: 'o1',
        type: 'EXPECTED_RELEASE',
        newDate: new Date('2027-05-01T00:00:00.000Z'),
        datePrecision: 'MONTH',
      },
    })
  })

  it('关闭自动计算时使用传入的商品金额', async () => {
    const prisma = prismaMock()
    const tx = {
      order: { create: vi.fn().mockResolvedValue({ id: 'o2' }) },
      orderItem: { createMany: vi.fn() },
      payment: { createMany: vi.fn() },
      releaseEvent: { create: vi.fn() },
      orderEvent: { create: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    const service = buildService(prisma, { getOwnedProductIds: vi.fn().mockResolvedValue(['p1']) })
    service.getDetail = vi.fn().mockResolvedValue({ id: 'o2' } as never)

    await service.create('u1', {
      items: [{ productId: 'p1', quantity: 1, unitPrice: 100 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'CUSTOM',
      autoCalculateGoodsAmount: false,
      goodsAmount: 500,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'OTHER', amount: 500 }],
    })

    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ goodsAmount: 500, totalAmount: 500 }),
      select: { id: true },
    })
  })
})

describe('OrderService.list', () => {
  it('始终带 userId 并返回分页形状', async () => {
    const prisma = prismaMock()
    prisma.$transaction.mockImplementation(async (arg: never) => Promise.all(arg as Promise<unknown>[]))
    const service = buildService(prisma)
    const result = await service.list('u1', { page: 2, pageSize: 10, tab: 'ALL' } as never)
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', archived: false }) }),
    )
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 })
  })
})

describe('OrderService.cancel', () => {
  const orderRow = { status: 'ACTIVE' }

  it('非 ACTIVE 订单 → 400 ORDER_NOT_CANCELLABLE', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue({ status: 'COMPLETED' })
    const service = buildService(prisma)
    await expect(service.cancel('u1', 'o1', { refund: false })).rejects.toMatchObject({ response: { code: 'ORDER_NOT_CANCELLABLE' } })
  })

  it('取消时把 PENDING 付款改为 CANCELLED 并写事件', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue(orderRow)
    const tx = {
      order: { update: vi.fn() },
      payment: { updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([{ amount: 300 }]), create: vi.fn() },
      orderEvent: { create: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    const service = buildService(prisma)
    service.getDetail = vi.fn().mockResolvedValue({ id: 'o1' } as never)

    await service.cancel('u1', 'o1', { refund: true, note: '店家取消' })

    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'CANCELLED' } })
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    })
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'REFUND', amount: 300, status: 'PAID' }),
    })
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: { orderId: 'o1', type: 'ORDER_CANCELLED', title: '取消订单', description: '店家取消' },
    })
  })

  it('refund = false 时不创建退款记录', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue(orderRow)
    const tx = {
      order: { update: vi.fn() },
      payment: { updateMany: vi.fn(), findMany: vi.fn(), create: vi.fn() },
      orderEvent: { create: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    const service = buildService(prisma)
    service.getDetail = vi.fn().mockResolvedValue({ id: 'o1' } as never)

    await service.cancel('u1', 'o1', { refund: false })

    expect(tx.payment.findMany).not.toHaveBeenCalled()
    expect(tx.payment.create).not.toHaveBeenCalled()
  })
})

describe('OrderService.refreshStatus', () => {
  it('全部签收且无待付款 → COMPLETED', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue({
      id: 'o1',
      status: 'ACTIVE',
      archived: false,
      currency: 'CNY',
      totalAmount: 1299,
      payments: [
        {
          id: 'p1', type: 'FULL', name: null, amount: 1299, status: 'PAID',
          expectedAt: null, dueAt: null, paidAt: new Date('2026-09-18'), sortOrder: 0,
        },
      ],
      shipments: [
        {
          id: 's1', status: 'DELIVERED', carrier: null, trackingNo: null,
          shippedAt: new Date('2027-05-18'), estimatedDeliveryAt: null, deliveredAt: new Date('2027-05-21'),
        },
      ],
      releaseEvents: [],
    })
    const service = buildService(prisma)
    await expect(service.refreshStatus('u1', 'o1')).resolves.toBe('COMPLETED')
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'COMPLETED' } })
  })

  it('已取消订单不回头改状态', async () => {
    const prisma = prismaMock()
    prisma.order.findFirst.mockResolvedValue({
      id: 'o1', status: 'CANCELLED', archived: false, currency: 'CNY', totalAmount: 0,
      payments: [], shipments: [], releaseEvents: [],
    })
    const service = buildService(prisma)
    await expect(service.refreshStatus('u1', 'o1')).resolves.toBe('CANCELLED')
    expect(prisma.order.update).not.toHaveBeenCalled()
  })
})
```

- [x] **Step 6: 写 controller / module 并运行测试**

（实测：order.service.spec 15 tests + query-order.dto.spec 5 tests，全套 20 files / 180 tests 全绿；typecheck、`nest build`、e2e 10 passed 均无回归）**

`order.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Paginated } from '@hobilog/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import { CancelOrderDto } from './dto/cancel-order.dto'
import { CreateOrderDto } from './dto/create-order.dto'
import { QueryOrderDto } from './dto/query-order.dto'
import { UpdateOrderDto } from './dto/update-order.dto'
import { OrderService } from './order.service'
import type { OrderDetailVo } from './vo/order-detail.vo'
import type { OrderListItemVo } from './vo/order-list.vo'

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryOrderDto): Promise<Paginated<OrderListItemVo>> {
    return this.orderService.list(user.id, query)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto): Promise<OrderDetailVo> {
    return this.orderService.create(user.id, dto)
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderDetailVo> {
    return this.orderService.getDetail(user.id, id)
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderDto): Promise<OrderDetailVo> {
    return this.orderService.update(user.id, id, dto)
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelOrderDto): Promise<OrderDetailVo> {
    return this.orderService.cancel(user.id, id, dto)
  }
}
```

`order.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { PlatformModule } from '../platform/platform.module'
import { ProductModule } from '../product/product.module'
import { StoreModule } from '../store/store.module'
import { OrderController } from './order.controller'
import { OrderService } from './order.service'

@Module({
  imports: [ProductModule, PlatformModule, StoreModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
```

`app.module.ts` imports 追加 `OrderModule`。同时给 `PlatformModule` / `StoreModule` 补 `exports: [PlatformService]` / `exports: [StoreService]`。

Run:

```bash
pnpm --filter @hobilog/server test
pnpm --filter @hobilog/server typecheck
pnpm --filter @hobilog/server test:e2e
```

Expected: 全绿；若 `test:e2e` 因 `OrderModule` 依赖真实 Prisma Delegate 报错，按 P2 Task 2 的方式在 e2e 中 `overrideProvider(PrismaService)`。

- [ ] **Step 7: 提交（需用户授权）**

```bash
git add apps/server/src/modules/order apps/server/src/modules/platform/platform.module.ts apps/server/src/modules/store/store.module.ts apps/server/src/app.module.ts
git commit -m "feat(order): add order create, list tabs, detail aggregation and cancel"
```

---

### Task 5: Payment 模块（标记付款 / 补差价 / 退款）

**Files:**
- Create: `apps/server/src/modules/payment/dto/create-payment.dto.ts`
- Create: `apps/server/src/modules/payment/dto/update-payment.dto.ts`
- Create: `apps/server/src/modules/payment/dto/mark-paid.dto.ts`
- Create: `apps/server/src/modules/payment/dto/refund-payment.dto.ts`
- Create: `apps/server/src/modules/payment/payment.service.ts`
- Create: `apps/server/src/modules/payment/payment.service.spec.ts`
- Create: `apps/server/src/modules/payment/payment.controller.ts`
- Create: `apps/server/src/modules/payment/payment.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `OrderService.{assertOwned,refreshStatus,getDetail}`
- Produces:
  - API：`POST /api/orders/:orderId/payments`、`PATCH /api/payments/:id`、`POST /api/payments/:id/paid`、`POST /api/payments/:id/refund`
  - `PaymentService.{create,update,markPaid,refund}`
- 规则（`docs/03 §30`、`docs/07 §41-44`）：实付 = 计划 → 按原金额入账；实付 > 计划 → 原金额不变 + 新建 `SUPPLEMENT` 已付节点；实付 < 计划 → 按实付修正并在 note 记录原计划。

- [x] **Step 1: 写 DTO**

`dto/create-payment.dto.ts`：与 `CreateOrderDto` 内的 `CreatePaymentDto` 字段一致，追加 `@IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number`。

`dto/update-payment.dto.ts`：

```ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsISO8601, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { PAYMENT_STATUSES, PAYMENT_TYPES } from '@hobilog/shared'

export class UpdatePaymentDto {
  @ApiPropertyOptional({ enum: PAYMENT_TYPES }) @IsOptional() @IsIn(PAYMENT_TYPES) type?: string
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string
  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount?: number | null
  @ApiPropertyOptional({ enum: PAYMENT_STATUSES }) @IsOptional() @IsIn(PAYMENT_STATUSES) status?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() paidAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() paymentMethod?: string
  @ApiPropertyOptional() @IsOptional() @IsString() transactionNo?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number
}
```

`dto/mark-paid.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class MarkPaidDto {
  @ApiProperty({ description: '实际付款金额' })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) paidAmount!: number

  @ApiPropertyOptional({ description: '付款时间，默认服务器当前时间' })
  @IsOptional() @IsISO8601() paidAt?: string

  @ApiPropertyOptional() @IsOptional() @IsString() paymentMethod?: string
  @ApiPropertyOptional() @IsOptional() @IsString() transactionNo?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string

  @ApiPropertyOptional({ default: true, description: '实付高于计划金额时是否自动创建补差价节点' })
  @IsOptional() @IsBoolean() createSupplement: boolean = true
}
```

`dto/refund-payment.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class RefundPaymentDto {
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number
  @ApiPropertyOptional() @IsOptional() @IsISO8601() paidAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() paymentMethod?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() markOriginal: boolean = true
}
```

- [x] **Step 2: 写 `payment.service.ts`**

```ts
import { HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { PrismaService } from '../../database/prisma.service'
import { OrderService } from '../order/order.service'
import type { OrderDetailVo } from '../order/vo/order-detail.vo'
import type { CreatePaymentDto } from './dto/create-payment.dto'
import type { MarkPaidDto } from './dto/mark-paid.dto'
import type { RefundPaymentDto } from './dto/refund-payment.dto'
import type { UpdatePaymentDto } from './dto/update-payment.dto'

const REFUND_TYPE = 'REFUND'
const SUPPLEMENT_SORT_ORDER = 900
const REFUND_SORT_ORDER = 950

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, orderId: string, dto: CreatePaymentDto): Promise<OrderDetailVo> {
    await this.orderService.assertOwned(userId, orderId)
    const maxSort = await this.prisma.payment.aggregate({
      where: { orderId },
      _max: { sortOrder: true },
    })
    await this.prisma.payment.create({
      data: {
        orderId,
        type: dto.type,
        name: dto.name,
        amount: dto.amount ?? null,
        status: dto.status ?? 'PENDING',
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
        paymentMethod: dto.paymentMethod,
        transactionNo: dto.transactionNo,
        note: dto.note,
        sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
    return this.orderService.getDetail(userId, orderId)
  }

  async update(userId: string, id: string, dto: UpdatePaymentDto): Promise<OrderDetailVo> {
    const payment = await this.findOwnedPayment(userId, id)
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : undefined
    const status =
      dto.status ?? (paidAt && payment.status === 'PENDING' ? 'PAID' : undefined)

    await this.prisma.payment.update({
      where: { id },
      data: {
        type: dto.type,
        name: dto.name,
        amount: dto.amount,
        status,
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        paidAt,
        paymentMethod: dto.paymentMethod,
        transactionNo: dto.transactionNo,
        note: dto.note,
        sortOrder: dto.sortOrder,
      },
    })

    await this.orderService.refreshStatus(userId, payment.orderId)
    return this.orderService.getDetail(userId, payment.orderId)
  }

  async markPaid(userId: string, id: string, dto: MarkPaidDto): Promise<OrderDetailVo> {
    const payment = await this.findOwnedPayment(userId, id)
    if (payment.status !== 'PENDING' && payment.status !== 'OVERDUE') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'PAYMENT_NOT_PAYABLE', '当前付款节点不可标记付款')
    }

    const planned = payment.amount === null ? null : Number(payment.amount)
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date()
    const overflow = planned === null ? 0 : Number((dto.paidAmount - planned).toFixed(2))

    await this.prisma.$transaction(async tx => {
      const nextAmount = overflow > 0 ? planned : dto.paidAmount
      const note =
        overflow < 0 && planned !== null
          ? [dto.note, `原计划 ¥${planned}`].filter(Boolean).join('; ')
          : dto.note

      await tx.payment.update({
        where: { id },
        data: {
          status: 'PAID',
          amount: nextAmount,
          paidAt,
          paymentMethod: dto.paymentMethod,
          transactionNo: dto.transactionNo,
          note,
        },
      })

      if (overflow > 0 && dto.createSupplement) {
        await tx.payment.create({
          data: {
            orderId: payment.orderId,
            type: 'SUPPLEMENT',
            name: '补差价',
            amount: overflow,
            currency: payment.currency,
            status: 'PAID',
            paidAt,
            paymentMethod: dto.paymentMethod,
            note: dto.note,
            sortOrder: SUPPLEMENT_SORT_ORDER,
          },
        })
      }
    })

    await this.orderService.refreshStatus(userId, payment.orderId)
    return this.orderService.getDetail(userId, payment.orderId)
  }

  async refund(userId: string, id: string, dto: RefundPaymentDto): Promise<OrderDetailVo> {
    const payment = await this.findOwnedPayment(userId, id)
    if (payment.status !== 'PAID' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'PAYMENT_NOT_REFUNDABLE', '只有已付款节点可以退款')
    }

    const paid = payment.amount === null ? 0 : Number(payment.amount)
    const previousRefunds = await this.prisma.payment.findMany({
      where: { orderId: payment.orderId, type: REFUND_TYPE, status: 'PAID' },
      select: { amount: true },
    })
    const alreadyRefunded = previousRefunds.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)

    await this.prisma.$transaction(async tx => {
      await tx.payment.create({
        data: {
          orderId: payment.orderId,
          type: REFUND_TYPE,
          name: payment.name ? `${payment.name}退款` : '退款',
          amount: dto.amount,
          currency: payment.currency,
          status: 'PAID',
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          paymentMethod: dto.paymentMethod,
          note: dto.note,
          sortOrder: REFUND_SORT_ORDER,
        },
      })

      if (dto.markOriginal && payment.type !== REFUND_TYPE) {
        await tx.payment.update({
          where: { id },
          data: { status: alreadyRefunded + dto.amount >= paid ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        })
      }
    })

    await this.orderService.refreshStatus(userId, payment.orderId)
    return this.orderService.getDetail(userId, payment.orderId)
  }

  private async findOwnedPayment(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, order: { userId } } })
    if (!payment) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'PAYMENT_NOT_FOUND', '付款节点不存在')
    }
    return payment
  }
}
```

- [x] **Step 3: 写 `payment.service.spec.ts`**

```ts
import { PaymentService } from './payment.service'

const prismaMock = () => ({
  payment: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 1 } }),
  },
  $transaction: vi.fn(),
})

const buildService = (prisma: ReturnType<typeof prismaMock>) =>
  new PaymentService(prisma as never, {
    assertOwned: vi.fn().mockResolvedValue(undefined),
    refreshStatus: vi.fn().mockResolvedValue('ACTIVE'),
    getDetail: vi.fn().mockResolvedValue({ id: 'o1' }),
  } as never)

const withTx = (prisma: ReturnType<typeof prismaMock>, tx: Record<string, unknown>) => {
  prisma.$transaction.mockImplementation(async (arg: never) =>
    (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
  )
  return tx
}

describe('PaymentService.markPaid', () => {
  it('已付款节点 → 400 PAYMENT_NOT_PAYABLE', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PAID', type: 'BALANCE', amount: 999 })
    await expect(buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 999, createSupplement: true })).rejects.toMatchObject({
      status: 400,
      response: { code: 'PAYMENT_NOT_PAYABLE' },
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('实付等于计划 → 按原金额入账且不建补差价', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999 })
    const tx = withTx(prisma, { payment: { update: vi.fn(), create: vi.fn() } })
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 999, createSupplement: true })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID', amount: 999 }),
    })
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it('实付高于计划 → 原金额不变 + 新建 SUPPLEMENT', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999, currency: 'CNY' })
    const tx = withTx(prisma, { payment: { update: vi.fn(), create: vi.fn() } })
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 1029, createSupplement: true })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID', amount: 999 }),
    })
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'o1', type: 'SUPPLEMENT', amount: 30, status: 'PAID' }),
    })
  })

  it('createSupplement = false 时不建补差价', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999, currency: 'CNY' })
    const tx = withTx(prisma, { payment: { update: vi.fn(), create: vi.fn() } })
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 1029, createSupplement: false })
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it('实付低于计划 → 按实付修正并记录原计划', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999 })
    const tx = withTx(prisma, { payment: { update: vi.fn(), create: vi.fn() } })
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 900, note: '店家优惠', createSupplement: true })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID', amount: 900, note: '店家优惠; 原计划 ¥999' }),
    })
  })

  it('金额待定（amount = null）→ 按实付入账', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'SHIPPING', amount: null })
    const tx = withTx(prisma, { payment: { update: vi.fn(), create: vi.fn() } })
    await buildService(prisma).markPaid('u1', 'pay1', { paidAmount: 20, createSupplement: true })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: expect.objectContaining({ status: 'PAID', amount: 20 }),
    })
    expect(tx.payment.create).not.toHaveBeenCalled()
  })
})

describe('PaymentService.refund', () => {
  it('未付款节点 → 400 PAYMENT_NOT_REFUNDABLE', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PENDING', type: 'BALANCE', amount: 999 })
    await expect(buildService(prisma).refund('u1', 'pay1', { amount: 300, markOriginal: true })).rejects.toMatchObject({
      response: { code: 'PAYMENT_NOT_REFUNDABLE' },
    })
  })

  it('全额退款 → 原节点 REFUNDED，退款金额为正数', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PAID', type: 'DEPOSIT', amount: 300, currency: 'CNY', name: '定金' })
    const tx = withTx(prisma, { payment: { create: vi.fn(), update: vi.fn() } })
    await buildService(prisma).refund('u1', 'pay1', { amount: 300, markOriginal: true })
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'o1', type: 'REFUND', amount: 300, status: 'PAID' }),
    })
    expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 'pay1' }, data: { status: 'REFUNDED' } })
  })

  it('部分退款 → 原节点 PARTIALLY_REFUNDED', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PAID', type: 'DEPOSIT', amount: 300, currency: 'CNY', name: '定金' })
    const tx = withTx(prisma, { payment: { create: vi.fn(), update: vi.fn() } })
    await buildService(prisma).refund('u1', 'pay1', { amount: 100, markOriginal: true })
    expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 'pay1' }, data: { status: 'PARTIALLY_REFUNDED' } })
  })

  it('已有历史退款时累计判断', async () => {
    const prisma = prismaMock()
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', orderId: 'o1', status: 'PARTIALLY_REFUNDED', type: 'DEPOSIT', amount: 300, currency: 'CNY', name: '定金' })
    prisma.payment.findMany.mockResolvedValue([{ amount: 100 }])
    const tx = withTx(prisma, { payment: { create: vi.fn(), update: vi.fn() } })
    await buildService(prisma).refund('u1', 'pay1', { amount: 200, markOriginal: true })
    expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 'pay1' }, data: { status: 'REFUNDED' } })
  })
})
```

- [x] **Step 4: 写 controller / module 并运行测试**

```ts
@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('orders/:orderId/payments')
  create(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.create(user.id, orderId, dto)
  }

  @Patch('payments/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentService.update(user.id, id, dto)
  }

  @Post('payments/:id/paid')
  markPaid(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.paymentService.markPaid(user.id, id, dto)
  }

  @Post('payments/:id/refund')
  refund(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RefundPaymentDto) {
    return this.paymentService.refund(user.id, id, dto)
  }
}
```

`payment.module.ts`：`imports: [OrderModule]`、`exports: [PaymentService]`；`app.module.ts` 追加 `PaymentModule`。

Run: `pnpm --filter @hobilog/server test && pnpm --filter @hobilog/server typecheck`

- [ ] **Step 5: 提交（需用户授权）**

```bash
git add apps/server/src/modules/payment apps/server/src/app.module.ts
git commit -m "feat(payment): add payment node creation, mark paid with supplement and refund"
```

---

### Task 6: Release 模块（延期 / 厂商出货 / 店铺到货 / 补款开始）

**Files:**
- Create: `apps/server/src/modules/release/dto/delay-release.dto.ts`
- Create: `apps/server/src/modules/release/dto/release-event.dto.ts`
- Create: `apps/server/src/modules/release/dto/balance-open.dto.ts`
- Create: `apps/server/src/modules/release/release.service.ts`
- Create: `apps/server/src/modules/release/release.service.spec.ts`
- Create: `apps/server/src/modules/release/release.controller.ts`
- Create: `apps/server/src/modules/release/release.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `OrderService.{assertOwned,getDomain,getDetail}`、领域层 `getPlannedReleaseDate` / `isReleased`
- Produces：`POST /api/orders/:orderId/release/{delay,released,store-arrived,balance-open}`；`ReleaseService.{delay,markReleased,markStoreArrived,openBalance}`

- [x] **Step 1: 写 DTO**

```ts
// dto/delay-release.dto.ts
export class DelayReleaseDto {
  @ApiProperty({ example: '2027-05-01' }) @IsISO8601() newDate!: string
  @ApiPropertyOptional({ enum: ['DAY', 'MONTH'] }) @IsOptional() @IsIn(['DAY', 'MONTH']) precision?: 'DAY' | 'MONTH'
  @ApiPropertyOptional({ description: '不传则自动取当前计划出货日' }) @IsOptional() @IsISO8601() oldDate?: string
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string
  @ApiPropertyOptional() @IsOptional() @IsString() sourceUrl?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}

// dto/release-event.dto.ts
export class ReleaseEventDto {
  @ApiPropertyOptional({ description: '实际发生日期，默认今天' }) @IsOptional() @IsISO8601() date?: string
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string
  @ApiPropertyOptional() @IsOptional() @IsString() sourceUrl?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}

// dto/balance-open.dto.ts
export class BalanceOpenDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentId?: string
  @ApiPropertyOptional({ enum: ['BALANCE', 'INSTALLMENT', 'OTHER'], description: '未传 paymentId 时按类型定位待付款节点' })
  @IsOptional() @IsIn(['BALANCE', 'INSTALLMENT', 'OTHER']) paymentType?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
```

- [x] **Step 2: 写 `release.service.ts`**

```ts
const DELAYABLE_RELEASED_EVENT_TYPES = ['RELEASED', 'STORE_ARRIVED', 'SHIPMENT_READY']

@Injectable()
export class ReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async delay(userId: string, orderId: string, dto: DelayReleaseDto): Promise<OrderDetailVo> {
    const order = await this.orderService.findOwnedWithRelations(userId, orderId)
    const domain = this.orderService.toDomain(order)

    if (order.status !== 'ACTIVE') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'RELEASE_NOT_DELAYABLE', '只有进行中的订单可以修改出货时间')
    }
    if (order.releaseEvents.some(event => DELAYABLE_RELEASED_EVENT_TYPES.includes(event.type))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'RELEASE_NOT_DELAYABLE', '已厂商出货的订单不能再延期')
    }

    const planned = getPlannedReleaseDate(domain.releaseEvents)
    const oldDate = dto.oldDate ?? planned?.date ?? null

    await this.prisma.$transaction(async tx => {
      await tx.releaseEvent.create({
        data: {
          orderId,
          type: 'DELAY',
          oldDate: oldDate ? new Date(`${oldDate.slice(0, 10)}T00:00:00.000Z`) : null,
          newDate: new Date(`${dto.newDate.slice(0, 10)}T00:00:00.000Z`),
          datePrecision: dto.precision ?? planned?.precision ?? 'MONTH',
          source: dto.source,
          sourceUrl: dto.sourceUrl,
          note: dto.note,
        },
      })
    })

    return this.orderService.getDetail(userId, orderId)
  }

  async markReleased(userId: string, orderId: string, dto: ReleaseEventDto): Promise<OrderDetailVo> {
    return this.createEvent(userId, orderId, 'RELEASED', dto)
  }

  async markStoreArrived(userId: string, orderId: string, dto: ReleaseEventDto): Promise<OrderDetailVo> {
    return this.createEvent(userId, orderId, 'STORE_ARRIVED', dto)
  }

  async openBalance(userId: string, orderId: string, dto: BalanceOpenDto): Promise<OrderDetailVo> {
    const order = await this.orderService.findOwnedWithRelations(userId, orderId)

    const target = dto.paymentId
      ? order.payments.find(payment => payment.id === dto.paymentId)
      : order.payments.find(
          payment =>
            payment.status === 'PENDING' &&
            (dto.paymentType ? payment.type === dto.paymentType : payment.type === 'BALANCE'),
        )

    if (!target) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'BALANCE_NOT_FOUND', '没有可更新的待付款节点')
    }

    await this.prisma.$transaction(async tx => {
      await tx.releaseEvent.create({
        data: {
          orderId,
          type: 'BALANCE_OPEN',
          newDate: dto.dueAt ? new Date(`${dto.dueAt.slice(0, 10)}T00:00:00.000Z`) : null,
          datePrecision: 'DAY',
          note: dto.note,
        },
      })

      await tx.payment.update({
        where: { id: target.id },
        data: {
          expectedAt: dto.expectedAt ? new Date(`${dto.expectedAt.slice(0, 10)}T00:00:00.000Z`) : undefined,
          dueAt: dto.dueAt ? new Date(`${dto.dueAt.slice(0, 10)}T00:00:00.000Z`) : undefined,
        },
      })
    })

    return this.orderService.getDetail(userId, orderId)
  }

  private async createEvent(
    userId: string,
    orderId: string,
    type: 'RELEASED' | 'STORE_ARRIVED',
    dto: ReleaseEventDto,
  ): Promise<OrderDetailVo> {
    const order = await this.orderService.findOwnedWithRelations(userId, orderId)
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'ORDER_NOT_ACTIVE', '订单已结束，无法记录出货事件')
    }

    const occurredAt = dto.date ? new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`) : new Date()

    await this.prisma.releaseEvent.create({
      data: {
        orderId,
        type,
        newDate: occurredAt,
        datePrecision: 'DAY',
        occurredAt,
        source: dto.source,
        sourceUrl: dto.sourceUrl,
        note: dto.note,
      },
    })

    return this.orderService.getDetail(userId, orderId)
  }
}
```

- [x] **Step 3: 写 `release.service.spec.ts`**

```ts
import { ReleaseService } from './release.service'

const releaseEventsOf = (events: Array<{ type: string; newDate: string | null }>) =>
  events.map((event, index) => ({
    id: `r${index}`,
    type: event.type,
    newDate: event.newDate,
    oldDate: null as string | null,
    datePrecision: 'MONTH' as string | null,
    occurredAt: '2026-09-18T00:00:00.000Z',
  }))

const orderRow = (patch: Record<string, unknown> = {}) => {
  const releaseEvents = (patch.releaseEvents as ReturnType<typeof releaseEventsOf> | undefined) ??
    releaseEventsOf([{ type: 'EXPECTED_RELEASE', newDate: '2027-01-01' }])
  return {
    id: 'o1',
    status: 'ACTIVE',
    payments: [] as Array<{ id: string; type: string; status: string; amount: number | null }>,
    releaseEvents,
    ...patch,
  }
}

const prismaMock = () => ({
  releaseEvent: { create: vi.fn() },
  payment: { update: vi.fn() },
  $transaction: vi.fn(),
})

const buildService = (prisma: ReturnType<typeof prismaMock>, order: ReturnType<typeof orderRow>) =>
  new ReleaseService(prisma as never, {
    assertOwned: vi.fn().mockResolvedValue(undefined),
    findOwnedWithRelations: vi.fn().mockResolvedValue(order),
    toDomain: vi.fn().mockReturnValue({
      id: order.id,
      status: order.status,
      archived: false,
      currency: 'CNY',
      totalAmount: 0,
      payments: [],
      releaseEvents: order.releaseEvents,
      shipments: [],
    }),
    getDetail: vi.fn().mockResolvedValue({ id: 'o1' }),
  } as never)

const withTx = (prisma: ReturnType<typeof prismaMock>, tx: Record<string, unknown>) => {
  prisma.$transaction.mockImplementation(async (arg: never) =>
    (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
  )
  return tx
}

describe('ReleaseService.delay', () => {
  it('oldDate 缺省时自动取当前计划出货日', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, { releaseEvent: { create: vi.fn() } })
    await buildService(prisma, orderRow()).delay('u1', 'o1', { newDate: '2027-05-01' })
    expect(tx.releaseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'DELAY',
        oldDate: new Date('2027-01-01T00:00:00.000Z'),
        newDate: new Date('2027-05-01T00:00:00.000Z'),
        datePrecision: 'MONTH',
      }),
    })
  })

  it('显式传入 oldDate 时以传入值为准', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, { releaseEvent: { create: vi.fn() } })
    await buildService(prisma, orderRow()).delay('u1', 'o1', { newDate: '2027-05-01', oldDate: '2027-02-01' })
    expect(tx.releaseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ oldDate: new Date('2027-02-01T00:00:00.000Z') }),
    })
  })

  it('已厂商出货 → 400 RELEASE_NOT_DELAYABLE', async () => {
    const prisma = prismaMock()
    const order = orderRow({ releaseEvents: releaseEventsOf([{ type: 'RELEASED', newDate: '2027-05-16' }]) })
    await expect(buildService(prisma, order).delay('u1', 'o1', { newDate: '2027-07-01' })).rejects.toMatchObject({
      response: { code: 'RELEASE_NOT_DELAYABLE' },
    })
  })

  it('已取消订单 → 400 RELEASE_NOT_DELAYABLE', async () => {
    const prisma = prismaMock()
    const order = orderRow({ status: 'CANCELLED' })
    await expect(buildService(prisma, order).delay('u1', 'o1', { newDate: '2027-07-01' })).rejects.toMatchObject({
      response: { code: 'RELEASE_NOT_DELAYABLE' },
    })
  })

  it('延期只新增事件，不修改原计划事件', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, { releaseEvent: { create: vi.fn() } })
    const order = orderRow()
    await buildService(prisma, order).delay('u1', 'o1', { newDate: '2027-05-01' })
    expect(order.releaseEvents).toHaveLength(1)
    expect(tx.releaseEvent.create).toHaveBeenCalledTimes(1)
  })
})

describe('ReleaseService.markReleased / markStoreArrived', () => {
  it.each([
    ['markReleased', 'RELEASED'],
    ['markStoreArrived', 'STORE_ARRIVED'],
  ] as const)('%s 写入 %s 事件', async (method, type) => {
    const prisma = prismaMock()
    await buildService(prisma, orderRow())[method]('u1', 'o1', { date: '2027-05-16' })
    expect(prisma.releaseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type, datePrecision: 'DAY' }),
    })
  })

  it('已退款订单 → 400 ORDER_NOT_ACTIVE', async () => {
    const prisma = prismaMock()
    const order = orderRow({ status: 'REFUNDED' })
    await expect(buildService(prisma, order).markReleased('u1', 'o1', {})).rejects.toMatchObject({
      response: { code: 'ORDER_NOT_ACTIVE' },
    })
  })
})

describe('ReleaseService.openBalance', () => {
  it('定位 BALANCE 待付款节点并回写 dueAt', async () => {
    const prisma = prismaMock()
    const tx = withTx(prisma, { releaseEvent: { create: vi.fn() }, payment: { update: vi.fn() } })
    const order = orderRow({
      payments: [{ id: 'p-balance', type: 'BALANCE', status: 'PENDING', amount: 999 }],
    })
    await buildService(prisma, order).openBalance('u1', 'o1', { dueAt: '2027-03-20' })
    expect(tx.releaseEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'BALANCE_OPEN' }) })
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'p-balance' },
      data: { expectedAt: undefined, dueAt: new Date('2027-03-20T00:00:00.000Z') },
    })
  })

  it('没有待付款节点 → 400 BALANCE_NOT_FOUND', async () => {
    const prisma = prismaMock()
    await expect(
      buildService(prisma, orderRow()).openBalance('u1', 'o1', { dueAt: '2027-03-20' }),
    ).rejects.toMatchObject({ response: { code: 'BALANCE_NOT_FOUND' } })
  })
})
```

- [x] **Step 4: 写 controller / module 并运行测试**

```ts
@ApiTags('release')
@ApiBearerAuth()
@Controller('orders/:orderId/release')
export class ReleaseController {
  constructor(private readonly releaseService: ReleaseService) {}

  @Post('delay')
  delay(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() dto: DelayReleaseDto) {
    return this.releaseService.delay(user.id, orderId, dto)
  }

  @Post('released')
  released(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() dto: ReleaseEventDto) {
    return this.releaseService.markReleased(user.id, orderId, dto)
  }

  @Post('store-arrived')
  storeArrived(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() dto: ReleaseEventDto) {
    return this.releaseService.markStoreArrived(user.id, orderId, dto)
  }

  @Post('balance-open')
  balanceOpen(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() dto: BalanceOpenDto) {
    return this.releaseService.openBalance(user.id, orderId, dto)
  }
}
```

`release.module.ts`：`imports: [OrderModule]`；`app.module.ts` 追加 `ReleaseModule`。

Run: `pnpm --filter @hobilog/server test && pnpm --filter @hobilog/server typecheck`

- [ ] **Step 5: 提交（需用户授权）**

```bash
git add apps/server/src/modules/release apps/server/src/app.module.ts
git commit -m "feat(release): add delay, released, store-arrived and balance-open events"
```

---

### Task 7: Shipment 模块（拆单 / 状态更新 / 签收）

**Files:**
- Create: `apps/server/src/modules/shipment/dto/create-shipment.dto.ts`
- Create: `apps/server/src/modules/shipment/dto/update-shipment.dto.ts`
- Create: `apps/server/src/modules/shipment/dto/deliver-shipment.dto.ts`
- Create: `apps/server/src/modules/shipment/shipment.service.ts`
- Create: `apps/server/src/modules/shipment/shipment.service.spec.ts`
- Create: `apps/server/src/modules/shipment/shipment.controller.ts`
- Create: `apps/server/src/modules/shipment/shipment.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `OrderService.{assertOwned,findOwnedWithRelations,refreshStatus,getDetail}`
- Produces：`POST /api/orders/:orderId/shipments`、`PATCH /api/shipments/:id`、`POST /api/shipments/:id/delivered`；`ShipmentService.{create,update,markDelivered}`
- 规则（`docs/07 §49-53`）：`ShipmentItem` 必须来自当前订单；同一 `OrderItem` 跨 `Shipment` 的 `quantity` 合计不得超过 `OrderItem.quantity`；有单号/发货时间 → `SHIPPED`，否则 `WAITING`；签收仅允许 `SHIPPED / IN_TRANSIT`。

- [x] **Step 1: 写 DTO**

```ts
// dto/create-shipment.dto.ts
export class CreateShipmentItemDto {
  @ApiProperty() @IsUUID() orderItemId!: string
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity: number = 1
}

export class CreateShipmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() carrier?: string
  @ApiPropertyOptional() @IsOptional() @IsString() trackingNo?: string
  @ApiPropertyOptional({ enum: ['WAITING', 'SHIPPED'] }) @IsOptional() @IsIn(['WAITING', 'SHIPPED']) status?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() shippedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() estimatedDeliveryAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string

  @ApiProperty({ type: [CreateShipmentItemDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateShipmentItemDto)
  items!: CreateShipmentItemDto[]
}

// dto/update-shipment.dto.ts
export class UpdateShipmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() carrier?: string
  @ApiPropertyOptional() @IsOptional() @IsString() trackingNo?: string
  @ApiPropertyOptional({ enum: SHIPMENT_STATUSES }) @IsOptional() @IsIn(SHIPMENT_STATUSES) status?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() shippedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() estimatedDeliveryAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}

// dto/deliver-shipment.dto.ts
export class DeliverShipmentDto {
  @ApiPropertyOptional({ description: '签收时间，默认当前时间' }) @IsOptional() @IsISO8601() deliveredAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
```

- [x] **Step 2: 写 `shipment.service.ts`**

```ts
@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, orderId: string, dto: CreateShipmentDto): Promise<OrderDetailVo> {
    const order = await this.orderService.findOwnedWithRelations(userId, orderId)
    if (order.status !== 'ACTIVE') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'ORDER_NOT_ACTIVE', '订单已结束，无法添加物流')
    }

    const orderItemIds = new Set(order.items.map(item => item.id))
    for (const item of dto.items) {
      if (!orderItemIds.has(item.orderItemId)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, 'INVALID_SHIPMENT_ITEMS', '物流明细包含不属于该订单的商品')
      }
    }

    const shippedBefore = await this.prisma.shipmentItem.groupBy({
      by: ['orderItemId'],
      where: { orderItemId: { in: [...orderItemIds] }, shipment: { orderId } },
      _sum: { quantity: true },
    })
    const shippedMap = new Map(shippedBefore.map(row => [row.orderItemId, row._sum.quantity ?? 0]))

    const requestedMap = new Map<string, number>()
    for (const item of dto.items) {
      requestedMap.set(item.orderItemId, (requestedMap.get(item.orderItemId) ?? 0) + item.quantity)
    }

    for (const [orderItemId, requested] of requestedMap) {
      const orderItem = order.items.find(item => item.id === orderItemId)
      const limit = orderItem?.quantity ?? 0
      const alreadyShipped = shippedMap.get(orderItemId) ?? 0
      if (alreadyShipped + requested > limit) {
        throw new BusinessException(
          HttpStatus.BAD_REQUEST,
          'SHIPMENT_QUANTITY_EXCEEDED',
          `物流数量超过订单商品数量（上限 ${limit}，已发货 ${alreadyShipped}）`,
        )
      }
    }

    const status = dto.status ?? (dto.trackingNo || dto.shippedAt ? 'SHIPPED' : 'WAITING')

    await this.prisma.$transaction(async tx => {
      const shipment = await tx.shipment.create({
        data: {
          orderId,
          carrier: dto.carrier,
          trackingNo: dto.trackingNo,
          status,
          shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : status === 'SHIPPED' ? new Date() : null,
          estimatedDeliveryAt: dto.estimatedDeliveryAt ? new Date(dto.estimatedDeliveryAt) : null,
          note: dto.note,
        },
        select: { id: true },
      })

      await tx.shipmentItem.createMany({
        data: dto.items.map(item => ({
          shipmentId: shipment.id,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
        })),
      })
    })

    await this.orderService.refreshStatus(userId, orderId)
    return this.orderService.getDetail(userId, orderId)
  }

  async update(userId: string, id: string, dto: UpdateShipmentDto): Promise<OrderDetailVo> {
    const shipment = await this.findOwnedShipment(userId, id)

    await this.prisma.shipment.update({
      where: { id },
      data: {
        carrier: dto.carrier,
        trackingNo: dto.trackingNo,
        status: dto.status,
        shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : undefined,
        estimatedDeliveryAt: dto.estimatedDeliveryAt ? new Date(dto.estimatedDeliveryAt) : undefined,
        note: dto.note,
      },
    })

    await this.orderService.refreshStatus(userId, shipment.orderId)
    return this.orderService.getDetail(userId, shipment.orderId)
  }

  async markDelivered(userId: string, id: string, dto: DeliverShipmentDto): Promise<OrderDetailVo> {
    const shipment = await this.findOwnedShipment(userId, id)
    if (shipment.status !== 'SHIPPED' && shipment.status !== 'IN_TRANSIT') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'SHIPMENT_NOT_DELIVERABLE', '只有已发货/运输中的物流可以标记签收')
    }

    await this.prisma.shipment.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : new Date(),
        note: dto.note ?? shipment.note,
      },
    })

    await this.orderService.refreshStatus(userId, shipment.orderId)
    return this.orderService.getDetail(userId, shipment.orderId)
  }

  private async findOwnedShipment(userId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({ where: { id, order: { userId } } })
    if (!shipment) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'SHIPMENT_NOT_FOUND', '物流记录不存在')
    }
    return shipment
  }
}
```

- [x] **Step 3: 写 `shipment.service.spec.ts`**

```ts
import { ShipmentService } from './shipment.service'

const prismaMock = () => ({
  shipment: { create: vi.fn().mockResolvedValue({ id: 'sh1' }), update: vi.fn(), findFirst: vi.fn() },
  shipmentItem: { createMany: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
  $transaction: vi.fn(),
})

const orderRow = (patch: Record<string, unknown> = {}) => ({
  id: 'o1',
  status: 'ACTIVE',
  items: [
    { id: 'oi1', quantity: 1 },
    { id: 'oi2', quantity: 2 },
  ],
  ...patch,
})

const buildService = (prisma: ReturnType<typeof prismaMock>, order = orderRow()) =>
  new ShipmentService(prisma as never, {
    findOwnedWithRelations: vi.fn().mockResolvedValue(order),
    refreshStatus: vi.fn().mockResolvedValue('ACTIVE'),
    getDetail: vi.fn().mockResolvedValue({ id: 'o1' }),
  } as never)

describe('ShipmentService.create', () => {
  it('明细包含非本订单商品 → 400 INVALID_SHIPMENT_ITEMS', async () => {
    const prisma = prismaMock()
    await expect(
      buildService(prisma).create('u1', 'o1', { items: [{ orderItemId: 'other', quantity: 1 }] }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_SHIPMENT_ITEMS' } })
  })

  it('拆单超量 → 400 SHIPMENT_QUANTITY_EXCEEDED', async () => {
    const prisma = prismaMock()
    prisma.shipmentItem.groupBy.mockResolvedValue([{ orderItemId: 'oi2', _sum: { quantity: 2 } }])
    await expect(
      buildService(prisma).create('u1', 'o1', { items: [{ orderItemId: 'oi2', quantity: 1 }] }),
    ).rejects.toMatchObject({ response: { code: 'SHIPMENT_QUANTITY_EXCEEDED' } })
  })

  it('合法拆单：A×1 + B×1 后 B 仍可再发 1 件', async () => {
    const prisma = prismaMock()
    prisma.shipmentItem.groupBy.mockResolvedValue([{ orderItemId: 'oi2', _sum: { quantity: 1 } }])
    const tx = { shipment: { create: vi.fn().mockResolvedValue({ id: 'sh2' }) }, shipmentItem: { createMany: vi.fn() } }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    await buildService(prisma).create('u1', 'o1', {
      items: [
        { orderItemId: 'oi1', quantity: 1 },
        { orderItemId: 'oi2', quantity: 1 },
      ],
    })
    expect(tx.shipmentItem.createMany).toHaveBeenCalledWith({
      data: [
        { shipmentId: 'sh2', orderItemId: 'oi1', quantity: 1 },
        { shipmentId: 'sh2', orderItemId: 'oi2', quantity: 1 },
      ],
    })
  })

  it('无单号 → WAITING', async () => {
    const prisma = prismaMock()
    const tx = { shipment: { create: vi.fn().mockResolvedValue({ id: 'sh3' }) }, shipmentItem: { createMany: vi.fn() } }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    await buildService(prisma).create('u1', 'o1', { items: [{ orderItemId: 'oi1', quantity: 1 }] })
    expect(tx.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'WAITING', shippedAt: null }),
      select: { id: true },
    })
  })

  it('有单号 → SHIPPED 且带发货时间', async () => {
    const prisma = prismaMock()
    const tx = { shipment: { create: vi.fn().mockResolvedValue({ id: 'sh4' }) }, shipmentItem: { createMany: vi.fn() } }
    prisma.$transaction.mockImplementation(async (arg: never) =>
      (arg as unknown as (t: unknown) => Promise<unknown>)(tx),
    )
    await buildService(prisma).create('u1', 'o1', {
      trackingNo: 'SF123',
      shippedAt: '2027-05-18T10:00:00.000Z',
      items: [{ orderItemId: 'oi1', quantity: 1 }],
    })
    expect(tx.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'SHIPPED', trackingNo: 'SF123', shippedAt: new Date('2027-05-18T10:00:00.000Z') }),
      select: { id: true },
    })
  })

  it('订单已取消 → 400 ORDER_NOT_ACTIVE', async () => {
    const prisma = prismaMock()
    await expect(
      buildService(prisma, orderRow({ status: 'CANCELLED' })).create('u1', 'o1', { items: [{ orderItemId: 'oi1', quantity: 1 }] }),
    ).rejects.toMatchObject({ response: { code: 'ORDER_NOT_ACTIVE' } })
  })
})

describe('ShipmentService.markDelivered', () => {
  it('WAITING 物流不可签收 → 400 SHIPMENT_NOT_DELIVERABLE', async () => {
    const prisma = prismaMock()
    prisma.shipment.findFirst.mockResolvedValue({ id: 'sh1', orderId: 'o1', status: 'WAITING', note: null })
    await expect(buildService(prisma).markDelivered('u1', 'sh1', {})).rejects.toMatchObject({
      response: { code: 'SHIPMENT_NOT_DELIVERABLE' },
    })
  })

  it('IN_TRANSIT → DELIVERED 并刷新订单状态', async () => {
    const prisma = prismaMock()
    prisma.shipment.findFirst.mockResolvedValue({ id: 'sh1', orderId: 'o1', status: 'IN_TRANSIT', note: null })
    const orderService = {
      findOwnedWithRelations: vi.fn(),
      refreshStatus: vi.fn().mockResolvedValue('COMPLETED'),
      getDetail: vi.fn().mockResolvedValue({ id: 'o1' }),
    }
    const service = new ShipmentService(prisma as never, orderService as never)

    await service.markDelivered('u1', 'sh1', { deliveredAt: '2027-05-21T00:00:00.000Z' })

    expect(prisma.shipment.update).toHaveBeenCalledWith({
      where: { id: 'sh1' },
      data: { status: 'DELIVERED', deliveredAt: new Date('2027-05-21T00:00:00.000Z'), note: null },
    })
    expect(orderService.refreshStatus).toHaveBeenCalledWith('u1', 'o1')
  })
})
```

- [x] **Step 4: 写 controller / module 并运行测试**

```ts
@ApiTags('shipments')
@ApiBearerAuth()
@Controller()
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post('orders/:orderId/shipments')
  create(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() dto: CreateShipmentDto) {
    return this.shipmentService.create(user.id, orderId, dto)
  }

  @Patch('shipments/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateShipmentDto) {
    return this.shipmentService.update(user.id, id, dto)
  }

  @Post('shipments/:id/delivered')
  delivered(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DeliverShipmentDto) {
    return this.shipmentService.markDelivered(user.id, id, dto)
  }
}
```

`shipment.module.ts`：`imports: [OrderModule]`；`app.module.ts` 追加 `ShipmentModule`。

Run: `pnpm --filter @hobilog/server test && pnpm --filter @hobilog/server typecheck`

- [ ] **Step 5: 提交（需用户授权）**

```bash
git add apps/server/src/modules/shipment apps/server/src/app.module.ts
git commit -m "feat(shipment): add split shipment creation, status update and delivery"
```

---

### Task 8: P3 全链路验收（真实 PostgreSQL）

**前置条件（阻塞）：** 需要可用 `DATABASE_URL`（P1 Task 6 已配置的库即可）。

**Files:**
- Create: `apps/server/test/order-lifecycle.e2e-spec.ts`
- Create: `docs/superpowers/verification/2026-09-18-P3-verification.md`

**Interfaces:**
- Consumes: P3 全部 API + 真实 Prisma + 假 SupabaseService（只替换身份来源，不替换数据库）
- Produces: 12 个场景在 `HTTP API → NestJS Service → Prisma Transaction → PostgreSQL` 下的实测证据

- [x] **Step 1: 写 e2e（真实数据库，只 mock 身份）**

```ts
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/database/prisma.service'
import { SupabaseService } from '../src/modules/auth/supabase.service'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

describe('Order lifecycle (e2e, real postgres)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let productId: string
  let orderId: string

  const authed = (req: request.Test, token = 'token-a') => req.set('Authorization', `Bearer ${token}`)

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({
        admin: {},
        getUserFromToken: async (token: string) => {
          if (token === 'token-a') return { id: USER_A, email: 'a@hobilog.dev' }
          if (token === 'token-b') return { id: USER_B, email: 'b@hobilog.dev' }
          throw Object.assign(new Error('invalid'), { status: 401 })
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
    prisma = app.get(PrismaService)

    await prisma.userProfile.upsert({ where: { id: USER_A }, create: { id: USER_A }, update: {} })
    await prisma.userProfile.upsert({ where: { id: USER_B }, create: { id: USER_B }, update: {} })
    await prisma.order.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
    await prisma.product.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })

    const product = await prisma.product.create({
      data: { userId: USER_A, name: '芙宁娜 1/7', category: 'SCALE_FIGURE', manufacturer: 'ALTER' },
      select: { id: true },
    })
    productId = product.id
  })

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
    await prisma.product.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
    await prisma.userProfile.deleteMany({ where: { id: { in: [USER_A, USER_B] } } })
    await app.close()
  })

  const createOrder = async (body: Record<string, unknown>) => {
    const res = await authed(request(app.getHttpServer()).post('/api/orders')).send(body)
    expect(res.status).toBe(201)
    return res.body as { id: string; displayStatus: string; displayStatusLabel: string }
  }

  it('B 全款预售：FULL PAID + EXPECTED_RELEASE → WAITING_RELEASE', async () => {
    const order = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'FULL',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'FULL', amount: 1299, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' }],
      expectedRelease: { date: '2027-05-01', precision: 'MONTH' },
    })
    expect(order.displayStatus).toBe('WAITING_RELEASE')
    orderId = order.id
  })

  it('D 尾款逾期：动态推导 PAYMENT_OVERDUE', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'DEPOSIT_BALANCE',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [
        { type: 'DEPOSIT', amount: 300, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' },
        { type: 'BALANCE', amount: 999, dueAt: '2020-01-01' },
      ],
    })
    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    expect(detail.body.displayStatus).toBe('PAYMENT_OVERDUE')
    expect(detail.body.paymentSummary.status).toBe('OVERDUE')
  })

  it('C + 标记付款：DEPOSIT PAID + BALANCE PENDING → WAITING_PAYMENT，付款后转 WAITING_RELEASE', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'DEPOSIT_BALANCE',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [
        { type: 'DEPOSIT', amount: 300, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' },
        { type: 'BALANCE', amount: 999, dueAt: '2027-03-20' },
      ],
      expectedRelease: { date: '2027-05-01', precision: 'MONTH' },
    })
    expect(created.displayStatus).toBe('WAITING_PAYMENT')

    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    const balance = detail.body.payments.find((item: { type: string }) => item.type === 'BALANCE')

    const paid = await authed(request(app.getHttpServer()).post(`/api/payments/${balance.id}/paid`)).send({
      paidAmount: 999,
      paidAt: '2027-03-18T10:00:00.000Z',
      paymentMethod: '支付宝',
    })
    expect(paid.status).toBe(201)
    expect(paid.body.displayStatus).toBe('WAITING_RELEASE')
    expect(paid.body.paymentSummary.paidAmount).toBe(1299)
  })

  it('E 延期：保留 oldDate → newDate 且标签体现延期', async () => {
    const res = await authed(request(app.getHttpServer()).post(`/api/orders/${orderId}/release/delay`)).send({
      newDate: '2027-07-01',
      precision: 'MONTH',
      source: '厂商公告',
    })
    expect(res.status).toBe(201)
    const events = res.body.releaseEvents as Array<{ type: string; oldDate: string; newDate: string }>
    const delay = events.find(event => event.type === 'DELAY')
    expect(delay?.oldDate).toBe('2027-05-01')
    expect(delay?.newDate).toBe('2027-07-01')
    expect(res.body.releaseSummary.delayMonths).toBe(2)
  })

  it('F + G + J 厂商出货 → 物流 → 签收 → COMPLETED', async () => {
    const released = await authed(request(app.getHttpServer()).post(`/api/orders/${orderId}/release/released`)).send({
      date: '2027-07-10',
    })
    expect(released.body.displayStatus).toBe('WAITING_SHIPMENT')

    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${orderId}`))
    const orderItemId = detail.body.items[0].id

    const shipped = await authed(request(app.getHttpServer()).post(`/api/orders/${orderId}/shipments`)).send({
      carrier: '顺丰',
      trackingNo: 'SF123456789',
      shippedAt: '2027-07-12T10:00:00.000Z',
      items: [{ orderItemId, quantity: 1 }],
    })
    expect(shipped.body.displayStatus).toBe('IN_TRANSIT')

    const shipmentId = shipped.body.shipments[0].id
    const delivered = await authed(request(app.getHttpServer()).post(`/api/shipments/${shipmentId}/delivered`)).send({})
    expect(delivered.body.displayStatus).toBe('COMPLETED')
    expect(delivered.body.status).toBe('COMPLETED')
  })

  it('H 物流异常：EXCEPTION 优先于运输中', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 100 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'FULL',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'FULL', amount: 100, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' }],
    })
    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    const orderItemId = detail.body.items[0].id

    const shipped = await authed(request(app.getHttpServer()).post(`/api/orders/${created.id}/shipments`)).send({
      carrier: '顺丰',
      trackingNo: 'SF-EXC',
      items: [{ orderItemId, quantity: 1 }],
    })
    const shipmentId = shipped.body.shipments[0].id

    const exception = await authed(request(app.getHttpServer()).patch(`/api/shipments/${shipmentId}`)).send({
      status: 'EXCEPTION',
      note: '包裹破损',
    })
    expect(exception.body.displayStatus).toBe('SHIPMENT_EXCEPTION')
  })

  it('I 多包裹：1 DELIVERED + 1 IN_TRANSIT → IN_TRANSIT', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 2, unitPrice: 100 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'FULL',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [{ type: 'FULL', amount: 200, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' }],
    })
    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    const orderItemId = detail.body.items[0].id

    const first = await authed(request(app.getHttpServer()).post(`/api/orders/${created.id}/shipments`)).send({
      carrier: '顺丰',
      trackingNo: 'SF-A',
      items: [{ orderItemId, quantity: 1 }],
    })
    await authed(request(app.getHttpServer()).post(`/api/shipments/${first.body.shipments[0].id}/delivered`)).send({})

    const second = await authed(request(app.getHttpServer()).post(`/api/orders/${created.id}/shipments`)).send({
      carrier: '圆通',
      trackingNo: 'YT-B',
      items: [{ orderItemId, quantity: 1 }],
    })
    expect(second.body.displayStatus).toBe('IN_TRANSIT')
    expect(second.body.shipmentSummary.inTransitCount).toBe(1)

    const overShip = await authed(request(app.getHttpServer()).post(`/api/orders/${created.id}/shipments`)).send({
      carrier: '圆通',
      trackingNo: 'YT-C',
      items: [{ orderItemId, quantity: 1 }],
    })
    expect(overShip.status).toBe(400)
    expect(overShip.body.code).toBe('SHIPMENT_QUANTITY_EXCEEDED')
  })

  it('金额待定补邮：amount = null 仍计入待付款', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'CUSTOM',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [
        { type: 'FULL', amount: 1299, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' },
        { type: 'SHIPPING', amount: null },
      ],
    })
    const detail = await authed(request(app.getHttpServer()).get(`/api/orders/${created.id}`))
    expect(detail.body.displayStatus).toBe('WAITING_PAYMENT')
    expect(detail.body.displayStatusHint).toBe('暂无截止日期')
    expect(detail.body.paymentSummary.pendingAmount).toBe(0)
    expect(detail.body.paymentSummary.nextPayment.type).toBe('SHIPPING')
  })

  it('退款取消：订单 CANCELLED + 未付节点 CANCELLED + 退款记录', async () => {
    const created = await createOrder({
      items: [{ productId, quantity: 1, unitPrice: 1299 }],
      orderedAt: '2026-09-18',
      currency: 'CNY',
      paymentMode: 'DEPOSIT_BALANCE',
      autoCalculateGoodsAmount: true,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      extraAmount: 0,
      payments: [
        { type: 'DEPOSIT', amount: 300, status: 'PAID', paidAt: '2026-09-18T10:00:00.000Z' },
        { type: 'BALANCE', amount: 999, dueAt: '2027-03-20' },
      ],
    })

    const cancelled = await authed(request(app.getHttpServer()).post(`/api/orders/${created.id}/cancel`)).send({
      refund: true,
      note: '店家取消发货',
    })
    expect(cancelled.body.status).toBe('CANCELLED')
    expect(cancelled.body.displayStatus).toBe('CANCELLED')
    const statuses = (cancelled.body.payments as Array<{ type: string; status: string }>).map(item => `${item.type}:${item.status}`)
    expect(statuses).toContain('BALANCE:CANCELLED')
    expect(statuses).toContain('REFUND:PAID')
    expect(cancelled.body.paymentSummary.netPaidAmount).toBe(0)
  })

  it('越权隔离：用户 B 无法读取用户 A 的订单', async () => {
    const res = await authed(request(app.getHttpServer()).get(`/api/orders/${orderId}`), 'token-b')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('ORDER_NOT_FOUND')

    const list = await authed(request(app.getHttpServer()).get('/api/orders'), 'token-b')
    expect(list.body.items).toHaveLength(0)
  })
})
```

- [x] **Step 2: 运行 e2e**

Run:

```bash
pnpm --filter @hobilog/server test:e2e
pnpm --filter @hobilog/server test
pnpm -r typecheck
```

Expected: `order-lifecycle.e2e-spec.ts` 全绿（12 个 it 覆盖 A–L + 越权 + 金额待定 + 超量拆单）；单测保持绿。

若失败，按 `superpowers:systematic-debugging` 定位，禁止改断言绕过。

- [x] **Step 3: 写验收记录并汇报**

`docs/superpowers/verification/2026-09-18-P3-verification.md` 记录：每个场景的请求、期望、实际、结论。

汇报格式：

```text
P3 完成：Order（创建事务/列表 Tab/详情聚合/编辑/取消）+ Payment（新增/标记付款/补差价/退款）
+ Release（延期/厂商出货/店铺到货/补款开始）+ Shipment（拆单/状态/签收）
状态机：DisplayStatus/PaymentSummary/ReleaseStatus/ShipmentSummary 全部纯函数派生，12 场景全绿
下一步：P4 统计与附件（Statistics / Calendar / Collection / Attachment / Notification）
```

- [ ] **Step 4: 提交（需用户授权）**

```bash
git add apps/server/test/order-lifecycle.e2e-spec.ts docs/superpowers/verification
git commit -m "test(order): add end-to-end lifecycle acceptance against postgres"
```

