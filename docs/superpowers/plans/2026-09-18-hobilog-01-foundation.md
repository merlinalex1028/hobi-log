# HobiLog V0.1 工程底座（P1）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭起 HobiLog monorepo 底座：pnpm workspace + `@hobilog/shared` 枚举包 + NestJS 服务骨架（Config / Prisma / 统一错误 / 分页 / Swagger / 健康检查），并把 `docs/04` 的 Prisma Schema 落成首个 migration。

**Architecture:** pnpm workspace 三包：`apps/server`（NestJS 10 + Prisma 5）、`apps/web`（P5 才创建）、`packages/shared`（稳定枚举/常量/API 类型，编译为 CommonJS）。`apps/server/prisma/` 持有 schema 与 migrations；PrismaService 由 `@Global()` 的 PrismaModule 提供；错误体与分页形状在 P1 冻结，P2-P5 全部复用。

**Tech Stack:** pnpm 9 / Node >= 20.11 / TypeScript 5.6 / NestJS 10.4 / Prisma 5.22 / class-validator / @nestjs/swagger / Jest 29 + Supertest 7 / Vitest 2。

## Global Constraints

与 `docs/superpowers/plans/2026-09-18-hobilog-v0.1-roadmap.md` 的「全局约束」一致，P1 额外注意：

- `shared` 包编译为 CommonJS（`tsconfig.base.json` 的 `module: commonjs`），同时供 Nest（CJS）与 Vite（ESM，可消费 CJS）使用。
- Prisma 目录固定 `apps/server/prisma/`，命令一律 `pnpm --filter @hobilog/server exec prisma ...`。
- 统一错误体 `{ statusCode, code, message }`；校验失败 `code = VALIDATION_FAILED`。
- 分页 `{ items, total, page, pageSize }`，默认 `page = 1`、`pageSize = 20`、上限 100。
- P1 必填环境变量只有 `DATABASE_URL`、`DIRECT_URL`（Supabase 相关 key 在 P2 追加为必填）。
- 金额在 JSON 出口统一 `number`，Prisma `Decimal` 不直接返回（P3 起生效，P1 只约定）。
- **提交策略**：每个 Task 末尾的 `git commit` 步骤只有在用户明确授权提交时才执行；未授权时跳过并在里程碑汇报中列出待提交清单。

---

### Task 1: Monorepo 骨架与工程约定

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `tsconfig.base.json`
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: 无
- Produces: workspace 根坐标 `hobilog`；`pnpm -r <script>` 统一入口（`build` / `test` / `typecheck`）；`tsconfig.base.json` 供所有子包 `extends`。

- [ ] **Step 1: 写根 `package.json`**

```json
{
  "name": "hobilog",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20.11.0"
  },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "dev:server": "pnpm --filter @hobilog/server start:dev",
    "dev:web": "pnpm --filter @hobilog/web dev",
    "db:migrate": "pnpm --filter @hobilog/server exec prisma migrate dev",
    "db:status": "pnpm --filter @hobilog/server exec prisma migrate status",
    "db:generate": "pnpm --filter @hobilog/server exec prisma generate"
  }
}
```

- [ ] **Step 2: 写 `pnpm-workspace.yaml`、`.npmrc`、`.gitignore`、`tsconfig.base.json`**

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

`.npmrc`:

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

`.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
*.log
.DS_Store
*.tsbuildinfo
apps/server/prisma/migrations/dev.db*
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- [ ] **Step 3: 写 `AGENTS.md`（给后续 agent 的固定命令与约定）**

```markdown
# HobiLog 工程约定

## 包结构
- `apps/server` NestJS API（业务权威入口）
- `apps/web` Vue3 Web（只调 NestJS API）
- `packages/shared` 前后端共享枚举 / 常量 / API 类型（CommonJS 产物）
- `apps/server/prisma` Schema 与 Migration

## 命令
- 安装：`pnpm install`
- 构建：`pnpm -r build`
- 单测：`pnpm -r test`
- 类型检查：`pnpm -r typecheck`
- 服务端 e2e：`pnpm --filter @hobilog/server test:e2e`
- 开发服务端：`pnpm dev:server`
- 迁移：`pnpm --filter @hobilog/server exec prisma migrate dev --name <name>`
- 迁移状态：`pnpm db:status`

