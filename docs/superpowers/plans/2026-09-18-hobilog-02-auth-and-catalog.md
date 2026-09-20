# HobiLog V0.1 鉴权与基础资料（P2）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 NestJS 成为业务权威入口：Supabase Access Token 校验 + `userId` 注入 + UserProfile 自动建档，并交付 Product / Platform / Store 三个基础资料模块的完整 REST API。

**Architecture:** 全局 `APP_GUARD`（`SupabaseAuthGuard`）验证 Bearer Token 并写入 `request.user`；`@Public()` 放行健康检查；`UserProfileService.ensureProfile()` 在每次认证请求中补齐 `user_profiles` 行（业务表外键都指向它）。所有模块统一形状：`controller → service → prisma`，DTO 负责校验，mapper 负责 Decimal/Date 出口转换，查询一律带 `userId`。

**Tech Stack:** 复用 P1 全栈（NestJS 10 / Prisma 5 / @supabase/supabase-js 2 / class-validator / Jest + Supertest）。

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

| 位置 | 计划/初版写法 | 实际采用 | 原因 |
| --- | --- | --- | --- |
| `products` e2e mock（Task 2） | 抛 `new Error` 且挂 `status: 401` | 抛 `BusinessException(401)` | 裸 `Error` 会被 `AllExceptionsFilter` 映射成 500，断言不到 401 |
| `product/mapper/product.mapper.ts`（Task 4） | `from '../../generated/prisma/client'` | `from '../../../generated/prisma/client'` | `mapper/` 多一层目录，深度按上面「相对深度速查」 |
| `product.service.spec.ts` 归档 404 断言（Task 4） | `toMatchObject({ status: 404, code: 'PRODUCT_NOT_FOUND' })` | `toMatchObject({ status: 404, response: { statusCode, code, message } })` | `BusinessException` 继承 `HttpException`，`code` 在 `getResponse()` 里，不是异常的顶层自有属性 |
| `assertOwned` 归属校验（Task 5 / 6） | 实现片段抛 400 `INVALID_PLATFORM` / `INVALID_STORE`（与同 Task spec 标题「抛 404」自相矛盾） | 统一 404 `PLATFORM_NOT_FOUND` / `STORE_NOT_FOUND` | 单个资源「不存在或不属于当前用户」与 Product 一致地返回 404；400 `INVALID_*` 保留给批量 id 校验（P3 的 `INVALID_PRODUCTS`） |
| Platform / Store VO 位置（Task 5 / 6） | `toPlatformVo` / `toStoreVo` 内联在 service | 拆到 `modules/<m>/mapper/<m>.mapper.ts` + `.spec.ts` | 与既有 product 模块结构一致 |
| 实体 `name` 校验（Task 4 / 5 / 6） | `@IsString() @MaxLength(...)`（`""` 可通过） | 追加 `@IsNotEmpty()` | Task 7 实测 `POST /api/products {"name":""}` 曾返回 201 |
| 接口文档同步（Task 7 Step 1） | 「如 P2 接口与文档不一致，更新对应清单」 | `docs/05` 新增 §13 Platform API、§14 Store API，原 13–20 节顺延为 15–22；§12 Product API 补充筛选与错误码 | 与真实路由（`/api/platforms`、`/api/stores`）对齐 |
| 测试用户创建方式（Task 7 Step 2） | 「在 Supabase 控制台创建两个测试用户」 | 用服务端 `SUPABASE_SECRET_KEY` 走 Admin API 创建 `a@hobilog.dev` / `b@hobilog.dev` | 免手工操作，且 secret key 只存在于 server |

---

## Global Constraints

沿用 roadmap 全局约束。P2 追加：

- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` 从 P2 起成为**必填**环境变量；`SUPABASE_SECRET_KEY` 只允许出现在 `apps/server`，禁止进入任何 `VITE_` 变量（前端只用 publishable key）。
- 校验 Token 使用 `supabase.auth.getUser(token)`；服务端另建 service-role client 供 P4 的 Storage 使用。
- 认证失败统一 `401 + code = UNAUTHORIZED`；越权访问统一按 `404 + code = NOT_FOUND` 返回，不暴露「存在但不属于你」。
- 金额出口一律 `number`，日期出口一律 ISO 字符串（`YYYY-MM-DD` 用于 `@db.Date`，完整 ISO 用于 timestamp）。
- 已被订单引用的 Product 禁止删除（`docs/07 §57`），只允许 `POST /products/:id/archive` 归档。
- 提交策略同 P1：`git commit` 步骤仅在用户授权时执行。

---

### Task 1: Supabase 客户端与 Token 校验

**Files:**
- Modify: `apps/server/src/config/env.validation.ts`
- Modify: `apps/server/src/config/env.validation.spec.ts`
- Modify: `apps/server/.env.example`
- Modify: `apps/server/test/setup-env.ts`
- Create: `apps/server/src/modules/auth/auth.types.ts`
- Create: `apps/server/src/modules/auth/supabase.service.ts`
- Create: `apps/server/src/modules/auth/supabase.service.spec.ts`
- Create: `apps/server/src/modules/auth/auth.module.ts`
- Create: `apps/server/src/common/decorators/public.decorator.ts`
- Modify: `apps/server/src/modules/health/health.controller.ts`（加 `@Public()`）
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `validateEnv`（P1 Task 4）、`BusinessException`（P1 Task 6）
- Produces:
  - `AuthUser { id: string; email?: string }`
  - `SupabaseService.getUserFromToken(token: string): Promise<AuthUser>`；`SupabaseService.admin: SupabaseClient`（secret key）
  - `extractBearerToken(header?: string): string | null`
  - `IS_PUBLIC_KEY` / `@Public()`
  - `AuthModule`（`@Global()`，导出 `SupabaseService`）

- [x] **Step 1: 扩展 env 校验测试（先失败）**

在 `apps/server/src/config/env.validation.spec.ts` 的 `validRaw` 中补入 Supabase 三项：

```ts
const validRaw = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hobilog',
  DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/hobilog',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
}
```

并把「同时缺少多项」用例改为：

```ts
it('同时缺少多项时全部列出', () => {
  expect(() => validateEnv({})).toThrow(
    'MISSING_ENV: DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY',
  )
})
```

Run: `pnpm --filter @hobilog/server test` → Expected: FAIL（缺少 SUPABASE_* 校验）。

- [x] **Step 2: 实现 env 扩展**

`src/config/env.validation.ts` 的 `REQUIRED_KEYS` 与 `AppEnv`：

```ts
const REQUIRED_KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
] as const

export interface AppEnv {
  NODE_ENV: AppEnvName
  PORT: number
  WEB_ORIGIN: string
  DATABASE_URL: string
  DIRECT_URL: string
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_SECRET_KEY: string
}
```

`validateEnv` 的 return 追加：

```ts
    SUPABASE_URL: raw.SUPABASE_URL as string,
    SUPABASE_PUBLISHABLE_KEY: raw.SUPABASE_PUBLISHABLE_KEY as string,
    SUPABASE_SECRET_KEY: raw.SUPABASE_SECRET_KEY as string,
