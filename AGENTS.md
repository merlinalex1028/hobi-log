# 仓库指南

## 项目结构与模块组织

本仓库目前以设计文档为主。产品与架构说明位于 `docs/`，分阶段实施计划位于 `docs/superpowers/plans/`。修改业务行为前，先阅读 `docs/README.md` 及对应的编号文档。

规划中的 pnpm monorepo 结构如下：

- `apps/web/`：Vue 3 客户端；页面、组件、组合式函数、状态、资源和 API 适配器放在 `src/`。
- `apps/server/`：NestJS REST API；领域功能放在 `src/modules/`，通用基础设施放在 `src/common/`，Prisma Schema 与迁移放在 `prisma/`。
- `packages/shared/`：前后端共享的稳定枚举、常量和 API 类型。

始终保持 `Vue -> NestJS REST API -> Prisma -> PostgreSQL` 的依赖方向。Web 端不得通过 Supabase 直接增删改查业务表。

## 构建、测试与开发命令

应用工作区尚未完成初始化；根 `package.json` 落地后使用以下命令：

- `pnpm install`：安装工作区依赖，要求 Node >= 20.11、pnpm 9。
- `pnpm dev:server` / `pnpm dev:web`：以监听模式启动 API 或 Web。
- `pnpm -r build`：按依赖顺序构建所有包。
- `pnpm -r typecheck`：执行全仓库 TypeScript 检查。
- `pnpm -r test`：运行全部单元测试。
- `pnpm --filter @hobilog/server test:e2e`：运行服务端端到端测试。
- `pnpm db:status`：检查 Prisma 迁移状态。

## 编码风格与命名约定

TypeScript 使用两空格缩进、单引号和无分号风格。Vue 组件采用 PascalCase，如 `OrderFilterBar.vue`；路由页面使用 `pages/orders/detail.vue` 形式的小写路径。统一使用 `<script setup lang="ts">`，可复用逻辑移入 `composables/`。NestJS 文件使用 kebab-case 与职责后缀，如 `order.service.ts`、`create-order.dto.ts`。控制器保持轻量，业务规则放在 Service 中。

## 测试规范

`packages/shared` 与 Web 使用 Vitest，NestJS 使用 Jest 和 Supertest。单元测试与源码就近放置并命名为 `*.spec.ts`；API 测试放在 `apps/server/test/*.e2e-spec.ts`。业务规则变更必须添加回归测试。提交 PR 前运行构建、类型检查、单元测试及相关 e2e 测试。目前未规定覆盖率阈值。

## 提交与 Pull Request 规范

当前历史仅有 `chore: init`，实施计划统一采用 Conventional Commits，例如 `feat(server): add config validation`。提交应聚焦单一目的并使用祈使语气。PR 需说明行为变化、受影响的文档或 API 契约、关联 Issue 或计划、验证命令；UI 变更需附截图。不得提交 `.env`、凭据、数据库连接串、`dist/` 或 `coverage/`；配置变化时同步更新 `.env.example`。

## 代理协作要求

始终使用中文回复，包括进度更新、澄清问题和最终总结；命令、路径、代码标识及必要的技术术语保留原文。修改应聚焦用户要求，不覆盖或回退现有未提交改动。执行文件变更后，说明修改内容及验证结果。