## 硬性约定
- 业务数据只走 `Vue → NestJS API → Prisma → PostgreSQL`；Web 禁用 `supabase.from(...)` / `supabase.rpc(...)`。
- `userId` 只能来自验证过的 Supabase Token；Controller 里禁止出现 Prisma 调用。
- 错误体 `{ statusCode, code, message }`；分页 `{ items, total, page, pageSize }`。
- 金额 API 出口为 `number`；`OrderStatus` 只有 4 个值，归档用 `archived`。
- 新增接口或改接口后，先跑 `pnpm -r typecheck` 与 `pnpm -r test`，再更新 `docs/05` 对应条目。
```

- [ ] **Step 4: 安装并验证 workspace 生效**

Run:

```bash
pnpm install
pnpm ls -r --depth -1
node -v
```

Expected: `pnpm ls -r --depth -1` 输出根包 `hobilog`（此时无子包，属正常）；`node -v` >= v20.11。

- [ ] **Step 5: 提交（需用户授权）**

```bash
git add package.json pnpm-workspace.yaml .gitignore .npmrc tsconfig.base.json AGENTS.md
git commit -m "chore: bootstrap pnpm monorepo skeleton"
```

---

### Task 2: `@hobilog/shared` 枚举、标签与 API 类型

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/enums/index.ts`
- Create: `packages/shared/src/enums/labels.ts`
- Create: `packages/shared/src/enums/labels.spec.ts`
- Create: `packages/shared/src/types/api.ts`
- Create: `packages/shared/src/constants/index.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/vitest.config.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json`
- Produces:
  - 枚举值数组 + 联合类型：`PAYMENT_MODES`/`PaymentMode`、`ORDER_STATUSES`/`OrderStatus`、`PAYMENT_STATUSES`/`PaymentStatus`、`SHIPMENT_STATUSES`/`ShipmentStatus`、`PAYMENT_TYPES`/`PaymentType`、`RELEASE_EVENT_TYPES`/`ReleaseEventType`、`PRODUCT_CATEGORIES`/`ProductCategory`、`ATTACHMENT_TYPES`/`AttachmentType`、`DISPLAY_STATUSES`/`DisplayStatus`、`PAYMENT_SUMMARY_STATUSES`/`PaymentSummaryStatus`、`RELEASE_STATUSES`/`ReleaseStatus`
  - 标签映射：`PAYMENT_MODE_LABELS`、`ORDER_STATUS_LABELS`、`PAYMENT_STATUS_LABELS`、`SHIPMENT_STATUS_LABELS`、`PAYMENT_TYPE_LABELS`、`RELEASE_EVENT_TYPE_LABELS`、`PRODUCT_CATEGORY_LABELS`、`ATTACHMENT_TYPE_LABELS`、`DISPLAY_STATUS_LABELS`、`RELEASE_STATUS_LABELS`
  - 优先级常量：`DISPLAY_STATUS_PRIORITY`、`SHIPMENT_SUMMARY_PRIORITY`、`PAYMENT_SUMMARY_PRIORITY`
  - API 类型：`ApiErrorBody`、`Paginated<T>`、`PaginationQuery`
  - 常量：`DEFAULT_PAGE_SIZE = 20`、`MAX_PAGE_SIZE = 100`、`SUPPORTED_CURRENCIES`、`REMINDER_OFFSET_DAYS`

- [ ] **Step 1: 写 `packages/shared/package.json` 与 `tsconfig.json`**

`package.json`:

```json
{
  "name": "@hobilog/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

`tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "dist"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
})
```

Run: `pnpm install` → Expected: `packages/shared/node_modules` 出现 `vitest`、`typescript`。

- [ ] **Step 2: 写失败测试 `packages/shared/src/enums/labels.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_TYPES,
  DISPLAY_STATUSES,
  ORDER_STATUSES,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PRODUCT_CATEGORIES,
  RELEASE_EVENT_TYPES,
  RELEASE_STATUSES,
  SHIPMENT_STATUSES,
} from './index'
import {
  ATTACHMENT_TYPE_LABELS,
  DISPLAY_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_MODE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  PRODUCT_CATEGORY_LABELS,
  RELEASE_EVENT_TYPE_LABELS,
  RELEASE_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
} from './labels'
import { DISPLAY_STATUS_PRIORITY, SHIPMENT_SUMMARY_PRIORITY } from '../constants'

const cases: Array<[readonly string[], Record<string, string>]> = [
  [PAYMENT_MODES, PAYMENT_MODE_LABELS],
  [ORDER_STATUSES, ORDER_STATUS_LABELS],
  [PAYMENT_STATUSES, PAYMENT_STATUS_LABELS],
  [SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS],
  [PAYMENT_TYPES, PAYMENT_TYPE_LABELS],
  [RELEASE_EVENT_TYPES, RELEASE_EVENT_TYPE_LABELS],
  [PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS],
  [ATTACHMENT_TYPES, ATTACHMENT_TYPE_LABELS],
  [DISPLAY_STATUSES, DISPLAY_STATUS_LABELS],
  [RELEASE_STATUSES, RELEASE_STATUS_LABELS],
]

describe('枚举标签完整性', () => {
  it.each(cases)('%s 每个值都有中文标签', (values, labels) => {
    for (const value of values) {
      expect(labels[value], `缺少标签: ${value}`).toBeTruthy()
    }
  })
})