```

`src/config/configuration.ts` 的 `AppConfig` 追加同名字段，并在默认导出里读取 `process.env.SUPABASE_*`。

`apps/server/test/setup-env.ts` 追加：

```ts
process.env.SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_PUBLISHABLE_KEY ??= 'sb_publishable_test'
process.env.SUPABASE_SECRET_KEY ??= 'sb_secret_test'
```

`apps/server/.env.example` 的 Supabase 段改为注释说明「P2 起必填」。

Run: `pnpm --filter @hobilog/server test` → Expected: PASS。

- [x] **Step 3: 写失败的 `supabase.service.spec.ts`**

```ts
import { BusinessException } from '../../common/exceptions/business.exception'
import { SupabaseService, extractBearerToken } from './supabase.service'

describe('extractBearerToken', () => {
  it('解析标准 Bearer 头', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def')
  })

  it('大小写与多余空格容错', () => {
    expect(extractBearerToken('bearer   abc.def ')).toBe('abc.def')
  })

  it('缺失或格式错误返回 null', () => {
    expect(extractBearerToken(undefined)).toBeNull()
    expect(extractBearerToken('Token abc')).toBeNull()
    expect(extractBearerToken('Bearer')).toBeNull()
  })
})

describe('SupabaseService.getUserFromToken', () => {
  const build = (result: unknown) => {
    const service = new SupabaseService({ get: (key: string) => process.env[key] } as never)
    Object.assign(service, {
      authClient: { auth: { getUser: vi.fn().mockResolvedValue(result) } },
    })
    return service
  }

  it('返回 AuthUser', async () => {
    const service = build({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null })
    await expect(service.getUserFromToken('t')).resolves.toEqual({ id: 'u1', email: 'a@b.com' })
  })

  it('无 user 时抛 401 UNAUTHORIZED', async () => {
    const service = build({ data: { user: null }, error: null })
    await expect(service.getUserFromToken('t')).rejects.toBeInstanceOf(BusinessException)
    await expect(service.getUserFromToken('t')).rejects.toMatchObject({ status: 401 })
  })

  it('返回 error 时抛 401 UNAUTHORIZED', async () => {
    const service = build({ data: { user: null }, error: { message: 'invalid jwt' } })
    await expect(service.getUserFromToken('t')).rejects.toMatchObject({ status: 401 })
  })

  it('无 email 时省略 email 字段', async () => {
    const service = build({ data: { user: { id: 'u9', email: undefined } }, error: null })
    await expect(service.getUserFromToken('t')).resolves.toEqual({ id: 'u9' })
  })
})
```

- [x] **Step 4: 实现 `auth.types.ts` 与 `supabase.service.ts`**

`src/modules/auth/auth.types.ts`:

```ts
export interface AuthUser {
  id: string
  email?: string
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>
  user?: AuthUser
}
```

`src/modules/auth/supabase.service.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { BusinessException } from '../../common/exceptions/business.exception'
import type { AuthUser } from './auth.types'

export function extractBearerToken(header?: string): string | null {
  if (!header) return null
  const match = /^bearer\s+(\S+)\s*$/i.exec(header)
  return match?.[1] ?? null
}

@Injectable()
export class SupabaseService {
  readonly admin: SupabaseClient
  private authClient: SupabaseClient

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL') ?? 'http://localhost'
    const publishableKey = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY') ?? 'sb_publishable_test'
    const secretKey = this.config.get<string>('SUPABASE_SECRET_KEY') ?? 'sb_secret_test'
    this.admin = createClient(url, secretKey, { auth: { persistSession: false } })
    this.authClient = createClient(url, publishableKey, { auth: { persistSession: false } })
  }

  async getUserFromToken(token: string): Promise<AuthUser> {
    const { data, error } = await this.authClient.auth.getUser(token)
    if (error || !data.user) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', '令牌无效或已过期')
    }
    return data.user.email ? { id: data.user.id, email: data.user.email } : { id: data.user.id }
  }
}
```

说明：`authClient` 声明为 `private`（非 readonly），测试用 `new SupabaseService({ get: key => process.env[key] } as never)` 构造，再用 `Object.assign` 覆盖 `authClient` 为 mock（见 Step 3），因此不需要真实网络与真实 key；`test/setup-env.ts` 提供的 dummy 值也保证 `createClient` 不会因 URL 非法而抛错。

- [x] **Step 5: 写 `Public` 装饰器与 `AuthModule`**

`src/common/decorators/public.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'hobilog:isPublic'

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true)
```

`src/modules/auth/auth.module.ts`:

```ts
import { Global, Module } from '@nestjs/common'
import { SupabaseService } from './supabase.service'

@Global()
@Module({ providers: [SupabaseService], exports: [SupabaseService] })
export class AuthModule {}
```

`src/app.module.ts` imports 追加 `AuthModule`。

`src/modules/health/health.controller.ts` 的类上加 `@Public()`。

Run: `pnpm --filter @hobilog/server test` → Expected: `supabase.service.spec.ts` PASS。

- [ ] **Step 6: 提交（需用户授权）**

```bash
git add apps/server/src/config apps/server/src/modules/auth apps/server/src/common/decorators apps/server/src/modules/health/health.controller.ts apps/server/src/app.module.ts apps/server/test/setup-env.ts apps/server/.env.example
git commit -m "feat(auth): add supabase client, token parsing and public decorator"
```

---

### Task 2: UserProfile 建档与全局 AuthGuard

**Files:**
- Create: `apps/server/src/modules/auth/user-profile.service.ts`
- Create: `apps/server/src/modules/auth/user-profile.service.spec.ts`
- Create: `apps/server/src/modules/auth/supabase-auth.guard.ts`
- Create: `apps/server/src/modules/auth/supabase-auth.guard.spec.ts`
- Create: `apps/server/src/common/decorators/current-user.decorator.ts`
- Create: `apps/server/test/auth.e2e-spec.ts`
- Create: `apps/server/test/probe.controller.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `SupabaseService`、`AuthUser`、`BusinessException`
- Produces:
  - `UserProfileService.ensureProfile(user: AuthUser): Promise<{ id: string }>`
  - `SupabaseAuthGuard`（`APP_GUARD`）
  - `@CurrentUser() user: AuthUser`
  - 测试用 `ProbeController`：`GET /api/probe/me` → `{ id, email? }`

- [x] **Step 1: 写失败的 `user-profile.service.spec.ts`**

