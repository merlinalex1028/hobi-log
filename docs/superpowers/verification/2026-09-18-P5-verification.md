# HobiLog V0.1 P5 验收记录（Web 前端）

> 日期：2026-09-21
> 计划：`docs/superpowers/plans/2026-09-18-hobilog-05-web-app.md`
> 结论：**通过（自动化部分）**；浏览器端手工冒烟未执行（本机无 `apps/web/.env` 与浏览器自动化环境，见 §5）

## 1. 静态检查

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @hobilog/web test` | 42 files / **248 tests passed** |
| `pnpm --filter @hobilog/web typecheck` | `vue-tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json` 无错误 |
| `pnpm --filter @hobilog/web build` | `✓ built in 992ms`（仅 Element Plus 整包 chunk 体积告警） |
| `pnpm -r test` | shared 14 + server 278 + web 248 = **540 passed** |
| `pnpm -r typecheck` / `pnpm -r build` | 三个包全绿 |
| `pnpm --filter @hobilog/server test:e2e` | 5 files / **32 passed**（本地 Postgres，无回归） |

## 2. 架构约束核验

| 约束 | 核验方式 | 结果 |
| --- | --- | --- |
| 前端不做业务库访问 | `grep -rn "supabase\.from\|supabase\.rpc" apps/web/src` | 无命中 |
| 前端不出现 secret | `grep -rn "SECRET_KEY\|service_role" apps/web/src` | 无命中；`.env.example` 只有 3 个 `VITE_` 变量 |
| Token 只在 HTTP 层注入 | `grep -rn "Authorization" apps/web/src` | 仅 `src/api/http.ts:26`（+ 其 spec 断言） |
| 业务数据不进 Pinia | 审查 `src/stores/*` | 仅 `auth`（会话）与 `view-preference`（列表视图偏好） |
| 状态/金额/日期统一组件 | 审查页面模板 | 统一走 `AppStatusTag` / `AppCurrency` / `AppDate` |

## 3. 交付物（路由 → 页面 → 接口）

| 路由 | 页面 | 依赖接口 |
| --- | --- | --- |
| `/login` | 登录页（Supabase Auth） | `supabase.auth.*` |
| `/dashboard` | KPI + 待办 + 未来付款 | `GET /statistics/dashboard`、`GET /notifications/todos` |
| `/orders` | 订单列表（Tab/筛选/分页/表格与卡片视图/URL 同步） | `GET /orders` |
| `/orders/create`、`/orders/:id/edit` | 订单创建 / 编辑 | `POST /orders`、`GET /orders/:id`、`PATCH /orders/:id`、`GET /products`、`GET /platforms`、`GET /stores` |
| `/orders/:id` | 订单详情（summaries + timeline + 付款/出货/退款/取消等动作） | `GET /orders/:id`、`payments/*`、`release/*`、`shipments/*`、`attachments/*` |
| `/products`、`/products/:id` | 商品库列表 / 详情 | `GET/POST/PATCH /products`、`POST /products/:id/archive` |
| `/calendar` | 日历（fullcalendar 7：dayGrid / timeGrid / list + 中文 locale） | `GET /calendar/events` |
| `/statistics` | 维度排行 + 趋势（echarts） | `GET /statistics/{categories,platforms,manufacturers,ips,payments/monthly,payments/future}` |
| `/collection` | 收藏库 + stats | `GET /collection`、`GET /collection/stats` |
| `/platforms` | 平台与店铺管理（含预置平台） | `GET/POST/PATCH/DELETE /platforms`、`POST /platforms/presets`、`stores/*` |
| `/settings` | 设置（用户信息 / 币种等） | `GET /platforms`、`supabase.auth.*` |

## 4. 关键实现说明

- **技术栈（全部 latest）**：Vue 3.5.43 / Vite 8.3.0 / Vue Router 5.3.1 / Pinia 4.0.3 / Element Plus 2.14.6 / TanStack Query 5.103.1 / ECharts 6.1.0 / fullcalendar 7.1.0 / Zod 4.6.5 / TS 6.0.3 / Vitest 5.0.1。
- **fullcalendar 7**：视图插件改走子路径（`@fullcalendar/vue3/{daygrid,timegrid,list}`、`locales/zh-cn`、`themes/classic`、`skeleton.css`），不再使用 6.x 的 `@fullcalendar/daygrid` 等独立包。
- **HTTP 层**：`src/api/http.ts` 统一注入 `Authorization: Bearer <access_token>`（从 Supabase session 取），并把 `{statusCode,code,message}` 错误体转成 `ApiError`；无错误体归为 `NETWORK_ERROR`。
- **多币种**：dashboard KPI 与维度统计的金额都是**按币种数组** `[{currency, amount}]`，前端不做跨币种相加。
- **纯函数/状态派生**：付款汇总、订单表单 payload、时间线排序、出货数量校验、日期/金额格式化均有单测覆盖。

## 5. 未执行项（需在有凭据环境补充）

| 项 | 原因 | 建议步骤 |
| --- | --- | --- |
| 浏览器端手工冒烟（登录 → 建单 → 标记付款 → 出货 → 签收 → 收藏） | 本机没有 `apps/web/.env`，也没有浏览器自动化环境（未安装 Playwright） | 1) 复制 `apps/web/.env.example` 为 `.env` 并填 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_API_BASE_URL=http://localhost:3000/api`；2) `pnpm dev:server`；3) `pnpm dev:web`；4) 用 `a@hobilog.dev` 登录后按核心链路走一遍 |
| 附件真实直传（signed URL → Supabase Storage） | 单测只 mock 了 `SupabaseService.admin`，未连真实 Storage | 确认 `product-images` / `attachments` 两个 bucket 已创建且为私有 |

## 6. 已知限制

- 订单列表的行内快捷操作（标记付款 / 更新出货 / 添加物流）改为跳转详情页执行：列表接口不返回付款节点与物流明细，子组件也不允许自行拉详情。
- 订单归档 / 复制 / 删除，付款节点与物流的删除，`OrderQuickTabs` 的按 Tab 计数：后端暂无对应接口，前端不提供入口。
- Element Plus 整包引入导致主 chunk 约 1.2 MB（仅构建告警，未做按需拆分）。