describe('状态枚举取值', () => {
  it('OrderStatus 只有 4 个终态', () => {
    expect([...ORDER_STATUSES]).toEqual(['ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED'])
  })

  it('PaymentStatus 落库不含 OVERDUE', () => {
    expect([...PAYMENT_STATUSES]).toEqual([
      'PENDING',
      'PAID',
      'CANCELLED',
      'REFUNDED',
      'PARTIALLY_REFUNDED',
    ])
  })

  it('DisplayStatus 优先级覆盖全部展示状态', () => {
    expect(Object.keys(DISPLAY_STATUS_PRIORITY).sort()).toEqual([...DISPLAY_STATUSES].sort())
  })

  it('Shipment 汇总优先级覆盖全部物流状态', () => {
    expect(Object.keys(SHIPMENT_SUMMARY_PRIORITY).sort()).toEqual([...SHIPMENT_STATUSES].sort())
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @hobilog/shared test`
Expected: FAIL，报 `Cannot find module './index'` 或 `./labels`。

- [ ] **Step 4: 写 `packages/shared/src/enums/index.ts`**

```ts
export const PAYMENT_MODES = ['FULL', 'DEPOSIT_BALANCE', 'INSTALLMENT', 'CUSTOM'] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export const ORDER_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_TYPES = [
  'FULL',
  'DEPOSIT',
  'BALANCE',
  'INSTALLMENT',
  'SHIPPING',
  'TAX',
  'SUPPLEMENT',
  'REFUND',
  'OTHER',
] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]

export const RELEASE_EVENT_TYPES = [
  'EXPECTED_RELEASE',
  'DELAY',
  'RELEASED',
  'STORE_ARRIVED',
  'BALANCE_OPEN',
  'SHIPMENT_READY',
] as const
export type ReleaseEventType = (typeof RELEASE_EVENT_TYPES)[number]

export const SHIPMENT_STATUSES = [
  'WAITING',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'EXCEPTION',
  'RETURNED',
] as const
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

export const PRODUCT_CATEGORIES = [
  'SCALE_FIGURE',
  'PRIZE_FIGURE',
  'NENDOROID',
  'ACTION_FIGURE',
  'GK',
  'MODEL',
  'PLUSH',
  'ACRYLIC',
  'BADGE',
  'CARD',
  'BOOK',
  'OTHER',
] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const ATTACHMENT_TYPES = [
  'PRODUCT_IMAGE',
  'ORDER_SCREENSHOT',
  'PAYMENT_SCREENSHOT',
  'PAYMENT_PROOF',
  'SHIPMENT_SCREENSHOT',
  'CHAT_SCREENSHOT',
  'OTHER',
] as const
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number]

export const DISPLAY_STATUSES = [
  'CANCELLED',
  'REFUNDED',
  'PAYMENT_OVERDUE',
  'WAITING_PAYMENT',
  'SHIPMENT_EXCEPTION',
  'IN_TRANSIT',
  'WAITING_SHIPMENT',
  'WAITING_RELEASE',
  'COMPLETED',
  'ACTIVE',
] as const
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number]

export const PAYMENT_SUMMARY_STATUSES = ['OVERDUE', 'PARTIALLY_PAID', 'UNPAID', 'PAID'] as const
export type PaymentSummaryStatus = (typeof PAYMENT_SUMMARY_STATUSES)[number]

export const RELEASE_STATUSES = [
  'UNKNOWN',
  'WAITING_RELEASE',
  'DELAYED',
  'RELEASED',
  'STORE_ARRIVED',
  'READY_TO_SHIP',
] as const
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number]
```

- [ ] **Step 5: 写 `packages/shared/src/enums/labels.ts`**

```ts
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
```

- [ ] **Step 6: 写 `packages/shared/src/constants/index.ts`**

```ts
import type { DisplayStatus, PaymentSummaryStatus, ShipmentStatus } from '../enums'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export const SUPPORTED_CURRENCIES = ['CNY', 'JPY', 'USD', 'HKD'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const DEFAULT_CURRENCY = 'CNY'

export const REMINDER_OFFSET_DAYS = [7, 3, 1, 0] as const

export const DISPLAY_STATUS_PRIORITY: Record<DisplayStatus, number> = {
  CANCELLED: 0,
  REFUNDED: 1,
  PAYMENT_OVERDUE: 2,
  WAITING_PAYMENT: 3,
  SHIPMENT_EXCEPTION: 4,
  IN_TRANSIT: 5,
  WAITING_SHIPMENT: 6,
  WAITING_RELEASE: 7,
  COMPLETED: 8,
  ACTIVE: 9,
}

export const SHIPMENT_SUMMARY_PRIORITY: Record<ShipmentStatus, number> = {
  EXCEPTION: 0,
  IN_TRANSIT: 1,
  SHIPPED: 2,
  WAITING: 3,
  DELIVERED: 4,
  RETURNED: 5,
}

export const PAYMENT_SUMMARY_PRIORITY: Record<PaymentSummaryStatus, number> = {
  OVERDUE: 0,
  PARTIALLY_PAID: 1,
  UNPAID: 2,
  PAID: 3,
}

export const PAYMENT_TYPE_ORDER: Record<string, number> = {
  FULL: 0,
  DEPOSIT: 1,
  INSTALLMENT: 2,
  BALANCE: 3,
  SHIPPING: 4,
  TAX: 5,
  SUPPLEMENT: 6,
  OTHER: 7,
  REFUND: 8,
}
```

说明（对设计稿的一处补全）：`docs/07 §17` 的汇总优先级只列了 `EXCEPTION > IN_TRANSIT > SHIPPED > WAITING > DELIVERED`，未覆盖 `RETURNED`；本计划把 `RETURNED` 排在末位（`RETURNED: 5`），保证优先级表覆盖全部枚举值，便于 P3 的测试断言。若产品要求 `RETURNED` 视同异常，P3 再调整该值。

- [ ] **Step 7: 写 `packages/shared/src/types/api.ts` 与 `src/index.ts`**

`src/types/api.ts`:

```ts
export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface PaginationQuery {
  page?: number
  pageSize?: number
}
```

`src/index.ts`:

```ts
export * from './enums'
export * from './enums/labels'
export * from './types/api'
export * from './constants'
```

- [ ] **Step 8: 运行测试与构建，确认通过**

Run:

```bash
pnpm --filter @hobilog/shared test
pnpm --filter @hobilog/shared build
pnpm --filter @hobilog/shared typecheck
```

Expected: 测试全绿；`packages/shared/dist/index.js` 与 `dist/index.d.ts` 生成。

- [ ] **Step 9: 提交（需用户授权）**

```bash
git add packages/shared
git commit -m "feat(shared): add enums, labels, priorities and api types"
```

---

### Task 3: NestJS 服务骨架与 `/api/health`

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/tsconfig.build.json`
- Create: `apps/server/nest-cli.json`
- Create: `apps/server/jest.config.js`
- Create: `apps/server/test/jest-e2e.json`
- Create: `apps/server/test/setup-env.ts`
- Create: `apps/server/test/health.e2e-spec.ts`
- Create: `apps/server/src/main.ts`
- Create: `apps/server/src/app.module.ts`
- Create: `apps/server/src/modules/health/health.module.ts`
- Create: `apps/server/src/modules/health/health.controller.ts`

**Interfaces:**
- Consumes: `@hobilog/shared`（P1 暂未在代码中 import，依赖已声明）
- Produces: `GET /api/health` → `{ status: 'ok', uptime: number }`；Swagger 挂载在 `/api/docs`；全局前缀 `api`；`AppModule`。

- [ ] **Step 1: 写 `apps/server/package.json`**

```json
{
  "name": "@hobilog/server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "prestart": "pnpm --filter @hobilog/shared build",
    "start": "nest start",
    "prestart:dev": "pnpm --filter @hobilog/shared build",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:status": "prisma migrate status",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@hobilog/shared": "workspace:*",
    "@nestjs/common": "^10.4.6",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.4.6",
    "@nestjs/platform-express": "^10.4.6",
    "@nestjs/swagger": "^8.0.5",
    "@prisma/client": "^5.22.0",
    "@supabase/supabase-js": "^2.46.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.7",
    "@nestjs/schematics": "^10.2.3",
    "@nestjs/testing": "^10.4.6",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.14",
    "@types/node": "^20.17.6",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^5.22.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: 写 tsconfig / nest-cli / jest 配置**

`apps/server/tsconfig.json`（`paths` 只服务 IDE 与 `--noEmit` 类型检查，不参与构建）：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "@hobilog/shared": ["../../packages/shared/src/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`apps/server/tsconfig.build.json`（**必须清空 `paths`**，否则 tsc 会把 `packages/shared/src` 拉进编译，`rootDir` 被抬高导致产物变成 `dist/apps/server/src/main.js`，`node dist/main.js` 会 404；清空后走 node_modules 解析 `packages/shared/dist`）：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "paths": {}
  },
  "exclude": ["node_modules", "test", "dist", "**/*.spec.ts", "**/*.e2e-spec.ts"]
}
```

`apps/server/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.build.json"
  }
}
```

`apps/server/jest.config.js`:

```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@hobilog/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
}
```

`apps/server/test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.ts$": "ts-jest" },
  "setupFiles": ["<rootDir>/setup-env.ts"],
  "moduleNameMapper": {
    "^@hobilog/shared$": "<rootDir>/../../../packages/shared/src/index.ts"
  }
}
```

`apps/server/test/setup-env.ts`:

```ts
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/hobilog_test'
process.env.DIRECT_URL ??= 'postgresql://postgres:postgres@localhost:5432/hobilog_test'
```

- [ ] **Step 3: 写失败的 e2e 测试 `apps/server/test/health.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('Health (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/health 返回 ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(typeof res.body.uptime).toBe('number')
  })
})
```

- [ ] **Step 4: 安装依赖并运行确认失败**

Run:

```bash
pnpm install
pnpm --filter @hobilog/server test:e2e
```

Expected: FAIL，报 `Cannot find module '../src/app.module'`。

- [ ] **Step 5: 实现 `HealthController` / `HealthModule` / `AppModule` / `main.ts`**

`src/modules/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: '存活探针' })
  @ApiOkResponse({ schema: { example: { status: 'ok', uptime: 1.23 } } })
  check(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() }
  }
}
```

`src/modules/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

`src/app.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { HealthModule } from './modules/health/health.module'

@Module({ imports: [HealthModule] })
export class AppModule {}
```

`src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true })

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HobiLog API')
    .setVersion('0.1')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(Number(process.env.PORT ?? 3000))
}