```ts
import { UserProfileService } from './user-profile.service'

describe('UserProfileService.ensureProfile', () => {
  it('已存在时直接返回，不写库', async () => {
    const prisma = {
      userProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'u1' }), create: vi.fn() },
    }
    const service = new UserProfileService(prisma as never)
    await expect(service.ensureProfile({ id: 'u1' })).resolves.toEqual({ id: 'u1' })
    expect(prisma.userProfile.create).not.toHaveBeenCalled()
  })

  it('不存在时创建（username 为空）', async () => {
    const prisma = {
      userProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'u2' }),
      },
    }
    const service = new UserProfileService(prisma as never)
    await expect(service.ensureProfile({ id: 'u2', email: 'x@y.com' })).resolves.toEqual({ id: 'u2' })
    expect(prisma.userProfile.create).toHaveBeenCalledWith({ data: { id: 'u2' } })
  })

  it('并发建档撞 P2002 时回读已有行', async () => {
    const conflict = Object.assign(new Error('unique'), { code: 'P2002' })
    const prisma = {
      userProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'u3' }),
        create: vi.fn().mockRejectedValue(conflict),
      },
    }
    const service = new UserProfileService(prisma as never)
    await expect(service.ensureProfile({ id: 'u3' })).resolves.toEqual({ id: 'u3' })
  })
})
```

- [x] **Step 2: 实现 `user-profile.service.ts`**

```ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import type { AuthUser } from './auth.types'

@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureProfile(user: AuthUser): Promise<{ id: string }> {
    const existing = await this.prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { id: true },
    })
    if (existing) return existing

    try {
      return await this.prisma.userProfile.create({ data: { id: user.id }, select: { id: true } })
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'P2002') {
        const created = await this.prisma.userProfile.findUnique({
          where: { id: user.id },
          select: { id: true },
        })
        if (created) return created
      }
      throw error
    }
  }
}
```

- [x] **Step 3: 写失败的 `supabase-auth.guard.spec.ts`**

```ts
import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SupabaseAuthGuard } from './supabase-auth.guard'

function contextWith(headers: Record<string, string>, handler: () => void = () => undefined): ExecutionContext {
  const request: { headers: Record<string, string>; user?: unknown } = { headers }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext
}

describe('SupabaseAuthGuard', () => {
  const build = (isPublic = false) => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(isPublic) } as unknown as Reflector
    const supabase = { getUserFromToken: vi.fn().mockResolvedValue({ id: 'u1' }) }
    const profiles = { ensureProfile: vi.fn().mockResolvedValue({ id: 'u1' }) }
    return { guard: new SupabaseAuthGuard(reflector, supabase as never, profiles as never), supabase, profiles }
  }

  it('@Public() 直接放行', async () => {
    const { guard, supabase } = build(true)
    await expect(guard.canActivate(contextWith({}))).resolves.toBe(true)
    expect(supabase.getUserFromToken).not.toHaveBeenCalled()
  })

  it('缺少 Authorization 抛 401', async () => {
    const { guard } = build()
    await expect(guard.canActivate(contextWith({}))).rejects.toMatchObject({ status: 401 })
  })

  it('合法 token 注入 user 并建档', async () => {
    const { guard, profiles } = build()
    const context = contextWith({ authorization: 'Bearer t' })
    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(profiles.ensureProfile).toHaveBeenCalledWith({ id: 'u1' })
    expect(context.switchToHttp().getRequest<{ user?: unknown }>().user).toEqual({ id: 'u1' })
  })

  it('token 非法时冒泡 401', async () => {
    const { guard, supabase } = build()
    supabase.getUserFromToken.mockRejectedValueOnce(
      Object.assign(new Error('bad'), { status: 401 }),
    )
    await expect(guard.canActivate(contextWith({ authorization: 'Bearer t' }))).rejects.toMatchObject({ status: 401 })
  })
})
```

- [x] **Step 4: 实现 guard 与 `@CurrentUser()`**

`src/modules/auth/supabase-auth.guard.ts`:

```ts
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator'
import { BusinessException } from '../../common/exceptions/business.exception'
import type { AuthenticatedRequest } from './auth.types'
import { extractBearerToken, SupabaseService } from './supabase.service'
import { UserProfileService } from './user-profile.service'

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly userProfiles: UserProfileService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const rawHeader = request.headers.authorization
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
    const token = extractBearerToken(header)
    if (!token) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', '缺少访问令牌')
    }

    const user = await this.supabase.getUserFromToken(token)
    await this.userProfiles.ensureProfile(user)
    request.user = user
    return true
  }
}
```

`src/common/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common'
import type { AuthUser, AuthenticatedRequest } from '../../modules/auth/auth.types'
import { BusinessException } from '../exceptions/business.exception'

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
  if (!request.user) {
    throw new BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', '未认证请求')
  }
  return request.user
})
```

`src/modules/auth/auth.module.ts` 扩展为提供 `UserProfileService` 与导出的 guard：

```ts
import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { SupabaseAuthGuard } from './supabase-auth.guard'
import { SupabaseService } from './supabase.service'
import { UserProfileService } from './user-profile.service'

@Global()
@Module({
  providers: [
    SupabaseService,
    UserProfileService,
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
  exports: [SupabaseService, UserProfileService],
})
export class AuthModule {}
```

Run: `pnpm --filter @hobilog/server test` → Expected: guard 与服务用例 PASS。

- [x] **Step 5: 写认证 e2e（探针控制器）**

`apps/server/test/probe.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common'
import { CurrentUser } from '../src/common/decorators/current-user.decorator'
import type { AuthUser } from '../src/modules/auth/auth.types'

@Controller('probe')
export class ProbeController {
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }
}
```

`apps/server/test/auth.e2e-spec.ts`:

```ts
import { HttpStatus, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { BusinessException } from '../src/common/exceptions/business.exception'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/database/prisma.service'
import { SupabaseService } from '../src/modules/auth/supabase.service'
import { ProbeController } from './probe.controller'

describe('AuthGuard (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: async () => undefined,
        $disconnect: async () => undefined,
        $queryRaw: async () => [{ '?column?': 1 }],
        userProfile: {
          findUnique: async () => ({ id: 'user-a' }),
          create: async () => ({ id: 'user-a' }),
        },
      })
      .overrideProvider(SupabaseService)
      .useValue({
        admin: {},
        getUserFromToken: async (token: string) => {
          if (token === 'good-token') return { id: 'user-a', email: 'a@hobilog.dev' }
          throw new BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', '令牌无效或已过期')
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('无 token → 401 UNAUTHORIZED', async () => {
    const res = await request(app.getHttpServer()).get('/api/probe/me')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ statusCode: 401, code: 'UNAUTHORIZED', message: '缺少访问令牌' })
  })

  it('token 合法 → 返回当前用户', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/probe/me')
      .set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'user-a', email: 'a@hobilog.dev' })
  })

  it('token 非法 → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/probe/me')
      .set('Authorization', 'Bearer bad-token')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: '令牌无效或已过期',
    })
  })

  it('健康检查仍可匿名访问', async () => {
    const res = await request(app.getHttpServer()).get('/api/health')
    expect(res.status).toBe(200)
  })
})
```

Run: `pnpm --filter @hobilog/server test:e2e` → Expected: PASS（4 passed）。

- [ ] **Step 6: 提交（需用户授权）**

```bash
git add apps/server/src/modules/auth apps/server/src/common/decorators apps/server/test
git commit -m "feat(auth): add global supabase auth guard, user profile bootstrap and current user decorator"
```

---

### Task 3: 出口转换约定（Decimal / Date）与分页查询基类

