# HobiLog V0.1 P4 验收记录（统计与附件）

> 日期：2026-09-21
> 计划：`docs/superpowers/plans/2026-09-18-hobilog-04-statistics-and-attachment.md`
> 结论：**通过**（读侧接口 + 附件签名上传 + 站内提醒，全部经 HTTP API → Service → Prisma → PostgreSQL 实测）

## 1. 静态检查

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @hobilog/server test` | 28 files / **278 tests passed** |
| `pnpm --filter @hobilog/server test:e2e` | 5 files / **32 tests passed** |
| `pnpm --filter @hobilog/server typecheck` | 无错误 |
| `pnpm -r build` / `pnpm -r test` | shared 14 + server 278 全绿，构建通过 |

## 2. e2e 运行环境变更（重要）

**e2e 现在打本地 PostgreSQL，不再打远端 Supabase**（`apps/server/test/setup-env.ts`）：

- 默认 `DATABASE_URL = postgresql://postgres:postgres@localhost:5433/hobilog_test`，可用 `TEST_DATABASE_URL` 覆盖；`.env` 仍会加载，但 `DATABASE_URL` / `DIRECT_URL` 被强制指向测试库，避免误伤生产数据。
- 本地库用 Docker 起：`docker run -d --name hobilog-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hobilog_test -p 5433:5432 postgres:17-alpine`，并 `DATABASE_URL=…5433/hobilog_test pnpm --filter @hobilog/server exec prisma migrate deploy`。
- 效果：32 个 e2e 从「25s + 频繁连接中断」变成 **约 1s 全绿**。

### 为什么换（根因证据）

| 现象 | 证据 | 结论 |
| --- | --- | --- |
| e2e 频繁 `Error: Connection terminated unexpectedly`，而构建产物 `node dist/main.js` + `/api/health/db` 连续 3 次 200 | 失败栈停在 `PrismaPgAdapter.startTransaction` | 不是应用代码问题 |
| Supabase session pooler 会话堆积 | `pg_stat_activity` 查到 21 个会话，其中 3 个 `idle in transaction`，且有 7 个是我们崩溃测试进程遗留的（`DELETE FROM "public"."products" WHERE "userId" IN ($1,$2)`、`BEGIN`） | session pooler 有并发上限（此前已报 `EMAXCONNSESSION … pool_size: 15`），泄漏会话把槽位占满后新连接被掐断 |
| 清理会话后一度恢复，随后再复现 | 清理脚本本身也被 `Connection terminated unexpectedly` 打断（改走 6543 事务池才清成功） | 与开发机 VPN（9 个 `utun*` 接口、pooler 域名 ICMP 100% 丢包）叠加，链路不可靠 |

顺带加固：`PrismaService` 的 `PrismaPg` 增加 `idleTimeoutMillis: 10_000` / `connectionTimeoutMillis: 15_000`（快速失败，不再挂 60–80s）。

## 3. 读侧 e2e（`test/read-models.e2e-spec.ts`，12 个用例）

种子数据（用户 A）：CNY 订单（2 件、FULL 1000 PAID @2026-09-10、已签收）、JPY 订单（1 件、FULL 20000 PAID @2026-10-05）、CNY 定金尾款订单（DEPOSIT 300 PAID @2026-09-18 + BALANCE 500 PENDING dueAt 2026-11-20、含 DELAY）、**归档** CNY 订单（FULL 500 PAID @2026-09-15）。

| # | 用例 | 期望 | 实际 |
| --- | --- | --- | --- |
| 1 | dashboard | `pendingPaymentAmount = [{CNY,500}]`、`collectionCount = 2`、`todos` 为数组 | 一致 |
| 2 | monthly | 2026-09 CNY：`paidAmount=1300`、`orderAmount=1800`；2026-10 JPY：`paidAmount=20000` | 一致（实际消费按 `paidAt`，订单规模按 `totalAmount`；归档订单 500 被排除） |
| 3 | future payments | 返回数组 | 一致 |
| 4-7 | dimensions ×4（categories / platforms / manufacturers / ips） | 每行 `amount` 内币种唯一；CNY 合计 1300、JPY 合计 20000 | 一致（多币种不合并） |
| 8 | calendar | 2026-09 事件中不含归档订单，且有事件 | 一致 |
| 9 | collection list / stats | 列表 1 条、`totalItems=2`（件数）、`deliveredOrders=1`、`byCurrency=[{CNY,1000}]` | 一致（与 dashboard `collectionCount=2` 同口径） |
| 10 | notifications/todos | 返回非空数组 | 一致 |
| 11 | attachments/upload-url | 201，`path` 以 `${userId}/` 开头，`bucket=attachments` | 一致（Storage 调用被 mock，不真连） |
| 12 | 越权隔离 | B 的 `pendingPaymentAmount=[]`、`collectionCount=0`、收藏列表为空 | 一致 |

P3 全链路 e2e 同时复跑：`order-lifecycle.e2e-spec.ts` **10/10 通过**（535ms）。

## 4. 执行中修正的问题

| 问题 | 修正 |
| --- | --- |
| 收藏口径分裂：dashboard `collectionCount` 用 `COUNT(DISTINCT order_items.id)`（条目数），`/collection/stats.totalItems` 用 `SUM(quantity)`（件数） | 统一为件数（docs/07 §64「OrderItem quantity 求和」）：`countCollectionItems` 改 `COALESCE(SUM(oi.quantity),0)` |
| 收藏未排除取消订单（docs/02 §28 要求「Shipment=DELIVERED 且 Order 未取消」） | 两处 where 都加 `status <> 'CANCELLED'`（SQL）/ `status: { not: 'CANCELLED' }`（Prisma） |
| 计划维度统计 `itemCount` 被付款笔数放大 | 改为先用 CTE 聚合并款再 join `order_items`（真库实测 2 笔付款 + quantity 2 → 2） |
| 计划 SQL 用 snake_case 列名 | 改引号 camelCase（`o."userId"`、`pay."paidAt"`…） |
| Dashboard 单 `Promise.all` 13 路并发触发 `EMAXCONNSESSION` | 聚合查询与 `order.findMany` 串行 + 池上限 `max: 5` |
| 计划 `todoPriority` 两分支返回同一常量 | 按 `dueAt` 距今天数分档（逾期 0 / ≤1 天 1 / ≤3 天 2 / ≤7 天 3 / 其余 4） |
| 计划 dashboard `futurePayments` 把全部 PENDING 塞当月 | 按 `dueAt` 月份分桶，仅未来 12 个月 |
| 计划月度 `orderAmount` 用付款之和（含 PENDING） | 改用 `SUM(o."totalAmount")` 按 `orderedAt` 归月 |
| 维度接口默认区间不含未来月份 | e2e 显式传 `from/to`（不是实现缺陷，实现按默认近一年窗口） |

## 5. 交付物

- **Statistics**：`GET /api/statistics/{dashboard,payments/monthly,payments/future,categories,platforms,manufacturers,ips}`
- **Calendar**：`GET /api/calendar/events?from=&to=`（付款 / 出货 / 物流等日期事件聚合）
- **Collection**：`GET /api/collection`、`GET /api/collection/stats`
- **Attachment**：`POST /api/attachments/upload-url`、`POST /api/attachments`、`GET /api/attachments/:id/url?expiresIn=`、`DELETE /api/attachments/:id`
- **Notification**：`GET /api/notifications/todos`
- 文档：`docs/05` 追加 §23 Calendar API / §24 Collection API / §25 Notification API，§16 补 `GET /attachments/:id/url` 与 bucket 规则
- 下一步：P5 前端 Web（Vue3 页面与联调）