void bootstrap()
```

- [ ] **Step 6: 运行确认通过**

Run:

```bash
pnpm --filter @hobilog/shared build
pnpm --filter @hobilog/server test:e2e
pnpm --filter @hobilog/server typecheck
pnpm --filter @hobilog/server build
```

Expected: e2e PASS（1 passed）；typecheck 无错误；`apps/server/dist/main.js` 生成（**确认路径是 `dist/main.js`，不是 `dist/apps/server/src/main.js`**）。`pnpm -r build` 时 pnpm 会按拓扑序先构建 `@hobilog/shared`，因此 server 构建依赖的 `packages/shared/dist` 一定存在。

- [ ] **Step 7: 提交（需用户授权）**

```bash
git add apps/server
git commit -m "feat(server): bootstrap nestjs app with health endpoint and swagger"
```

---

### Task 4: 配置模块与环境变量校验

**Files:**
- Create: `apps/server/src/config/configuration.ts`
- Create: `apps/server/src/config/env.validation.ts`
- Create: `apps/server/src/config/env.validation.spec.ts`
- Create: `apps/server/.env.example`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `AppModule`
- Produces: `validateEnv(raw): AppEnv`；`configuration(): AppConfig`；`ConfigModule` 全局注册；`AppConfig` 字段 `nodeEnv` / `port` / `webOrigin` / `databaseUrl` / `directUrl`。

- [ ] **Step 1: 写失败测试 `apps/server/src/config/env.validation.spec.ts`**

```ts
import { validateEnv } from './env.validation'

const validRaw = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hobilog',
  DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/hobilog',
}