**Files:**
- Create: `apps/server/src/common/utils/serialize.ts`
- Create: `apps/server/src/common/utils/serialize.spec.ts`
- Create: `apps/server/src/common/dto/sort-query.dto.ts`

**Interfaces:**
- Consumes: `Paginated`、`PaginationQueryDto`
- Produces:
  - `toNumber(value: Prisma.Decimal | number | string | null | undefined): number | null`
  - `toDateString(value: Date | null | undefined): string | null`（`YYYY-MM-DD`）
  - `toIsoString(value: Date | null | undefined): string | null`
  - `SortOrderQueryDto`（`sortBy?: string`、`sortOrder?: 'asc' | 'desc'`，默认 `desc`）

- [x] **Step 1: 写失败测试 `serialize.spec.ts`**

```ts
import { Prisma } from '../../generated/prisma/client'
import { toDateString, toIsoString, toNumber } from './serialize'

describe('toNumber', () => {
  it('Decimal → number', () => {
    expect(toNumber(new Prisma.Decimal('1299.50'))).toBe(1299.5)
  })

  it('null / undefined → null', () => {
    expect(toNumber(null)).toBeNull()
    expect(toNumber(undefined)).toBeNull()
  })

  it('字符串数字 → number', () => {
    expect(toNumber('0')).toBe(0)
  })
})

describe('toDateString', () => {
  it('日期取 UTC 年月日', () => {
    expect(toDateString(new Date('2027-05-01T00:00:00.000Z'))).toBe('2027-05-01')
  })

  it('null → null', () => {
    expect(toDateString(null)).toBeNull()
  })
})

describe('toIsoString', () => {
  it('输出完整 ISO', () => {
    expect(toIsoString(new Date('2027-05-18T10:00:00.000Z'))).toBe('2027-05-18T10:00:00.000Z')
  })

  it('null → null', () => {
    expect(toIsoString(undefined)).toBeNull()
  })
})
```

- [x] **Step 2: 实现 `serialize.ts` 与 `sort-query.dto.ts`**

`src/common/utils/serialize.ts`:

```ts
import { Prisma } from '../../generated/prisma/client'

export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

export function toDateString(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function toIsoString(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString()
}
```

`src/common/dto/sort-query.dto.ts`:

```ts
import { IsIn, IsOptional, IsString } from 'class-validator'

export class SortOrderQueryDto {
  @IsOptional()
  @IsString()
  sortBy?: string

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc'
}
```

Run: `pnpm --filter @hobilog/server test` → Expected: PASS。

- [ ] **Step 3: 提交（需用户授权）**

```bash
git add apps/server/src/common/utils apps/server/src/common/dto
git commit -m "feat(common): add decimal/date serializers and sort query dto"
```

---

### Task 4: Product 模块（CRUD + 归档 + 归属隔离）

**Files:**
- Create: `apps/server/src/modules/product/dto/create-product.dto.ts`
- Create: `apps/server/src/modules/product/dto/update-product.dto.ts`
- Create: `apps/server/src/modules/product/dto/query-product.dto.ts`
- Create: `apps/server/src/modules/product/mapper/product.mapper.ts`
- Create: `apps/server/src/modules/product/mapper/product.mapper.spec.ts`
- Create: `apps/server/src/modules/product/product.service.ts`
- Create: `apps/server/src/modules/product/product.service.spec.ts`
- Create: `apps/server/src/modules/product/product.controller.ts`
- Create: `apps/server/src/modules/product/product.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`、`@CurrentUser()`、`PaginationQueryDto`、`toPaginated`、`serialize` 工具、`@hobilog/shared` 的 `PRODUCT_CATEGORIES`
- Produces:
  - API：`GET /api/products`（分页 + 关键词 + 分类 + IP/角色/厂商筛选）、`POST /api/products`、`GET /api/products/:id`、`PATCH /api/products/:id`、`POST /api/products/:id/archive`
  - `ProductVo`：`{ id, name, originalName, coverUrl, category, ipName, characterName, manufacturer, seriesName, scale, version, sku, officialPrice: number | null, officialCurrency, announcedAt: string | null, originalReleaseDate: string | null, releaseDatePrecision, description, status, createdAt, updatedAt, tagIds: string[] }`
  - `ProductService.getOwnedProductIds(userId, ids): Promise<string[]>`（P3 创建订单复用）

- [x] **Step 1: 写失败的 `product.mapper.spec.ts`**

```ts
import { Prisma } from '../../../../generated/prisma/client'
import { toProductVo } from './product.mapper'

const base = {
  id: 'p1',
  userId: 'u1',
  name: '芙宁娜 1/7',
  originalName: null,
  coverUrl: null,
  category: 'SCALE_FIGURE',
  ipName: '原神',
  characterName: '芙宁娜',
  manufacturer: 'ALTER',
  seriesName: null,
  scale: '1/7',
  version: null,
  sku: null,
  officialPrice: new Prisma.Decimal('1299.00'),
  officialCurrency: 'CNY',
  announcedAt: new Date('2026-01-02T00:00:00.000Z'),
  originalReleaseDate: new Date('2027-05-01T00:00:00.000Z'),
  releaseDatePrecision: 'MONTH',
  description: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-09-18T10:00:00.000Z'),
  updatedAt: new Date('2026-09-18T10:00:00.000Z'),
  productTags: [{ tagId: 't1' }, { tagId: 't2' }],
}

describe('toProductVo', () => {
  it('Decimal → number 且不泄露 userId', () => {
    const vo = toProductVo(base)
    expect(vo.officialPrice).toBe(1299)
    expect(vo).not.toHaveProperty('userId')
    expect(vo).not.toHaveProperty('productTags')
  })

  it('日期按 Date 类型输出', () => {
    const vo = toProductVo(base)
    expect(vo.originalReleaseDate).toBe('2027-05-01')
    expect(vo.createdAt).toBe('2026-09-18T10:00:00.000Z')
  })

  it('tagIds 来自 productTags', () => {
    expect(toProductVo(base).tagIds).toEqual(['t1', 't2'])
  })
})
```

- [x] **Step 2: 实现 mapper 与 DTO**

`src/modules/product/mapper/product.mapper.ts`（入参类型用 `Prisma.ProductGetPayload<{ include: { productTags: true } }>`）：

```ts
import type { Prisma } from '../../../generated/prisma/client'
import { toDateString, toIsoString, toNumber } from '../../../common/utils/serialize'

type ProductWithTags = Prisma.ProductGetPayload<{ include: { productTags: true } }>

export interface ProductVo {
  id: string
  name: string
  originalName: string | null
  coverUrl: string | null
  category: string
  ipName: string | null
  characterName: string | null
  manufacturer: string | null
  seriesName: string | null
  scale: string | null
  version: string | null
  sku: string | null
  officialPrice: number | null
  officialCurrency: string | null
  announcedAt: string | null
  originalReleaseDate: string | null
  releaseDatePrecision: string | null
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
  tagIds: string[]
}

export function toProductVo(product: ProductWithTags): ProductVo {
  return {
    id: product.id,
    name: product.name,
    originalName: product.originalName,
    coverUrl: product.coverUrl,
    category: product.category,
    ipName: product.ipName,
    characterName: product.characterName,
    manufacturer: product.manufacturer,
    seriesName: product.seriesName,
    scale: product.scale,
    version: product.version,
    sku: product.sku,
    officialPrice: toNumber(product.officialPrice),
    officialCurrency: product.officialCurrency,
    announcedAt: toDateString(product.announcedAt),
    originalReleaseDate: toDateString(product.originalReleaseDate),
    releaseDatePrecision: product.releaseDatePrecision,
    description: product.description,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    tagIds: product.productTags.map(item => item.tagId),
  }
}
```

