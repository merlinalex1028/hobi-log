# HobiLog

个人手办 / GK / 周边收藏管理：记录订单、付款、出货、物流与收藏库。

```text
Vue3 Web  →  REST API  →  NestJS  →  Prisma  →  Supabase PostgreSQL
```

- `apps/server`：NestJS API（业务权威入口，唯一写库方）
- `apps/web`：Vue3 Web（只调 NestJS API；Supabase SDK 仅用于 Auth 与 Storage 签名直传）
- `packages/shared`：前后端共享枚举 / 常量 / API 类型

## 本地启动

### 1. 安装依赖

```bash
pnpm install          # 需要 Node >= 22.12.0、pnpm 12.4.2
```

### 2. 配置环境变量

```bash
cp apps/server/.env.example apps/server/.env   # 填 DATABASE_URL / DIRECT_URL / SUPABASE_*
cp apps/web/.env.example apps/web/.env         # 填 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
```

- `apps/server/.env` 需要 `DATABASE_URL`（Supabase Transaction pooler，6543）/ `DIRECT_URL`（Session pooler，5432）、`SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`。
- `apps/web/.env` 只允许 `VITE_API_BASE_URL` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`，**禁止任何 secret**。
- 建表：`pnpm db:migrate`（或对已有库跑 `pnpm --filter @hobilog/server exec prisma migrate deploy`）。

### 3. 启动开发服务

```bash
pnpm dev                         # 一条命令同时起 server + web，日志带 [server] / [web] 前缀，Ctrl+C 全部停止
pnpm dev:server                  # 仅 NestJS，默认 http://localhost:3000/api
pnpm dev:web                     # 仅 Vue3，默认 http://localhost:5173
```

浏览器打开 `http://localhost:5173`，用 Supabase 账号登录后进入首页。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 同时启动 server + web（`scripts/dev.mjs`），Ctrl+C 一起停 |
| `pnpm -r build` | 拓扑序构建（shared → server → web） |
| `pnpm -r test` | 全量单测（shared / server `src` / web） |
| `pnpm -r typecheck` | 全量类型检查 |
| `pnpm --filter @hobilog/server test:e2e` | 后端 e2e（打本地测试库，见下） |
| `pnpm db:generate` | 改 `prisma/schema.prisma` 后重新生成 Client |
| `pnpm db:status` | 迁移状态 |
| `pnpm db:local:on` | 启动本地库容器，并把 `apps/server/.env` 切到本地测试库 |
| `pnpm db:local:off` | 恢复远端 Supabase 配置，并停止本地库容器 |

### 本地库与远端库切换

`apps/server/test/setup-env.ts` 会把 `DATABASE_URL` / `DIRECT_URL` 强制指向本地测试库（默认 `postgresql://postgres:postgres@localhost:5433/hobilog_test`，可用 `TEST_DATABASE_URL` 覆盖），不会碰远端 Supabase。日常联调也走本地库，先切换再跑：

```bash
pnpm db:local:on     # 启动 hobilog-pg 容器 + 切换 apps/server/.env 到本地测试库
pnpm --filter @hobilog/server exec prisma migrate deploy
pnpm --filter @hobilog/server test:e2e
pnpm db:local:off    # 从 apps/server/.env.remote 恢复远端配置 + 停止容器（保留容器与数据）
```

- 首次 `on` 会把当前远端配置快照到 `apps/server/.env.remote`（已被 `.gitignore` 忽略，不进仓库）；若 `.env` 已是本地配置而快照缺失，`on` 会拒绝执行，避免把本地值存成「远端快照」。
- 两个脚本均幂等，可重复执行；切换后正在运行的 API 需重启才会读取新的 `.env`。
- 可覆盖的变量：`HOBILOG_PG_CONTAINER` / `HOBILOG_PG_PORT` / `HOBILOG_PG_DATABASE` / `HOBILOG_PG_USER` / `HOBILOG_PG_PASSWORD` / `HOBILOG_PG_IMAGE` / `HOBILOG_PG_VOLUME`。

## 文档

见 `docs/README.md` 索引；验收记录在 `docs/superpowers/verification/`。