describe('validateEnv', () => {
  it('缺少 DATABASE_URL 时抛错', () => {
    expect(() => validateEnv({ ...validRaw, DATABASE_URL: '' })).toThrow('MISSING_ENV: DATABASE_URL')
  })

  it('同时缺少多项时全部列出', () => {
    expect(() => validateEnv({})).toThrow('MISSING_ENV: DATABASE_URL, DIRECT_URL')
  })

  it('提供默认值', () => {
    const env = validateEnv(validRaw)
    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3000)
    expect(env.WEB_ORIGIN).toBe('http://localhost:5173')
  })

  it('保留显式配置', () => {
    const env = validateEnv({ ...validRaw, NODE_ENV: 'test', PORT: '4000' })
    expect(env.NODE_ENV).toBe('test')
    expect(env.PORT).toBe(4000)
  })

  it('PORT 非数字时抛错', () => {
    expect(() => validateEnv({ ...validRaw, PORT: 'abc' })).toThrow('INVALID_ENV: PORT')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @hobilog/server test`
Expected: FAIL，报 `Cannot find module './env.validation'`。

- [ ] **Step 3: 实现 `env.validation.ts` 与 `configuration.ts`**

`src/config/env.validation.ts`:

```ts
export type AppEnvName = 'development' | 'test' | 'production'

export interface AppEnv {
  NODE_ENV: AppEnvName
  PORT: number
  WEB_ORIGIN: string
  DATABASE_URL: string
  DIRECT_URL: string
}

const REQUIRED_KEYS = ['DATABASE_URL', 'DIRECT_URL'] as const

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const missing = REQUIRED_KEYS.filter(key => {
    const value = raw[key]
    return typeof value !== 'string' || value.trim() === ''
  })
  if (missing.length > 0) {
    throw new Error(`MISSING_ENV: ${missing.join(', ')}`)
  }

  const port = raw.PORT === undefined ? 3000 : Number(raw.PORT)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('INVALID_ENV: PORT')
  }

  return {
    NODE_ENV: (raw.NODE_ENV as AppEnvName | undefined) ?? 'development',
    PORT: port,
    WEB_ORIGIN: typeof raw.WEB_ORIGIN === 'string' && raw.WEB_ORIGIN !== '' ? raw.WEB_ORIGIN : 'http://localhost:5173',
    DATABASE_URL: raw.DATABASE_URL as string,
    DIRECT_URL: raw.DIRECT_URL as string,
  }
}
```

`src/config/configuration.ts`:

```ts
export interface AppConfig {
  nodeEnv: string
  port: number
  webOrigin: string
  databaseUrl: string
  directUrl: string
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL as string,
  directUrl: process.env.DIRECT_URL as string,
})
```

- [ ] **Step 4: 注册 ConfigModule 并写 `.env.example`**

`src/app.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import configuration from './config/configuration'
import { validateEnv } from './config/env.validation'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    HealthModule,
  ],
})
export class AppModule {}
```

`apps/server/.env.example`:

```env
NODE_ENV=development
PORT=3000
WEB_ORIGIN=http://localhost:5173

# Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres

# Supabase（P2 起必填）
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

- [ ] **Step 5: 运行确认通过**

Run:

```bash
pnpm --filter @hobilog/server test
pnpm --filter @hobilog/server test:e2e
```

Expected: 单测 5 passed；e2e 仍 PASS（`test/setup-env.ts` 已提供必填变量）。

- [ ] **Step 6: 提交（需用户授权）**

```bash
git add apps/server/src/config apps/server/src/app.module.ts apps/server/.env.example
git commit -m "feat(server): add config module with env validation"
```

---

### Task 5: Prisma Schema、PrismaService 与首次 generate

**Files:**
- Create: `apps/server/prisma/schema.prisma`
- Create: `apps/server/src/database/prisma.service.ts`
- Create: `apps/server/src/database/prisma.service.spec.ts`
- Create: `apps/server/src/database/prisma.module.ts`
- Modify: `apps/server/src/app.module.ts`
- Modify: `apps/server/package.json`（追加 `prisma.seed` 不需要；仅确认 scripts 已有 prisma 命令）

**Interfaces:**
- Consumes: `AppModule`、`validateEnv`
- Produces: `PrismaService`（继承 `PrismaClient`，`onModuleInit` 连接、`onModuleDestroy` 断开）；全局 `PrismaModule`；14 个 model 的 Prisma Client 类型。

- [ ] **Step 1: 写 `apps/server/prisma/schema.prisma`**

内容 = `docs/04-HobiLog-V0.1-PrismaSchema与Migration.md` 中 §3 generator/datasource + §4 Enum + §5 ～ §12 的全部 model，**逐字复制，不要改写字段名、`@db.*`、`@@map`**。头部固定为：

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

必须存在下列 14 个 model，且 `@@map` 表名如下（用于自检）：

| model | 表名 |
| --- | --- |
| UserProfile | user_profiles |
| Platform | platforms |
| Store | stores |
| Product | products |
| Order | orders |
| OrderItem | order_items |
| Payment | payments |
| ReleaseEvent | release_events |
| Shipment | shipments |
| ShipmentItem | shipment_items |
| OrderEvent | order_events |
| Attachment | attachments |
| Tag | tags |
| ProductTag | product_tags |

注意（与 `docs/04` 一致，不要“顺手优化”）：

- `UserProfile.id` 无 `@default`，与 Supabase Auth User ID 一致。
- `Payment.type` / `Product.category` / `Attachment.type` / `ReleaseEvent.type` / `OrderEvent.type` 为 `String`，取值合法性由 Service 校验。
- `Order.orderedAt` 为 `@db.Date`（无时间部分）；`Payment.paidAt` 为 `DateTime`（带时间）。
- `Attachment.fileSize` 为 `BigInt?`。

- [ ] **Step 2: 校验并生成 Client**

Run:

```bash
pnpm --filter @hobilog/server exec prisma validate
pnpm --filter @hobilog/server exec prisma generate
```

Expected: `The schema at prisma/schema.prisma is valid`；`Generated Prisma Client` 成功。

- [ ] **Step 3: 写失败测试 `apps/server/src/database/prisma.service.spec.ts`**

```ts
import { PrismaService } from './prisma.service'

describe('PrismaService', () => {
  it('暴露 Prisma Model Delegate', () => {
    const service = new PrismaService()
    expect(typeof service.order.findMany).toBe('function')
    expect(typeof service.payment.findMany).toBe('function')
    expect(typeof service.releaseEvent.findMany).toBe('function')
    expect(typeof service.shipmentItem.findMany).toBe('function')
    expect(typeof service.$transaction).toBe('function')
  })
})
```