`dto/create-product.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray, IsIn, IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min,
} from 'class-validator'
import { PRODUCT_CATEGORIES } from '@hobilog/shared'

export class CreateProductDto {
  @ApiProperty({ example: '芙宁娜 1/7' })
  @IsString()
  @MaxLength(200)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originalName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string

  @ApiPropertyOptional({ enum: PRODUCT_CATEGORIES, default: 'OTHER' })
  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES)
  category: string = 'OTHER'

  @ApiPropertyOptional() @IsOptional() @IsString() ipName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() characterName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() manufacturer?: string
  @ApiPropertyOptional() @IsOptional() @IsString() seriesName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() scale?: string
  @ApiPropertyOptional() @IsOptional() @IsString() version?: string
  @ApiPropertyOptional() @IsOptional() @IsString() sku?: string

  @ApiPropertyOptional({ example: 1299 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  officialPrice?: number

  @ApiPropertyOptional({ example: 'CNY' })
  @IsOptional()
  @IsString()
  officialCurrency?: string

  @ApiPropertyOptional({ example: '2027-05-01' })
  @IsOptional()
  @IsISO8601()
  announcedAt?: string

  @ApiPropertyOptional({ example: '2027-05-01' })
  @IsOptional()
  @IsISO8601()
  originalReleaseDate?: string

  @ApiPropertyOptional({ enum: ['DAY', 'MONTH'] })
  @IsOptional()
  @IsIn(['DAY', 'MONTH'])
  releaseDatePrecision?: string

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagNames?: string[]
}
```

`dto/update-product.dto.ts`：`export class UpdateProductDto extends PartialType(CreateProductDto) {}`（`PartialType` 来自 `@nestjs/swagger`）。

`dto/query-product.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { PRODUCT_CATEGORIES } from '@hobilog/shared'
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto'

export class QueryProductDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '关键词：名称 / 原名 / SKU' })
  @IsOptional() @IsString() keyword?: string

  @ApiPropertyOptional({ enum: PRODUCT_CATEGORIES })
  @IsOptional() @IsIn(PRODUCT_CATEGORIES) category?: string

  @ApiPropertyOptional() @IsOptional() @IsString() ipName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() characterName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() manufacturer?: string

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED'] })
  @IsOptional() @IsIn(['ACTIVE', 'ARCHIVED']) status?: string
}
```

- [x] **Step 3: 写失败的 `product.service.spec.ts`**

```ts
import { BusinessException } from '../../common/exceptions/business.exception'
import { ProductService } from './product.service'

const prismaMock = () => ({
  product: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tag: { upsert: vi.fn().mockResolvedValue({ id: 't1' }) },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
})

describe('ProductService', () => {
  it('list 强制带 userId 且返回分页形状', async () => {
    const prisma = prismaMock()
    const service = new ProductService(prisma as never)
    const result = await service.list('u1', { page: 2, pageSize: 10, keyword: '芙' })
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
    )
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 })
  })

  it('getOwnedProductIds 数量不匹配时不给通过（返回实际命中）', async () => {
    const prisma = prismaMock()
    prisma.product.findMany.mockResolvedValue([{ id: 'p1' }])
    const service = new ProductService(prisma as never)
    await expect(service.getOwnedProductIds('u1', ['p1', 'p2'])).resolves.toEqual(['p1'])
  })

  it('archive 用 id + userId 双条件，找不到抛 404', async () => {
    const prisma = prismaMock()
    prisma.product.update.mockRejectedValue(Object.assign(new Error('nf'), { code: 'P2025' }))
    const service = new ProductService(prisma as never)
    await expect(service.archive('u1', 'p1')).rejects.toBeDefined()
  })

  it('archive 成功返回归档后的 VO', async () => {
    const prisma = prismaMock()
    prisma.product.update.mockResolvedValue({
      id: 'p1', userId: 'u1', name: 'x', originalName: null, coverUrl: null, category: 'OTHER',
      ipName: null, characterName: null, manufacturer: null, seriesName: null, scale: null,
      version: null, sku: null, officialPrice: null, officialCurrency: null, announcedAt: null,
      originalReleaseDate: null, releaseDatePrecision: null, description: null, status: 'ARCHIVED',
      createdAt: new Date('2026-09-18T00:00:00.000Z'), updatedAt: new Date('2026-09-18T00:00:00.000Z'),
      productTags: [],
    })
    const service = new ProductService(prisma as never)
    await expect(service.archive('u1', 'p1')).resolves.toMatchObject({ id: 'p1', status: 'ARCHIVED' })
  })

  it('create 为 tagNames 建 tag 并连接', async () => {
    const prisma = prismaMock()
    prisma.product.create.mockResolvedValue({
      id: 'p9', userId: 'u1', name: 'x', originalName: null, coverUrl: null, category: 'OTHER',
      ipName: null, characterName: null, manufacturer: null, seriesName: null, scale: null,
      version: null, sku: null, officialPrice: null, officialCurrency: null, announcedAt: null,
      originalReleaseDate: null, releaseDatePrecision: null, description: null, status: 'ACTIVE',
      createdAt: new Date('2026-09-18T00:00:00.000Z'), updatedAt: new Date('2026-09-18T00:00:00.000Z'),
      productTags: [{ tagId: 't1' }],
    })
    const service = new ProductService(prisma as never)
    const vo = await service.create('u1', { name: 'x', category: 'OTHER', tagNames: ['限定'] })
    expect(prisma.tag.upsert).toHaveBeenCalledWith({
      where: { userId_name: { userId: 'u1', name: '限定' } },
      create: { userId: 'u1', name: '限定' },
      update: {},
    })
    expect(vo.tagIds).toEqual(['t1'])
  })
})
```

- [x] **Step 4: 实现 `product.service.ts` / `product.controller.ts` / `product.module.ts`**

