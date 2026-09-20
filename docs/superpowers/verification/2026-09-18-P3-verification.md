# HobiLog V0.1 P3 验收记录（订单生命周期）

> 日期：2026-09-20
> 计划：`docs/superpowers/plans/2026-09-18-hobilog-03-order-lifecycle.md`
> 结论：**通过**（领域纯函数 + Order/Payment/Release/Shipment 四模块 + 真实 PostgreSQL 全链路 e2e 全绿）

## 1. 静态检查

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @hobilog/server test` | 23 files / **217 tests passed** |
| `pnpm --filter @hobilog/server test:e2e` | 4 files / **20 tests passed**（含 10 个全链路场景，真实 Supabase PostgreSQL） |
| `pnpm --filter @hobilog/server typecheck` | 无错误 |
| `pnpm --filter @hobilog/server build` | `nest build` 成功 |
| `pnpm -r test` / `pnpm -r typecheck` / `pnpm -r build` | shared(14) + server(217) 全绿 |

## 2. 领域纯函数（无 IO，`today` 由调用方注入）

| 文件 | 覆盖 |
| --- | --- |
| `domain/types.ts` | `PaymentLike` / `ReleaseEventLike` / `ShipmentLike` / `OrderDomain` |
| `domain/payment-summary.ts` | `isOverdue` / 已支付 / 退款 / 净支出 / 待付款 / 进度 / `getPaymentSummaryStatus` / `getNextPayment`(+逾期天数) / `getNextPaymentLabel` |
| `domain/release.ts` | `getReleaseStatus`（进度序优先于时间序）/ `isReleased` / `getPlannedReleaseDate` / `getDelayMonths` / `getDelayHistory` |
| `domain/shipment.ts` | `getShipmentSummaryStatus`（EXCEPTION > IN_TRANSIT > …）/ `hasShippedShipment` / `countInTransit` / `isOrderCompleted` |
| `domain/display-status.ts` | `getDisplayStatus` / `Label` / `Hint`，分支顺序 `CANCELLED → REFUNDED → PAYMENT_OVERDUE → WAITING_PAYMENT → SHIPMENT_EXCEPTION → IN_TRANSIT → WAITING_SHIPMENT → COMPLETED → WAITING_RELEASE → ACTIVE` |

单测数：payment-summary 30、release 18、shipment 15、display-status 26。

## 3. 全链路验收（`test/order-lifecycle.e2e-spec.ts`，真实 PostgreSQL，只替换身份来源）

前置：`SupabaseService` 被替换为假实现（`token-a` → 固定 UUID A，`token-b` → 固定 UUID B），其余全部走真实 `AppModule → Service → Prisma → PostgreSQL`；管道与前缀与 `main.ts` 一致（`setGlobalPrefix('api')` + `createValidationPipe()` + `AllExceptionsFilter`）。

| # | 场景 | 期望 | 实际 |
| --- | --- | --- | --- |
| 1 | B 全款预售 FULL PAID + EXPECTED_RELEASE | 201，`displayStatus=WAITING_RELEASE` | 一致 |
| 2 | D 尾款 dueAt 已过 | `displayStatus=PAYMENT_OVERDUE`，`paymentSummary.status=OVERDUE` | 一致（无 `OVERDUE` 落库，纯派生） |
| 3 | C 定金+尾款待付 → 标记付款 | 先 `WAITING_PAYMENT`；`POST /payments/:id/paid` 后 `WAITING_RELEASE`，`paidAmount=1299` | 一致 |
| 4 | E 延期 | `DELAY` 事件保留 `oldDate=2027-05-01` → `newDate=2027-07-01`，`delayMonths=2` | 一致 |
| 5 | F+G+J 厂商出货 → 建物流 → 签收 | `WAITING_SHIPMENT` → `IN_TRANSIT` → `COMPLETED`（`status=COMPLETED`） | 一致 |
| 6 | H 物流异常 | `PATCH /shipments/:id {status:'EXCEPTION'}` → `SHIPMENT_EXCEPTION`（优先于运输中） | 一致 |
| 7 | I 多包裹 + 超量拆单 | 两个包裹在途 → `IN_TRANSIT`、`inTransitCount=2`；再拆第 3 件 → 400 `SHIPMENT_QUANTITY_EXCEEDED`；签收 A → 仍 `IN_TRANSIT`（`inTransitCount=1`，对应 docs/07 §16）；签收 B → `COMPLETED` | 一致 |
| 8 | 金额待定补邮（`amount=null`） | `WAITING_PAYMENT`、`displayStatusHint='暂无截止日期'`、`pendingAmount=0`、`nextPayment.type=SHIPPING` | 一致 |
| 9 | 取消 + 退款 | `status=CANCELLED`、`displayStatus=CANCELLED`，未付节点 `BALANCE:CANCELLED`，产生 `REFUND:PAID`，`netPaidAmount=0` | 一致 |
| 10 | 越权隔离 | B 读 A 订单 → 404 `ORDER_NOT_FOUND`；B 列表 `items` 为空 | 一致 |

**结果：10/10 通过（耗时约 25s，远端库往返）。** 测试数据自清理（只碰两个假 UUID）。

## 4. 执行中修正的问题

| 问题 | 修正 |
| --- | --- |
| e2e 进程没有加载 `apps/server/.env`，`test/setup-env.ts` 用 `??=` 兜底成 `localhost:5432/hobilog_test` → 全链路 e2e 连不上库 | `setup-env.ts` 先用 `dotenv` 加载 `.env`（按 `process.cwd()` 探测），再保留 `??=` 兜底；这样 e2e 会打到真实库，单测无影响 |
| 计划 Task 8 的身份 mock 抛 `Object.assign(new Error, {status:401})` | 改为 `BusinessException(401,'UNAUTHORIZED',…)`（裸 `Error` 会被映射成 500，P2 已踩过） |
| 计划 Task 8 的 app 未装 `createValidationPipe()` | 补上，使 e2e 与 `main.ts` 行为一致（含 `whitelist + forbidNonWhitelisted`） |
| 计划场景 I 先签收一个包裹再建第二个包裹 | 与 `docs/07 §25` 冲突（完成条件 = 无待付款 + ≥1 物流 + 全部 DELIVERED，故第一个包裹签收即 `COMPLETED`，后续 `POST /shipments` 会 400 `ORDER_NOT_ACTIVE`）。改为「先建两个包裹 → 验证在途汇总与超量校验 → 再依次签收」，仍覆盖多包裹语义且不与 §25 冲突 |
| 远端库往返导致单测 5s 超时 | 该 e2e 文件 `vi.setConfig({ testTimeout: 30_000 })` |
| `setup-env.ts` 用 `import.meta.url` | TS 以 CommonJS 输出 → TS1470；改为 `process.cwd()` 探测 + `existsSync` |

## 5. 已知限制（待决策，非阻塞）

- 按 `docs/07 §25`，只要「所有 Shipment 都 DELIVERED」即自动 `COMPLETED`，**不校验发货数量是否覆盖全部订单数量**。因此「2 件商品只发 1 件并签收」会让订单提前完成，之后无法再补发。需要的话可在 `isOrderCompleted` 增加「订单项数量已被物流数量完全覆盖」判定（会偏离 §25 原文）。
- 退款接口不校验退款金额上限（`docs/07 §6` 只要求用正数 `REFUND` 节点记录），多次退款 `sortOrder` 固定为 950、补差价固定 900，可能出现并列值。
- `PaymentSummaryStatus` / `delayed` 等筛选参数已进 DTO 与 VO，但列表过滤目前只用 `tab` / `keyword` / `status` / 平台 / 店铺 / 年份 / 价格区间等，P3 计划范围内未做「按 paymentSummaryStatus 过滤」。

## 6. 交付物

- 领域层 5 个纯函数文件 + 4 个 spec（89 tests）。
- 接口：`/api/orders`（列表 Tab/筛选/分页、创建事务、详情聚合 timeline、编辑、取消）、`/api/orders/:id/payments`、`/api/payments/:id`、`/api/payments/:id/paid`、`/api/payments/:id/refund`、`/api/orders/:id/release/{delay,released,store-arrived,balance-open}`、`/api/orders/:id/shipments`、`/api/shipments/:id`、`/api/shipments/:id/delivered`。
- 全链路 e2e：`apps/server/test/order-lifecycle.e2e-spec.ts`。
- 下一步：P4 统计与附件（Statistics / Calendar / Collection / Attachment / Notification）。