- [ ] **Step 4: 运行确认失败**

Run: `pnpm --filter @hobilog/server test`
Expected: FAIL，报 `Cannot find module './prisma.service'`。

- [ ] **Step 5: 实现 `PrismaService` 与 `PrismaModule`**

`src/database/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
```

`src/database/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

`src/app.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import configuration from './config/configuration'
import { validateEnv } from './config/env.validation'
import { PrismaModule } from './database/prisma.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: 让 e2e 不依赖真实数据库（覆写 PrismaService）**

修改 `apps/server/test/health.e2e-spec.ts` 的 `beforeAll`：

```ts
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/database/prisma.service'

describe('Health (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: async () => undefined, $disconnect: async () => undefined })
      .compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/health 返回 ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(typeof res.body.uptime).toBe('number')
  })
})
```

- [ ] **Step 7: 运行确认通过**

Run:

```bash
pnpm --filter @hobilog/server test
pnpm --filter @hobilog/server test:e2e
pnpm --filter @hobilog/server typecheck
```

Expected: 全绿；`@prisma/client` 已生成对应 Delegate。

- [ ] **Step 8: 提交（需用户授权）**

```bash
git add apps/server/prisma apps/server/src/database apps/server/src/app.module.ts apps/server/test/health.e2e-spec.ts
git commit -m "feat(server): add prisma schema, service and module"
```

---

### Task 6: 首个 Migration 落库与数据库健康检查（阻塞点）

**前置条件（阻塞）：** 需要用户提供 `DATABASE_URL` / `DIRECT_URL`（Supabase 或本地 PostgreSQL）。未提供时本任务停在 Step 1，不得伪造连接串继续。

**Files:**
- Create: `apps/server/prisma/migrations/**`（由 CLI 生成）
- Create: `apps/server/.env`（本地私有，不入库）
- Modify: `apps/server/src/modules/health/health.controller.ts`
- Create: `apps/server/src/modules/health/health.service.ts`
- Create: `apps/server/src/modules/health/health.service.spec.ts`
- Modify: `apps/server/src/modules/health/health.module.ts`

**Interfaces:**
- Consumes: `PrismaService`
- Produces: `GET /api/health/db` → `{ status: 'ok', database: 'up' }`，数据库不可达时返回 503 且 `code = DATABASE_UNAVAILABLE`；`HealthService.checkDatabase()`。

- [ ] **Step 1: 确认凭据并写 `.env`**

向用户索取连接串后，在 `apps/server/.env` 写入（示例结构）：

```env
NODE_ENV=development
PORT=3000
WEB_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>
DIRECT_URL=postgresql://<user>:<password>@<host>:5432/<db>
```

Run: `pnpm db:status`
Expected: 提示未应用任何 migration（首次），且连接成功（不是认证/网络错误）。

- [ ] **Step 2: 生成并应用首个 migration**

Run:

```bash
pnpm --filter @hobilog/server exec prisma migrate dev --name init
pnpm --filter @hobilog/server exec prisma generate
pnpm db:status
```

Expected: `migrations/2026xxxx_init/migration.sql` 生成；`Database schema is up to date!`。

- [ ] **Step 3: 写失败测试 `apps/server/src/modules/health/health.service.spec.ts`**

```ts
import { HealthService } from './health.service'

describe('HealthService', () => {
  it('数据库可用时返回 up', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const service = new HealthService(prisma as never)
    await expect(service.checkDatabase()).resolves.toEqual({ status: 'ok', database: 'up' })
  })

  it('数据库不可用时抛 DATABASE_UNAVAILABLE', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('connect refused')) }
    const service = new HealthService(prisma as never)
    await expect(service.checkDatabase()).rejects.toMatchObject({ status: 503 })
  })
})
```

- [ ] **Step 4: 运行确认失败**

Run: `pnpm --filter @hobilog/server test`
Expected: FAIL，报 `Cannot find module './health.service'`。

- [ ] **Step 5: 实现 `HealthService` 并接入 Controller**

`src/common/exceptions/business.exception.ts`（本任务先建，Task 7 复用）：

```ts
import { HttpException, HttpStatus } from '@nestjs/common'

export interface ErrorBody {
  statusCode: number
  code: string
  message: string
}

export class BusinessException extends HttpException {
  constructor(statusCode: HttpStatus, code: string, message: string) {
    super({ statusCode, code, message } satisfies ErrorBody, statusCode)
  }
}
```

`src/modules/health/health.service.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/exceptions/business.exception'

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkDatabase(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, 'DATABASE_UNAVAILABLE', '数据库不可用')
    }
    return { status: 'ok', database: 'up' }
  }
}
```

`src/modules/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { HealthService } from './health.service'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '存活探针' })
  @ApiOkResponse({ schema: { example: { status: 'ok', uptime: 1.23 } } })
  check(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() }
  }

  @Get('db')
  @ApiOperation({ summary: '数据库连通性探针' })
  @ApiOkResponse({ schema: { example: { status: 'ok', database: 'up' } } })
  checkDatabase(): Promise<{ status: string; database: string }> {
    return this.healthService.checkDatabase()
  }
}
```

`src/modules/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

@Module({ controllers: [HealthController], providers: [HealthService] })
export class HealthModule {}
```

- [ ] **Step 6: 起服务实测连库**

Run:

```bash
pnpm dev:server
```

另开终端：

```bash
curl -s http://localhost:3000/api/health/db
```