`src/modules/product/product.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { toPaginated } from '../../common/types/paginated'
import type { Paginated } from '@hobilog/shared'
import type { CreateProductDto } from './dto/create-product.dto'
import type { QueryProductDto } from './dto/query-product.dto'
import type { UpdateProductDto } from './dto/update-product.dto'
import { toProductVo, type ProductVo } from './mapper/product.mapper'

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: QueryProductDto): Promise<Paginated<ProductVo>> {
    const where: Prisma.ProductWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : { status: 'ACTIVE' }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.ipName ? { ipName: query.ipName } : {}),
      ...(query.characterName ? { characterName: query.characterName } : {}),
      ...(query.manufacturer ? { manufacturer: query.manufacturer } : {}),
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword, mode: 'insensitive' as const } },
              { originalName: { contains: query.keyword, mode: 'insensitive' as const } },
              { sku: { contains: query.keyword, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { productTags: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ])

    return toPaginated(rows.map(toProductVo), total, query.page, query.pageSize)
  }

  async getDetail(userId: string, id: string): Promise<ProductVo> {
    const product = await this.prisma.product.findFirst({
      where: { id, userId },
      include: { productTags: true },
    })
    if (!product) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', '商品不存在')
    }
    return toProductVo(product)
  }

  async create(userId: string, dto: CreateProductDto): Promise<ProductVo> {
    const tagIds = await this.resolveTagIds(userId, dto.tagNames)
    const product = await this.prisma.product.create({
      data: {
        userId,
        name: dto.name,
        originalName: dto.originalName,
        coverUrl: dto.coverUrl,
        category: dto.category,
        ipName: dto.ipName,
        characterName: dto.characterName,
        manufacturer: dto.manufacturer,
        seriesName: dto.seriesName,
        scale: dto.scale,
        version: dto.version,
        sku: dto.sku,
        officialPrice: dto.officialPrice,
        officialCurrency: dto.officialCurrency,
        announcedAt: dto.announcedAt ? new Date(dto.announcedAt) : null,
        originalReleaseDate: dto.originalReleaseDate ? new Date(dto.originalReleaseDate) : null,
        releaseDatePrecision: dto.releaseDatePrecision,
        description: dto.description,
        ...(tagIds.length > 0
          ? { productTags: { create: tagIds.map(tagId => ({ tagId })) } }
          : {}),
      },
      include: { productTags: true },
    })
    return toProductVo(product)
  }

  async update(userId: string, id: string, dto: UpdateProductDto): Promise<ProductVo> {
    await this.assertOwned(userId, id)
    const tagIds = dto.tagNames ? await this.resolveTagIds(userId, dto.tagNames) : undefined
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        originalName: dto.originalName,
        coverUrl: dto.coverUrl,
        category: dto.category,
        ipName: dto.ipName,
        characterName: dto.characterName,
        manufacturer: dto.manufacturer,
        seriesName: dto.seriesName,
        scale: dto.scale,
        version: dto.version,
        sku: dto.sku,
        officialPrice: dto.officialPrice,
        officialCurrency: dto.officialCurrency,
        announcedAt: dto.announcedAt ? new Date(dto.announcedAt) : undefined,
        originalReleaseDate: dto.originalReleaseDate ? new Date(dto.originalReleaseDate) : undefined,
        releaseDatePrecision: dto.releaseDatePrecision,
        description: dto.description,
        ...(tagIds
          ? { productTags: { deleteMany: {}, create: tagIds.map(tagId => ({ tagId })) } }
          : {}),
      },
      include: { productTags: true },
    })
    return toProductVo(product)
  }

  async archive(userId: string, id: string): Promise<ProductVo> {
    await this.assertOwned(userId, id)
    const product = await this.prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      include: { productTags: true },
    })
    return toProductVo(product)
  }

  async getOwnedProductIds(userId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return []
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true },
    })
    return rows.map(row => row.id)
  }

  private async assertOwned(userId: string, id: string): Promise<void> {
    const found = await this.prisma.product.count({ where: { id, userId } })
    if (found === 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', '商品不存在')
    }
  }

  private async resolveTagIds(userId: string, tagNames?: string[]): Promise<string[]> {
    if (!tagNames || tagNames.length === 0) return []
    const names = [...new Set(tagNames.map(name => name.trim()).filter(Boolean))]
    const tags = await Promise.all(
      names.map(name =>
        this.prisma.tag.upsert({
          where: { userId_name: { userId, name } },
          create: { userId, name },
          update: {},
          select: { id: true },
        }),
      ),
    )
    return tags.map(tag => tag.id)
  }
}
```

在文件顶部导入 `HttpStatus` 与 `BusinessException`：

```ts
import { HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
```

`src/modules/product/product.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Paginated } from '@hobilog/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import { CreateProductDto } from './dto/create-product.dto'
import { QueryProductDto } from './dto/query-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import type { ProductVo } from './mapper/product.mapper'
import { ProductService } from './product.service'

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryProductDto): Promise<Paginated<ProductVo>> {
    return this.productService.list(user.id, query)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto): Promise<ProductVo> {
    return this.productService.create(user.id, dto)
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProductVo> {
    return this.productService.getDetail(user.id, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductVo> {
    return this.productService.update(user.id, id, dto)
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProductVo> {
    return this.productService.archive(user.id, id)
  }
}
```

`src/modules/product/product.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { ProductController } from './product.controller'
import { ProductService } from './product.service'

@Module({ controllers: [ProductController], providers: [ProductService], exports: [ProductService] })
export class ProductModule {}
```

`app.module.ts` imports 追加 `ProductModule`。

- [x] **Step 5: 运行测试**

Run:

```bash
pnpm --filter @hobilog/server test
pnpm --filter @hobilog/server typecheck
```

Expected: mapper + service + 既有用例全绿；typecheck 无错误。（实测：10 files / 51 tests 全绿；typecheck、`nest build` 均无错误）

- [ ] **Step 6: 提交（需用户授权）**

```bash
git add apps/server/src/modules/product apps/server/src/app.module.ts
git commit -m "feat(product): add product crud with ownership isolation and tagging"
```

---

### Task 5: Platform 模块（CRUD + 预置平台）

**Files:**
- Create: `apps/server/src/modules/platform/dto/create-platform.dto.ts`
- Create: `apps/server/src/modules/platform/dto/update-platform.dto.ts`
- Create: `apps/server/src/modules/platform/dto/query-platform.dto.ts`
- Create: `apps/server/src/modules/platform/platform.service.ts`
- Create: `apps/server/src/modules/platform/platform.service.spec.ts`
- Create: `apps/server/src/modules/platform/platform.controller.ts`
- Create: `apps/server/src/modules/platform/platform.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`、`CurrentUser`、`PaginationQueryDto`、`serialize`
- Produces:
  - API：`GET /api/platforms`（分页）、`POST /api/platforms`、`PATCH /api/platforms/:id`、`DELETE /api/platforms/:id`、`POST /api/platforms/presets`
  - `PlatformVo { id, name, logoUrl, website, region, defaultCurrency, note, createdAt, storeCount }`
  - `PlatformService.assertOwned(userId, platformId): Promise<void>`（供 Store / Order 复用）
  - 预置名称常量：`['淘宝','京东','Bilibili 会员购','Hpoi','AmiAmi','Good Smile','闲鱼','其他']`（来源 `docs/03 §39`）

- [x] **Step 1: 写失败的 `platform.service.spec.ts`**

