# HobiLog V0.1 P2 验收记录（鉴权与基础资料）

> 日期：2026-09-18（Task 7 真实联调于 2026-09-20 执行）
> 计划：`docs/superpowers/plans/2026-09-18-hobilog-02-auth-and-catalog.md`
> 结论：**通过**（静态检查 + 真实 Supabase 用户越权隔离验证全绿）

## 1. 静态检查

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @hobilog/server test` | 14 files / **71 tests passed** |
| `pnpm --filter @hobilog/server test:e2e` | 3 files / **10 tests passed** |
| `pnpm --filter @hobilog/server typecheck` | 无错误 |
| `pnpm --filter @hobilog/server build` | `nest build` 成功 |
| `pnpm -r test` / `pnpm -r typecheck` | shared + server 全绿 |

## 2. 真实 Supabase 联调（Task 7）

测试用户：`a@hobilog.dev`（用户 A）、`b@hobilog.dev`（用户 B），由服务端 `SUPABASE_SECRET_KEY` 走 Supabase Admin API 创建（`email_confirm: true`）。
取 token：`POST <SUPABASE_URL>/auth/v1/token?grant_type=password`（`apikey: <SUPABASE_PUBLISHABLE_KEY>`）。
后端起在 `apps/server`（`node dist/main.js`，`.env` 生效），脚本每次先清理 A/B 的业务数据再断言。

| # | 检查项 | 期望 | 实际 |
| --- | --- | --- | --- |
| 1 | 未带 token 请求 `/api/products` | 401 | `{"statusCode":401,"code":"UNAUTHORIZED","message":"缺少访问令牌"}` |
| 2 | A `POST /api/platforms/presets` | `{"created":8}` | `{"created":8}` |
| 3 | A 再次调用 presets（幂等） | `{"created":0}` | `{"created":0}` |
| 4 | A `GET /api/platforms` | 8 条 | `total=8` |
| 5 | B `GET /api/platforms` | 空（隔离） | `total=0` |
| 6 | A `POST /api/products`（`officialPrice:1299` + 2 个标签） | 201，`officialPrice=1299`，`tagIds` 2 个 | 一致 |
| 7 | B `GET /api/products/<A的商品>` | 404 `PRODUCT_NOT_FOUND` | `{"statusCode":404,"code":"PRODUCT_NOT_FOUND","message":"商品不存在"}` |
| 8 | B `PATCH /api/products/<A的商品>` | 404 | 404 `PRODUCT_NOT_FOUND` |
| 9 | B `GET /api/products` | 空 | `total=0` |
| 10 | B 用 A 的平台建店 `POST /api/stores` | 404 `PLATFORM_NOT_FOUND` | `{"statusCode":404,"code":"PLATFORM_NOT_FOUND","message":"平台不存在"}` |
| 11 | B 不带平台建店 | 201，`platformName=null` | 一致 |
| 12 | A 关联「淘宝」建店 | 201，`platformName=淘宝` | 一致 |
| 13 | B `GET /api/stores` | 1 条（只有自己的） | `total=1` |
| 14 | B `DELETE /api/stores/<A的店>` | 404 `STORE_NOT_FOUND` | `{"statusCode":404,"code":"STORE_NOT_FOUND","message":"店铺不存在"}` |
| 15 | A `GET /api/platforms` 中「淘宝」的 `storeCount` | 1 | `1` |
| 16 | A 重复创建同名平台 | 409 | `{"statusCode":409,"code":"CONFLICT","message":"数据已存在"}` |
| 17 | A `POST /api/products/:id/archive` | `status=ARCHIVED` | 一致 |
| 18 | 归档后 A `GET /api/products` | 不含归档商品（`total=0`） | `total=0` |
| 19 | A `GET /api/products?status=ARCHIVED` | `total=1` | `total=1` |
| 20 | A `POST /api/products`（`name:""`） | 400 `VALIDATION_FAILED` | `{"statusCode":400,"code":"VALIDATION_FAILED","message":"name should not be empty"}` |

**结果：20/20 通过。**

验证脚本（临时文件，不纳入仓库）：`/var/folders/.../T/opencode/hobilog-p2-task7.mjs`

## 3. 执行中修正的问题

| 问题 | 修正 |
| --- | --- |
| `product.mapper.ts` 导入生成客户端深度写成 `../../` | 改为 `../../../generated/prisma/client` |
| `product.service.spec.ts` 用 `toMatchObject({ code })` 断言错误码（`code` 不在异常顶层） | 改为 `toMatchObject({ status, response: { statusCode, code, message } })`；P3/P4 计划里同类断言已批量修正 |
| 计划 Task 5/6 的 `assertOwned` 实现片段（400 `INVALID_*`）与同 Task spec（404）矛盾 | 统一为 404 `PLATFORM_NOT_FOUND` / `STORE_NOT_FOUND`（单资源「不存在或不属于当前用户」） |
| 新增 `name` 允许空字符串（`@IsString()` 不拦截 `""`） | 三个 DTO 的 `name` 补 `@IsNotEmpty()` |
| 计划把 `toPlatformVo` / `toStoreVo` 内联在 service | 拆到 `modules/<m>/mapper/<m>.mapper.ts` + spec，与 product 一致 |

## 4. 交付物

- 鉴权：`SupabaseAuthGuard`（全局 `APP_GUARD`）+ `@Public()` + `@CurrentUser()` + `UserProfileService.ensureProfile()`。
- 接口：`/api/products`（CRUD + archive + 标签）、`/api/platforms`（CRUD + `POST /presets`）、`/api/stores`（CRUD + 平台归属校验）。
- 文档：`docs/05-HobiLog-V0.1-TypeScript类型与REST-API层.md` 新增 §13 Platform API、§14 Store API，并补充 §12 Product API 的筛选与错误码说明。
- 下一步：P3 订单生命周期（Order / Payment / Release / Shipment + 状态机）。