Expected: `{"status":"ok","database":"up"}`。随后停止 dev 服务，并把 `apps/server/test/health.e2e-spec.ts` 的 `overrideProvider` 去掉 `$queryRaw` 缺失问题：为 mock 增加 `$queryRaw: async () => [{ '?column?': 1 }]`，并追加一条 e2e：

```ts
it('GET /api/health/db 返回 up', async () => {
  const res = await request(app.getHttpServer()).get('/api/health/db')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ status: 'ok', database: 'up' })
})
```

- [ ] **Step 7: 运行全部测试确认通过**

Run:

```bash
pnpm --filter @hobilog/server test
pnpm --filter @hobilog/server test:e2e
pnpm db:status
```

Expected: 单测 8 passed 左右；e2e 2 passed；`Database schema is up to date!`。

- [ ] **Step 8: 提交（需用户授权）**

```bash
git add apps/server/prisma/migrations apps/server/src/modules/health apps/server/src/common apps/server/test/health.e2e-spec.ts
git commit -m "feat(server): apply init migration and add database health probe"
```

---

### Task 7: 统一错误体、分页 DTO 与全局 ValidationPipe

**Files:**
- Create: `apps/server/src/common/filters/exception.mapper.ts`
- Create: `apps/server/src/common/filters/exception.mapper.spec.ts`
- Create: `apps/server/src/common/filters/all-exceptions.filter.ts`
- Create: `apps/server/src/common/pipes/create-validation-pipe.ts`
- Create: `apps/server/src/common/dto/pagination-query.dto.ts`
- Create: `apps/server/src/common/types/paginated.ts`
- Create: `apps/server/test/validation.e2e-spec.ts`
- Modify: `apps/server/src/main.ts`

**Interfaces:**
- Consumes: `BusinessException`（Task 6 已建）、`@hobilog/shared` 的 `ApiErrorBody`/`Paginated`/`DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`
- Produces:
  - `mapException(exception: unknown): ErrorBody`
  - `AllExceptionsFilter`（全局，输出 `{ statusCode, code, message }`）
  - `createValidationPipe(): ValidationPipe`（`whitelist` + `forbidNonWhitelisted` + `transform`，失败 `code = VALIDATION_FAILED`）
  - `PaginationQueryDto { page = 1, pageSize = 20 }`
  - `toPaginated<T>(items, total, page, pageSize): Paginated<T>`

- [ ] **Step 1: 写失败测试 `apps/server/src/common/filters/exception.mapper.spec.ts`**

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { mapException } from './exception.mapper'

describe('mapException', () => {
  it('P2002 → 409 CONFLICT', () => {
    const error = new Prisma.PrismaClientKnownRequestError('unique failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
    })
    expect(mapException(error)).toEqual({ statusCode: 409, code: 'CONFLICT', message: '数据已存在' })
  })

  it('P2025 → 404 NOT_FOUND', () => {
    const error = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: '5.22.0',
    })
    expect(mapException(error)).toEqual({ statusCode: 404, code: 'NOT_FOUND', message: '记录不存在' })
  })

  it('P2003 → 400 FOREIGN_KEY_VIOLATION', () => {
    const error = new Prisma.PrismaClientKnownRequestError('fk failed', {
      code: 'P2003',
      clientVersion: '5.22.0',
    })
    expect(mapException(error)).toEqual({
      statusCode: 400,
      code: 'FOREIGN_KEY_VIOLATION',
      message: '关联数据不合法',
    })
  })

  it('未知 Prisma 错误 → 400', () => {
    const error = new Prisma.PrismaClientKnownRequestError('weird', {
      code: 'P1001',
      clientVersion: '5.22.0',
    })
    expect(mapException(error).statusCode).toBe(400)
    expect(mapException(error).code).toBe('PRISMA_P1001')
  })

  it('带 code 的 HttpException 原样保留', () => {
    expect(mapException(new BadRequestException({ statusCode: 400, code: 'INVALID_PAYMENT', message: '付款节点不合法' }))).toEqual({
      statusCode: 400,
      code: 'INVALID_PAYMENT',
      message: '付款节点不合法',
    })
  })

  it('无 code 的 HttpException 回退为状态枚举名', () => {
    expect(mapException(new NotFoundException('订单不存在'))).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: '订单不存在',
    })
  })

  it('普通 Error → 500 INTERNAL_ERROR', () => {
    expect(mapException(new Error('boom'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @hobilog/server test`
Expected: FAIL，报 `Cannot find module './exception.mapper'`。

- [ ] **Step 3: 实现 `exception.mapper.ts` 与 `all-exceptions.filter.ts`**

`src/common/filters/exception.mapper.ts`:

```ts
import { HttpException, HttpStatus } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { ErrorBody } from '../exceptions/business.exception'

const PRISMA_CODE_MAP: Record<string, ErrorBody> = {
  P2002: { statusCode: 409, code: 'CONFLICT', message: '数据已存在' },
  P2025: { statusCode: 404, code: 'NOT_FOUND', message: '记录不存在' },
  P2003: { statusCode: 400, code: 'FOREIGN_KEY_VIOLATION', message: '关联数据不合法' },
}

function toErrorBody(statusCode: number, code: string, message: string): ErrorBody {
  return { statusCode, code, message }
}

export function mapException(exception: unknown): ErrorBody {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      PRISMA_CODE_MAP[exception.code] ??
      toErrorBody(400, `PRISMA_${exception.code}`, '数据库请求失败')
    )
  }

  if (exception instanceof HttpException) {
    const payload: unknown = exception.getResponse()
    if (typeof payload === 'object' && payload !== null && 'code' in payload) {
      return payload as ErrorBody
    }
    return toErrorBody(
      exception.getStatus(),
      HttpStatus[exception.getStatus()] ?? 'ERROR',
      typeof payload === 'string' ? payload : exception.message,
    )
  }

  return toErrorBody(500, 'INTERNAL_ERROR', '服务器内部错误')
}
```

`src/common/filters/all-exceptions.filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common'
import type { Response } from 'express'
import { mapException } from './exception.mapper'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const body = mapException(exception)

    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception))
    }

    response.status(body.statusCode).json(body)
  }
}
```

- [ ] **Step 4: 实现分页 DTO 与 ValidationPipe 工厂**

`src/common/dto/pagination-query.dto.ts`:

```ts
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@hobilog/shared'

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE
}
```

`src/common/types/paginated.ts`:

```ts
import type { Paginated } from '@hobilog/shared'