```ts
import { PlatformService } from './platform.service'

const prismaMock = () => ({
  platform: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
})

describe('PlatformService', () => {
  it('list 带 userId 且返回分页形状', async () => {
    const prisma = prismaMock()
    const service = new PlatformService(prisma as never)
    const result = await service.list('u1', { page: 1, pageSize: 20 })
    expect(prisma.platform.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    )
    expect(result.pageSize).toBe(20)
  })

  it('createPresets 只创建缺失名称', async () => {
    const prisma = prismaMock()
    prisma.platform.findMany.mockResolvedValue([{ name: '淘宝' }])
    const service = new PlatformService(prisma as never)
    const result = await service.createPresets('u1')
    expect(prisma.platform.createMany).toHaveBeenCalledWith({
      data: ['京东', 'Bilibili 会员购', 'Hpoi', 'AmiAmi', 'Good Smile', '闲鱼', '其他'].map(name => ({
        userId: 'u1',
        name,
      })),
      skipDuplicates: true,
    })
    expect(result.created).toBe(7)
  })

  it('assertOwned 不存在时抛 404', async () => {
    const prisma = prismaMock()
    prisma.platform.count.mockResolvedValue(0)
    const service = new PlatformService(prisma as never)
    await expect(service.assertOwned('u1', 'pf1')).rejects.toMatchObject({ status: 404 })
  })
})
```

- [x] **Step 2: 实现 DTO / service / controller / module**

`dto/create-platform.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'
import { SUPPORTED_CURRENCIES } from '@hobilog/shared'

export class CreatePlatformDto {
  @ApiProperty({ example: '淘宝' })
  @IsString()
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) website?: string
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  defaultCurrency?: string

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
```

`dto/update-platform.dto.ts`：`export class UpdatePlatformDto extends PartialType(CreatePlatformDto) {}`
`dto/query-platform.dto.ts`：`export class QueryPlatformDto extends PaginationQueryDto { @IsOptional() @IsString() keyword?: string }`

`src/modules/platform/platform.service.ts` 关键实现（文件顶部导入：`import { HttpStatus, Injectable } from '@nestjs/common'`、`import type { Prisma } from '../../generated/prisma/client'`、`BusinessException`、`PrismaService`、`toPaginated`、`Paginated`、DTO 与 `PlatformVo`）：

```ts
const PRESET_PLATFORM_NAMES = [
  '淘宝', '京东', 'Bilibili 会员购', 'Hpoi', 'AmiAmi', 'Good Smile', '闲鱼', '其他',
] as const

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: QueryPlatformDto): Promise<Paginated<PlatformVo>> {
    const where: Prisma.PlatformWhereInput = {
      userId,
      ...(query.keyword ? { name: { contains: query.keyword, mode: 'insensitive' as const } } : {}),
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.platform.findMany({
        where,
        include: { _count: { select: { stores: true } } },
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.platform.count({ where }),
    ])
    return toPaginated(rows.map(toPlatformVo), total, query.page, query.pageSize)
  }

  async create(userId: string, dto: CreatePlatformDto): Promise<PlatformVo> { /* create + include _count → toPlatformVo */ }

  async update(userId: string, id: string, dto: UpdatePlatformDto): Promise<PlatformVo> {
    await this.assertOwned(userId, id)
    /* update，返回 toPlatformVo */
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.assertOwned(userId, id)
    await this.prisma.platform.delete({ where: { id } })
    return { id }
  }

  async assertOwned(userId: string, platformId: string): Promise<void> {
    const count = await this.prisma.platform.count({ where: { id: platformId, userId } })
    if (count === 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, 'INVALID_PLATFORM', '平台不存在或不属于当前用户')
    }
  }

  async createPresets(userId: string): Promise<{ created: number }> {
    const existing = await this.prisma.platform.findMany({ where: { userId }, select: { name: true } })
    const existingNames = new Set(existing.map(item => item.name))
    const missing = PRESET_PLATFORM_NAMES.filter(name => !existingNames.has(name))
    if (missing.length === 0) return { created: 0 }
    await this.prisma.platform.createMany({
      data: missing.map(name => ({ userId, name })),
      skipDuplicates: true,
    })
    return { created: missing.length }
  }
}
```

`toPlatformVo`：

```ts
export function toPlatformVo(platform: PlatformWithCount): PlatformVo {
  return {
    id: platform.id,
    name: platform.name,
    logoUrl: platform.logoUrl,
    website: platform.website,
    region: platform.region,
    defaultCurrency: platform.defaultCurrency,
    note: platform.note,
    createdAt: platform.createdAt.toISOString(),
    storeCount: platform._count.stores,
  }
}
```

`platform.controller.ts`：`GET /`、`POST /`、`POST /presets`（**必须声明在 `:id` 之前**，避免 `presets` 被当作 id）、`PATCH /:id`、`DELETE /:id`，全部 `@ApiBearerAuth()` + `@CurrentUser()`。

- [x] **Step 3: 运行测试**

Run: `pnpm --filter @hobilog/server test && pnpm --filter @hobilog/server typecheck`
Expected: PASS。（实测：14 files / 71 tests 全绿，typecheck + `nest build` 无错误）

- [ ] **Step 4: 提交（需用户授权）**

```bash
git add apps/server/src/modules/platform apps/server/src/app.module.ts
git commit -m "feat(platform): add platform crud and preset platforms"
```

---

### Task 6: Store 模块（CRUD + 平台归属校验）

**Files:**
- Create: `apps/server/src/modules/store/dto/create-store.dto.ts`
- Create: `apps/server/src/modules/store/dto/update-store.dto.ts`
- Create: `apps/server/src/modules/store/dto/query-store.dto.ts`
- Create: `apps/server/src/modules/store/store.service.ts`
- Create: `apps/server/src/modules/store/store.service.spec.ts`
- Create: `apps/server/src/modules/store/store.controller.ts`
- Create: `apps/server/src/modules/store/store.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**
- Consumes: `PlatformService.assertOwned`、`PrismaService`、`PaginationQueryDto`
- Produces:
  - API：`GET /api/stores?platformId=`、`POST /api/stores`、`PATCH /api/stores/:id`、`DELETE /api/stores/:id`
  - `StoreVo { id, name, platformId, platformName, url, contact, note, createdAt }`
  - `StoreService.assertOwned(userId, storeId): Promise<void>`（供 Order 复用）

- [x] **Step 1: 写失败的 `store.service.spec.ts`**

```ts
import { StoreService } from './store.service'

const prismaMock = () => ({
  store: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
})

