# HobiLog 工程约定

## 包结构
- `apps/server` NestJS API（业务权威入口）
- `apps/web` Vue3 Web（只调 NestJS API）
- `packages/shared` 前后端共享枚举 / 常量 / API 类型（CommonJS 产物）
- `apps/server/prisma` Schema 与 Migration
- `apps/server/src/generated/prisma` Prisma 7 生成的 Client（已 gitignore，`prisma generate` 产出）

## 命令
- 安装：`pnpm install`
- 构建：`pnpm -r build`（拓扑序：shared → server）
- 单测：`pnpm -r test`（server 侧只跑 `src`，不依赖数据库）
- e2e：`pnpm --filter @hobilog/server test:e2e`（跑 `test/`；`test/setup-env.ts` 会把 `DATABASE_URL`/`DIRECT_URL` 强制指向**本地测试库**（默认 `postgresql://postgres:postgres@localhost:5433/hobilog_test`，可用 `TEST_DATABASE_URL` 覆盖），不会碰远端 Supabase。本地库用 `docker run -d --name hobilog-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hobilog_test -p 5433:5432 postgres:17-alpine` 起，再用 `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/hobilog_test pnpm --filter @hobilog/server exec prisma migrate deploy` 建表）
- 类型检查：`pnpm -r typecheck`
- 生成 Prisma Client：`pnpm db:generate`（改了 `prisma/schema.prisma` 后必跑）
- 迁移：`pnpm --filter @hobilog/server exec prisma migrate dev --name <name>`
- 迁移状态：`pnpm db:status`
- 开发服务端：`pnpm dev:server`（会先构建 shared）

## 工具链（已实测，勿随意升级）
- Node >= 22.12.0，pnpm 12.4.2（`pnpm-workspace.yaml` 的 `allowBuilds` 放行 prisma / @prisma/engines / @swc/core / @parcel/watcher / unrs-resolver）
- TypeScript 6.0.3（**不要用 TS 7**，2026-09-20 实测：TS 7 只发原生 `tsc` 可执行文件、不导出编程式 compiler API，`nest build` 直接报错「The installed TypeScript version (7.0.2) does not expose the programmatic compiler API that the Nest CLI requires... expected to return in 7.1」。`tsc --noEmit` 与 Vitest 用 TS 7 都能跑通，但会与 `nest build` 的编译器版本分裂。等 Nest CLI 放宽 `~6.0.2` 且 TS 7.1 恢复 API 后再一起升级）
- NestJS 12.0.3（**全系 ESM-only**，内置 Express 5 → `@types/express` 5.x）
- 测试：**Vitest 5 + unplugin-swc**（Jest 无法加载 ESM-only 的 Nest 12；swc 提供 `emitDecoratorMetadata`）
- Prisma 7.10.0 + `@prisma/adapter-pg`（Prisma 7 的 client 需要 driver adapter）
- Vue 3.5 + Vite 8 + Vue Router 5 + Pinia 4 + Vitest 5

## TypeScript 6 注意点
- `baseUrl` 已废弃：不要用，`paths` 直接写相对路径。
- 不再自动加载 `@types/*`：`apps/server/tsconfig.json` 显式 `types: ["node", "vitest/globals"]`。
- `tsconfig.build.json` 必须显式 `rootDir: "src"`（否则 TS5011）。
- 不要用 `paths` 指向 `packages/shared/src`（会触发 rootDir 报错）：跨包类型走 workspace 产物（`pnpm -r` 拓扑序保证先构建 shared）。

## Prisma 7 约定
- Schema 的 `datasource` **不再有 `url`**；连接串在 `apps/server/prisma7.config.ts` 的 `datasource.url`（取 `DIRECT_URL ?? DATABASE_URL`）。
- `generator client { provider = "prisma-client", output = "../src/generated/prisma" }`。
- 代码里从生成目录导入：`import { Prisma, PrismaClient } from '<相对深度>/generated/prisma/client'`（**不再从 `@prisma/client` 导入**）。相对深度：`src/modules/<m>/*.ts` → `'../../generated/prisma/client'`；`src/modules/<m>/<sub>/*.ts` → `'../../../generated/prisma/client'`。
- 运行期实例化统一走 `PrismaService`（内部 `new PrismaPg({ connectionString: DATABASE_URL })`）。
- CLI 配置用 `dotenv` 读 `apps/server/.env`（由 `pnpm --filter` 的工作目录决定）。

## 硬性约定
- 业务数据只走 `Vue → NestJS API → Prisma → PostgreSQL`；Web 禁用 `supabase.from(...)` / `supabase.rpc(...)`。
- `userId` 只能来自验证过的 Supabase Token；Controller 里禁止出现 Prisma 调用。
- 错误体 `{ statusCode, code, message }`；分页 `{ items, total, page, pageSize }`。
- 金额 API 出口为 `number`；`OrderStatus` 只有 4 个值，归档用 `archived`。
- 新增接口或改接口后，先跑 `pnpm -r typecheck` 与 `pnpm -r test`，再更新 `docs/05` 对应条目。

## 环境变量（`apps/server/.env`）
- `DATABASE_URL` / `DIRECT_URL`：Supabase PostgreSQL。**本机直连域名不可达（IPv6-only），两者都用 Session pooler 串**（`aws-0-<region>.pooler.supabase.com:5432`）。
- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`：Supabase 新版 key 体系（P2 起必填）。
- `SUPABASE_SECRET_KEY` 只允许出现在 `apps/server`，禁止进入任何 `VITE_` 变量。