export function toPaginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize }
}
```

`src/common/pipes/create-validation-pipe.ts`:

```ts
import { HttpStatus, ValidationPipe } from '@nestjs/common'
import type { ValidationError } from 'class-validator'
import { BusinessException } from '../exceptions/business.exception'

function firstMessage(errors: ValidationError[]): string {
  for (const error of errors) {
    if (error.constraints) {
      const messages = Object.values(error.constraints)
      if (messages.length > 0) {
        return messages[0] ?? '参数不合法'
      }
    }
    if (error.children && error.children.length > 0) {
      return firstMessage(error.children)
    }
  }
  return '参数不合法'
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new BusinessException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', firstMessage(errors)),
  })
}
```

- [ ] **Step 5: 写 e2e 测试 `apps/server/test/validation.e2e-spec.ts`**

```ts
import { Controller, Get, INestApplication, Query } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { PaginationQueryDto } from '../src/common/dto/pagination-query.dto'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { createValidationPipe } from '../src/common/pipes/create-validation-pipe'

@Controller('probe')
class ProbeController {
  @Get()
  probe(@Query() query: PaginationQueryDto): PaginationQueryDto {
    return query
  }
}

describe('ValidationPipe + PaginationQueryDto (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(createValidationPipe())
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('无参数时返回默认分页值', async () => {
    const res = await request(app.getHttpServer()).get('/probe')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ page: 1, pageSize: 20 })
  })

  it('page=0 返回 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer()).get('/probe?page=0')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: expect.any(String),
    })
  })

  it('pageSize 超过上限返回 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer()).get('/probe?pageSize=500')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
  })

  it('未声明参数返回 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer()).get('/probe?unknown=1')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
  })
})
```

- [ ] **Step 6: 在 `main.ts` 挂载全局管道与过滤器**

`src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { createValidationPipe } from './common/pipes/create-validation-pipe'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true })
  app.useGlobalPipes(createValidationPipe())
  app.useGlobalFilters(new AllExceptionsFilter())

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HobiLog API')
    .setVersion('0.1')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(Number(process.env.PORT ?? 3000))
}

void bootstrap()
```

- [ ] **Step 7: 运行全部测试与类型检查**

Run:

```bash
pnpm --filter @hobilog/server test
pnpm --filter @hobilog/server test:e2e
pnpm --filter @hobilog/server typecheck
```

Expected: 单测 15 passed 左右；e2e 6 passed；typecheck 无错误。

- [ ] **Step 8: 提交（需用户授权）**

```bash
git add apps/server/src/common apps/server/src/main.ts apps/server/test/validation.e2e-spec.ts
git commit -m "feat(server): add unified error body, pagination and global validation pipe"
```

---

### Task 8: P1 里程碑验收

**Files:**
- Modify: `docs/05-HobiLog-V0.1-TypeScript类型与REST-API层.md`（仅在接口形状与文档有出入时更新对应小节）

**Interfaces:**
- Consumes: P1 全部产物
- Produces: 可交付的 P1 里程碑基线（构建 / 测试 / 迁移 / Swagger / 健康检查全通）

- [ ] **Step 1: 全仓构建、测试、类型检查**

Run:

```bash
pnpm install
pnpm -r build
pnpm -r test
pnpm -r typecheck
pnpm --filter @hobilog/server test:e2e
```

Expected: 全部成功，无 TS 错误，无失败用例。

- [ ] **Step 2: 迁移状态与 Schema 一致性**

Run:

```bash
pnpm db:status
pnpm --filter @hobilog/server exec prisma validate
pnpm --filter @hobilog/server exec prisma generate
```

Expected: `Database schema is up to date!`；schema 有效；client 可生成（且 generate 后 `git status` 无 `dist`/`node_modules` 意外入库）。

- [ ] **Step 3: 冒烟：Swagger 与健康检查**

Run:

```bash
pnpm dev:server
```

另开终端：

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/docs
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/health/db
curl -s -i http://localhost:3000/api/nope | head -1
```

Expected: `/api/docs` 返回 200；`/api/health` 返回 `{"status":"ok",...}`；`/api/health/db` 返回 `{"status":"ok","database":"up"}`；`/api/nope` 返回 `404` 且响应体为 `{"statusCode":404,"code":"NOT_FOUND","message":...}`。随后停止 dev 服务。

- [ ] **Step 4: 记录待提交清单并汇报**

列出所有未提交文件（若用户此前未授权提交），并向用户汇报：

```text
P1 完成：monorepo / shared 枚举包 / NestJS 骨架 / Prisma schema + init migration /
统一错误体与分页 / Swagger / 健康检查
验证命令：pnpm -r build && pnpm -r test && pnpm db:status
下一步：P2 鉴权与基础资料（Supabase AuthGuard + Product / Platform / Store）
阻塞：P2 需要 SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY
```

- [ ] **Step 5: 提交（需用户授权）**

```bash
git add -A
git commit -m "chore: complete P1 foundation milestone"
```