describe('StoreService', () => {
  it('创建店铺时校验平台归属', async () => {
    const prisma = prismaMock()
    const platformService = { assertOwned: vi.fn().mockResolvedValue(undefined) }
    const service = new StoreService(prisma as never, platformService as never)
    prisma.store.create.mockResolvedValue({
      id: 's1', userId: 'u1', platformId: 'pf1', name: 'XXX手办店', url: null, contact: null,
      note: null, createdAt: new Date('2026-09-18T00:00:00.000Z'), platform: { name: '淘宝' },
    })
    const vo = await service.create('u1', { name: 'XXX手办店', platformId: 'pf1' })
    expect(platformService.assertOwned).toHaveBeenCalledWith('u1', 'pf1')
    expect(vo.platformName).toBe('淘宝')
  })

  it('不传 platformId 时跳过校验', async () => {
    const prisma = prismaMock()
    const platformService = { assertOwned: vi.fn() }
    const service = new StoreService(prisma as never, platformService as never)
    prisma.store.create.mockResolvedValue({
      id: 's2', userId: 'u1', platformId: null, name: '线下店', url: null, contact: null,
      note: null, createdAt: new Date('2026-09-18T00:00:00.000Z'), platform: null,
    })
    await service.create('u1', { name: '线下店' })
    expect(platformService.assertOwned).not.toHaveBeenCalled()
  })

  it('assertOwned 不存在时抛 404 STORE_NOT_FOUND', async () => {
    const prisma = prismaMock()
    const service = new StoreService(prisma as never, { assertOwned: vi.fn() } as never)
    prisma.store.count.mockResolvedValue(0)
    await expect(service.assertOwned('u1', 's1')).rejects.toMatchObject({ status: 404 })
  })
})
```

- [x] **Step 2: 实现 DTO / mapper / service / controller / module**

`dto/create-store.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator'

export class CreateStoreDto {
  @ApiProperty({ example: 'XXX手办店' })
  @IsString()
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  platformId?: string

  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) url?: string
  @ApiPropertyOptional() @IsOptional() @IsString() contact?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
```

`update-store.dto.ts`：`PartialType(CreateStoreDto)`；`query-store.dto.ts`：`PaginationQueryDto` + `@IsOptional() @IsUUID() platformId?: string` + `keyword?`。

`store.service.ts` 关键实现：

```ts
async create(userId: string, dto: CreateStoreDto): Promise<StoreVo> {
  if (dto.platformId) {
    await this.platformService.assertOwned(userId, dto.platformId)
  }
  const store = await this.prisma.store.create({
    data: { userId, name: dto.name, platformId: dto.platformId ?? null, url: dto.url, contact: dto.contact, note: dto.note },
    include: { platform: { select: { name: true } } },
  })
  return toStoreVo(store)
}

async assertOwned(userId: string, storeId: string): Promise<void> {
  const count = await this.prisma.store.count({ where: { id: storeId, userId } })
  if (count === 0) {
    throw new BusinessException(HttpStatus.BAD_REQUEST, 'INVALID_STORE', '店铺不存在或不属于当前用户')
  }
}
```

`toStoreVo`：`platformName: store.platform?.name ?? null`，`createdAt: store.createdAt.toISOString()`，不输出 `userId`。

`store.controller.ts` 与 `ProductController` 同形状（含 `platformId` 过滤）。

- [x] **Step 3: 运行测试并收尾**

Run: `pnpm --filter @hobilog/server test && pnpm --filter @hobilog/server test:e2e && pnpm --filter @hobilog/server typecheck`
Expected: PASS。（实测：unit 71 passed + e2e 10 passed；未签令牌访问 `/api/platforms`、`/api/stores`、`POST /api/platforms/presets` 均返回 `{"statusCode":401,"code":"UNAUTHORIZED",...}`）

- [ ] **Step 4: 提交（需用户授权）**

```bash
git add apps/server/src/modules/store apps/server/src/app.module.ts
git commit -m "feat(store): add store crud with platform ownership validation"
```

---

### Task 7: P2 里程碑验收（真实 Supabase 联调）

**Files:**
- Modify: `docs/05-HobiLog-V0.1-TypeScript类型与REST-API层.md`（如 P2 接口与文档不一致，更新对应清单）
- Create: `docs/superpowers/verification/2026-09-18-P2-verification.md`（记录实测结果）

**Interfaces:**
- Consumes: P2 全部产物 + 真实 Supabase 项目
- Produces: P2 验收记录（含越权隔离证据）

- [x] **Step 1: 全量检查**

Run:

```bash
pnpm -r build
pnpm -r test
pnpm --filter @hobilog/server test:e2e
pnpm --filter @hobilog/server typecheck
pnpm db:status
```

Expected: 全部通过。

- [x] **Step 2: 用真实 Supabase 用户验证鉴权与隔离**

在 Supabase 控制台创建两个测试用户（A、B），用 `curl` 走一遍：

```bash
# 1) 登录取 token（把 <publishable> 换成 SUPABASE_PUBLISHABLE_KEY，<url> 换成 SUPABASE_URL）
curl -s -X POST "<url>/auth/v1/token?grant_type=password" \
  -H "apikey: <publishable>" -H "Content-Type: application/json" \
  -d '{"email":"a@hobilog.dev","password":"<passwordA>"}'

# 2) A 创建平台与商品
curl -s -X POST http://localhost:3000/api/platforms/presets -H "Authorization: Bearer <tokenA>"
curl -s -X POST http://localhost:3000/api/products -H "Authorization: Bearer <tokenA>" \
  -H "Content-Type: application/json" \
  -d '{"name":"芙宁娜 1/7","category":"SCALE_FIGURE","ipName":"原神","manufacturer":"ALTER","officialPrice":1299}'
```

Expected: `presets` 返回 `{"created":8}`；商品返回含 `id` 的 VO，`officialPrice` 为 `1299`。
（实测：改用服务端 `SUPABASE_SECRET_KEY` 走 Admin API 创建 `a@hobilog.dev` / `b@hobilog.dev`，再用密码授权取 token；`created=8`、`officialPrice=1299`、`tagIds` 2 个，全部符合预期。）

- [x] **Step 3: 验证越权不可见**

拿到 A 的商品 `id` 后，用 B 的 token 请求：

```bash
curl -s -i http://localhost:3000/api/products/<A的商品id> -H "Authorization: Bearer <tokenB>" | head -1
curl -s http://localhost:3000/api/products/<A的商品id> -H "Authorization: Bearer <tokenB>"
curl -s "http://localhost:3000/api/products" -H "Authorization: Bearer <tokenB>"
```

Expected: 第一条 `404`；第二条 `{"statusCode":404,"code":"PRODUCT_NOT_FOUND","message":"商品不存在"}`；第三条 `items` 为空数组。
（实测全部符合；另外补验：B 改 A 商品 404、B 用 A 平台建店 404 `PLATFORM_NOT_FOUND`、B 删 A 店铺 404 `STORE_NOT_FOUND`、B 平台/商品/店铺列表均为空、A 归档后默认列表不含归档商品，20/20 全绿。）

- [x] **Step 4: 写入验收记录并汇报**

`docs/superpowers/verification/2026-09-18-P2-verification.md` 记录：命令、期望、实际输出摘要、结论。

汇报格式：

```text
P2 完成：Supabase AuthGuard / CurrentUser / UserProfile 建档 /
Product（CRUD + 归档 + 标签）/ Platform（CRUD + 预置）/ Store（CRUD + 平台校验）
隔离验证：用户 B 读取用户 A 商品 → 404 PRODUCT_NOT_FOUND，列表为空
下一步：P3 订单生命周期（Order / Payment / Release / Shipment + 状态机）
```

- [ ] **Step 5: 提交（需用户授权）**

```bash
git add docs/superpowers/verification
git commit -m "docs: record P2 verification results"
```
