# HobiLog V0.1 前端 Web（P5）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 HobiLog Vue3 Web：登录 → 商品 → 订单创建/列表/详情 主链路跑通，并补齐 Dashboard / Calendar / Statistics / Collection / 平台店铺 / 设置。

**Architecture:** 五层分明（`docs/06 §80`）：Page 负责业务与数据加载 → Component 负责展示与交互（props 下行、emits 上行）→ Composable 负责可复用逻辑 → `src/api/*` 负责数据访问 → `utils` 负责纯计算。Vue 只通过 `apps/web/src/api/*` 调 NestJS；Supabase SDK 仅用于 `supabase.auth.*` 与 Storage 直传。

**Tech Stack:** Vue 3.5 / TypeScript 5.6 / Vite 5 / Vue Router 4 / Pinia 2 / Element Plus 2 / TanStack Query 5 / Axios / dayjs / ECharts 5 / FullCalendar 6 / Zod / VueUse / Vitest 2 + @vue/test-utils。

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

---

## Global Constraints

沿用 roadmap 全量约束。P5 追加：

- 业务页面禁止出现 `supabase.from('orders')` / `supabase.rpc(...)`；`apps/web` 只允许 `supabase.auth.*` 与 `supabase.storage.*`（后者仅用于 signed URL 直传）。
- `Authorization: Bearer <access_token>` 由 `src/api/http.ts` 统一注入，页面不手写 token。
- 状态展示一律走 `AppStatusTag`（内部读 `STATUS_CONFIG`），页面禁止自己写 `<el-tag type="warning">`。
- 金额一律走 `AppCurrency`（`amount = null` 显示「待定」），日期一律走 `AppDate`（支持 `DAY` / `MONTH` 精度）。
- 服务端业务数据不进 Pinia（`docs/02 §33`）：Pinia 只存用户、全局配置、筛选条件、视图偏好。
- 组件通信只用 props / emits；子组件不直接改 Pinia、不直接调 API。
- 桌面优先：`>= 1280px` 保证「侧栏 + 主内容 + 右侧 Aside」完整展示；`< 1024px` 时 Aside 落回普通流。
- `apps/web` 环境变量只允许 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_API_BASE_URL`；禁止出现 secret key。
- 提交策略同 P1：`git commit` 步骤仅在用户授权时执行。

---

### Task 1: Web 工程脚手架与路由骨架

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/.env.example`
- Create: `apps/web/src/main.ts`
- Create: `apps/web/src/App.vue`
- Create: `apps/web/src/env.d.ts`
- Create: `apps/web/src/router/index.ts`
- Create: `apps/web/src/styles/variables.css`
- Create: `apps/web/src/styles/global.css`
- Create: `apps/web/src/styles/element-overrides.css`

**Interfaces:**
- Consumes: `@hobilog/shared`（工作区依赖）
- Produces: 可 `pnpm --filter @hobilog/web dev` 启动的 Vite 应用；路由表（`/login` + `DefaultLayout` 下的全部业务路由）；`src/styles/variables.css` 中的设计变量（`--page-bg` / `--card-bg` / `--radius-md` 等，取自 `docs/06 §74`）。

- [ ] **Step 1: 写 `apps/web/package.json`**

```json
{
  "name": "@hobilog/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "vue-tsc -b --noEmit"
  },
  "dependencies": {
    "@element-plus/icons-vue": "^2.3.1",
    "@fullcalendar/core": "^6.1.15",
    "@fullcalendar/daygrid": "^6.1.15",
    "@fullcalendar/interaction": "^6.1.15",
    "@fullcalendar/list": "^6.1.15",
    "@fullcalendar/timegrid": "^6.1.15",
    "@fullcalendar/vue3": "^6.1.15",
    "@hobilog/shared": "workspace:*",
    "@supabase/supabase-js": "^2.46.1",
    "@tanstack/vue-query": "^5.59.16",
    "@vueuse/core": "^11.2.0",
    "axios": "^1.7.7",
    "dayjs": "^1.11.13",
    "echarts": "^5.5.1",
    "element-plus": "^2.8.8",
    "pinia": "^2.2.6",
    "sortablejs": "^1.15.6",
    "vue": "^3.5.13",
    "vue-router": "^4.4.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/sortablejs": "^1.15.8",
    "@vitejs/plugin-vue": "^5.2.0",
    "@vue/test-utils": "^2.4.6",
    "happy-dom": "^15.11.6",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.4",
    "vue-tsc": "^2.1.10"
  }
}
```

- [ ] **Step 2: 写 tsconfig / vite / vitest / index.html / env**

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "noEmit": true,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@hobilog/shared": ["../../packages/shared/src/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "src/**/*.d.ts", "vite.config.ts", "vitest.config.ts"]
}
```

`apps/web/vite.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
  build: { sourcemap: true },
})
```

`apps/web/vitest.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
    globals: true,
  },
})
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HobiLog</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`apps/web/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`apps/web/src/env.d.ts`:

```ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: 写样式变量**

`src/styles/variables.css`:

```css
:root {
  --page-bg: #f7f8fa;
  --card-bg: #ffffff;

  --text-primary: #1f2329;
  --text-secondary: #646a73;

  --border-color: #e8eaed;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --status-orange: #e8912d;
  --status-red: #d94b4b;
  --status-purple: #8a5cf0;
  --status-cyan: #2fa8a8;
  --status-blue: #3b82f6;
  --status-green: #34a853;
  --status-gray: #9aa0a6;
  --status-gray-blue: #6b7f9e;

  --sidebar-width: 232px;
  --sidebar-collapsed-width: 64px;
}
```

`src/styles/global.css`:

```css
@import './variables.css';
@import './element-overrides.css';

* {
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
}

body {
  background: var(--page-bg);
  color: var(--text-primary);
  font-family:
    'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
  font-size: 14px;
}

.app-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px 20px;
}
```

`src/styles/element-overrides.css`:

```css
:root {
  --el-color-primary: #5b6cff;
  --el-border-radius-base: var(--radius-sm);
  --el-border-color: var(--border-color);
}

.el-card,
.el-drawer,
.el-dialog {
  --el-card-border-radius: var(--radius-md);
}
```

- [ ] **Step 4: 写路由表与入口**

`src/router/index.ts`:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const DefaultLayout = () => import('@/layouts/DefaultLayout.vue')

export const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/pages/login/index.vue'), meta: { public: true } },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('@/pages/dashboard/index.vue') },
      { path: 'orders', name: 'orders', component: () => import('@/pages/orders/index.vue') },
      { path: 'orders/create', name: 'order-create', component: () => import('@/pages/orders/create.vue') },
      { path: 'orders/:id', name: 'order-detail', component: () => import('@/pages/orders/detail.vue') },
      { path: 'orders/:id/edit', name: 'order-edit', component: () => import('@/pages/orders/edit.vue') },
      { path: 'products', name: 'products', component: () => import('@/pages/products/index.vue') },
      { path: 'products/:id', name: 'product-detail', component: () => import('@/pages/products/detail.vue') },
      { path: 'collection', name: 'collection', component: () => import('@/pages/collection/index.vue') },
      { path: 'calendar', name: 'calendar', component: () => import('@/pages/calendar/index.vue') },
      { path: 'statistics', name: 'statistics', component: () => import('@/pages/statistics/index.vue') },
      { path: 'platforms', name: 'platforms', component: () => import('@/pages/platforms/index.vue') },
      { path: 'settings', name: 'settings', component: () => import('@/pages/settings/index.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
```

`src/main.ts`:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import App from './App.vue'
import { router } from './router'
import './styles/global.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(VueQueryPlugin)
  .use(ElementPlus, { locale: zhCn })
  .mount('#app')
```

`src/App.vue`:

```vue
<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>
```

Task 1 的占位页（后续 Task 逐个替换）：为每个路由创建 `pages/<name>/index.vue`，内容为

```vue
<script setup lang="ts"></script>

<template>
  <div class="app-card">占位：待实现</div>
</template>
```

需要占位的文件：`pages/login/index.vue`、`pages/dashboard/index.vue`、`pages/orders/index.vue`、`pages/orders/create.vue`、`pages/orders/detail.vue`、`pages/orders/edit.vue`、`pages/products/index.vue`、`pages/products/detail.vue`、`pages/collection/index.vue`、`pages/calendar/index.vue`、`pages/statistics/index.vue`、`pages/platforms/index.vue`、`pages/settings/index.vue`，以及 `layouts/DefaultLayout.vue`：

```vue
<script setup lang="ts"></script>

<template>
  <div>
    <RouterView />
  </div>
</template>
```

- [ ] **Step 5: 安装并验证**

Run:

```bash
pnpm install
pnpm --filter @hobilog/web typecheck
pnpm --filter @hobilog/web build
```

Expected: 依赖安装成功；typecheck 无错误；`apps/web/dist/index.html` 生成。

- [ ] **Step 6: 提交（需用户授权）**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold vite + vue3 app with router, pinia and element plus"
```

---

### Task 2: Supabase Auth、登录页与路由守卫

**Files:**
- Create: `apps/web/src/lib/supabase.ts`
- Create: `apps/web/src/stores/auth.ts`
- Create: `apps/web/src/stores/auth.spec.ts`
- Create: `apps/web/src/router/guards.ts`
- Modify: `apps/web/src/router/index.ts`
- Modify: `apps/web/src/pages/login/index.vue`
- Modify: `apps/web/src/App.vue`

**Interfaces:**
- Consumes: `import.meta.env.VITE_SUPABASE_*`
- Produces: `supabase`（唯一客户端实例）；`useAuthStore()` 暴露 `{ session, user, isAuthenticated, init(), signIn(email, password), signUp(email, password), signOut() }`；路由守卫 `installAuthGuard(router)`

- [ ] **Step 1: 写 `lib/supabase.ts` 与 `stores/auth.ts`**

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)
```

`src/stores/auth.ts`:

```ts
import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const initialized = ref(false)

  const isAuthenticated = () => session.value !== null

  async function init(): Promise<void> {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    supabase.auth.onAuthStateChange((_event, next) => {
      session.value = next
      user.value = next?.user ?? null
    })
    initialized.value = true
  }

  async function signIn(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    session.value = data.session
    user.value = data.user
  }

  async function signUp(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
  }

  async function accessToken(): Promise<string | null> {
    return (await supabase.auth.getSession()).data.session?.access_token ?? null
  }

  return { session, user, initialized, isAuthenticated, init, signIn, signUp, signOut, accessToken }
})
```

- [ ] **Step 2: 写失败的 `stores/auth.spec.ts`**

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' }, user: { id: 'u1' } }, error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

import { useAuthStore } from './auth'

describe('useAuthStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('init 后未登录时为 false', async () => {
    const store = useAuthStore()
    await store.init()
    expect(store.isAuthenticated()).toBe(false)
  })

  it('signIn 成功写入 session 与 user', async () => {
    const store = useAuthStore()
    await store.signIn('a@hobilog.dev', 'secret')
    expect(store.isAuthenticated()).toBe(true)
    expect(store.user?.id).toBe('u1')
  })

  it('signIn 失败抛出错误', async () => {
    const store = useAuthStore()
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ data: { session: null, user: null }, error: { message: '密码错误' } } as never)
    await expect(store.signIn('a@hobilog.dev', 'bad')).rejects.toThrow('密码错误')
  })

  it('accessToken 返回 token', async () => {
    const store = useAuthStore()
    await expect(store.accessToken()).resolves.toBe('tok')
  })
})
```

Run: `pnpm --filter @hobilog/web test` → Expected: 4 PASS（若 `getSession` mock 未返回 session，`isAuthenticated` 用例会失败，需按实现对齐断言）。

- [ ] **Step 3: 写路由守卫并在 `main.ts` 初始化**

`src/router/guards.ts`:

```ts
import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export function installAuthGuard(router: Router): void {
  router.beforeEach(async to => {
    const auth = useAuthStore()
    if (!auth.initialized) await auth.init()

    if (to.meta.public) return true
    if (!auth.isAuthenticated()) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
    return true
  })
}
```

`src/main.ts` 在 `mount` 前：

```ts
installAuthGuard(router)
```

（`src/router/index.ts` 不引入 store，避免循环依赖；守卫通过 `main.ts` 注入。）

- [ ] **Step 4: 写登录页**

`src/pages/login/index.vue`:

```vue
<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const mode = ref<'signIn' | 'signUp'>('signIn')
const form = reactive({ email: '', password: '' })

async function submit(): Promise<void> {
  loading.value = true
  try {
    if (mode.value === 'signIn') {
      await auth.signIn(form.email, form.password)
    } else {
      await auth.signUp(form.email, form.password)
      ElMessage.success('注册成功，请查收邮件后登录')
      mode.value = 'signIn'
      return
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="app-card login-card">
      <h1>HobiLog</h1>
      <p class="login-subtitle">记录每一件正在等到家的收藏</p>

      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="邮箱">
          <el-input v-model="form.email" type="email" placeholder="you@example.com" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password @keyup.enter="submit" />
        </el-form-item>
        <el-button type="primary" :loading="loading" style="width: 100%" @click="submit">
          {{ mode === 'signIn' ? '登录' : '注册' }}
        </el-button>
      </el-form>

      <el-button link type="primary" @click="mode = mode === 'signIn' ? 'signUp' : 'signIn'">
        {{ mode === 'signIn' ? '没有账号？注册' : '已有账号？登录' }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--page-bg);
}

.login-card {
  width: 360px;
  padding: 32px;
}

.login-subtitle {
  color: var(--text-secondary);
  margin-bottom: 24px;
}
</style>
```

`src/App.vue` 改为包一层 `<el-config-provider>`（locale 已在 `main.ts` 传入 Element Plus，可省略；保持 Task 1 版本即可）。

- [ ] **Step 5: 验证并提交**

Run:

```bash
pnpm --filter @hobilog/web test
pnpm --filter @hobilog/web typecheck
```

Expected: 单测 PASS；typecheck 通过。

```bash
git add apps/web/src/lib apps/web/src/stores apps/web/src/router apps/web/src/pages/login apps/web/src/main.ts
git commit -m "feat(web): add supabase auth store, login page and route guard"
```

---

### Task 3: HTTP 客户端与 API 层

**Files:**
- Create: `apps/web/src/api/http.ts`
- Create: `apps/web/src/api/http.spec.ts`
- Create: `apps/web/src/api/query-keys.ts`
- Create: `apps/web/src/api/auth.api.ts`
- Create: `apps/web/src/api/product.api.ts`
- Create: `apps/web/src/api/order.api.ts`
- Create: `apps/web/src/api/payment.api.ts`
- Create: `apps/web/src/api/release.api.ts`
- Create: `apps/web/src/api/shipment.api.ts`
- Create: `apps/web/src/api/platform.api.ts`
- Create: `apps/web/src/api/store.api.ts`
- Create: `apps/web/src/api/statistics.api.ts`
- Create: `apps/web/src/api/attachment.api.ts`
- Create: `apps/web/src/api/notification.api.ts`
- Create: `apps/web/src/types/models.ts`

**Interfaces:**
- Consumes: `useAuthStore.accessToken()`、服务端 VO 形状（P2–P4）
- Produces:
  - `http`（axios 实例，自动注入 Bearer、统一错误体解析 `ApiErrorBody`）
  - `ApiError`（含 `statusCode` / `code` / `message`）
  - `queryKeys`（TanStack Query 键工厂，含失效分组）
  - 各 `*.api.ts` 的请求函数（见下）

- [ ] **Step 1: 写 `api/http.ts`**

```ts
import axios, { AxiosError } from 'axios'
import type { ApiErrorBody } from '@hobilog/shared'
import { supabase } from '@/lib/supabase'

export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(body: ApiErrorBody) {
    super(body.message)
    this.statusCode = body.statusCode
    this.code = body.code
  }
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

http.interceptors.request.use(async config => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  response => response,
  (error: AxiosError<ApiErrorBody>) => {
    const body = error.response?.data
    if (body && typeof body.code === 'string') {
      return Promise.reject(new ApiError(body))
    }
    return Promise.reject(
      new ApiError({
        statusCode: error.response?.status ?? 0,
        code: 'NETWORK_ERROR',
        message: error.message || '网络异常，请稍后重试',
      }),
    )
  },
)
```

- [ ] **Step 2: 写失败的 `api/http.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { ApiError } from './http'

describe('ApiError', () => {
  it('保留 statusCode / code / message', () => {
    const error = new ApiError({ statusCode: 404, code: 'ORDER_NOT_FOUND', message: '订单不存在' })
    expect(error.statusCode).toBe(404)
    expect(error.code).toBe('ORDER_NOT_FOUND')
    expect(error.message).toBe('订单不存在')
    expect(error).toBeInstanceOf(Error)
  })
})
```

Run: `pnpm --filter @hobilog/web test` → Expected: PASS。

- [ ] **Step 3: 写 `types/models.ts`（与服务端 VO 对齐）**

```ts
import type {
  DisplayStatus, OrderStatus, PaymentMode, PaymentSummaryStatus, ReleaseStatus, ShipmentStatus,
} from '@hobilog/shared'

export interface OrderPaymentSummary {
  status: PaymentSummaryStatus
  paidAmount: number
  pendingAmount: number
  refundAmount: number
  netPaidAmount: number
  progress: number
  nextPayment: {
    id: string
    type: string
    name: string | null
    amount: number | null
    dueAt: string | null
    isOverdue: boolean
    overdueDays: number
  } | null
}

export interface OrderListItem {
  id: string
  orderNo: string | null
  orderedAt: string
  currency: string
  totalAmount: number
  paymentMode: PaymentMode
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
  paymentSummary: OrderPaymentSummary
  releaseSummary: { status: ReleaseStatus; plannedDate: string | null; precision: string | null; delayMonths: number }
  shipmentSummary: {
    status: ShipmentStatus | null
    carrier: string | null
    trackingNo: string | null
    inTransitCount: number
    total: number
  }
  updatedAt: string
}

export interface TimelineItem {
  id: string
  type: string
  title: string
  description: string | null
  occurredAt: string
  source: 'ORDER' | 'PAYMENT' | 'RELEASE' | 'SHIPMENT'
}

export interface OrderDetail extends OrderListItem {
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
  timeline: TimelineItem[]
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
```

- [ ] **Step 4: 写 API 模块与 queryKeys**

`src/api/query-keys.ts`:

```ts
export const queryKeys = {
  orders: {
    all: ['orders'] as const,
    list: (params: Record<string, unknown>) => ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  products: {
    all: ['products'] as const,
    list: (params: Record<string, unknown>) => ['products', 'list', params] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  platforms: { all: ['platforms'] as const, list: (params: Record<string, unknown>) => ['platforms', 'list', params] as const },
  stores: { all: ['stores'] as const, list: (params: Record<string, unknown>) => ['stores', 'list', params] as const },
  dashboard: ['statistics', 'dashboard'] as const,
  statistics: {
    monthly: (params: Record<string, unknown>) => ['statistics', 'monthly', params] as const,
    future: (params: Record<string, unknown>) => ['statistics', 'future', params] as const,
    dimension: (dimension: string, params: Record<string, unknown>) => ['statistics', dimension, params] as const,
  },
  calendar: (params: Record<string, unknown>) => ['calendar', 'events', params] as const,
  collection: {
    list: (params: Record<string, unknown>) => ['collection', 'list', params] as const,
    stats: ['collection', 'stats'] as const,
  },
  notifications: ['notifications', 'todos'] as const,
}

export const ORDER_MUTATION_INVALIDATIONS = [
  ['orders'],
  ['statistics'],
  ['calendar'],
  ['notifications'],
] as const
```

`src/api/order.api.ts`:

```ts
import type { PaginatedResult, OrderDetail, OrderListItem } from '@/types/models'
import { http } from './http'

export interface OrderListParams {
  tab?: string
  keyword?: string
  paymentSummaryStatus?: string
  platformId?: string
  storeId?: string
  manufacturer?: string
  ipName?: string
  characterName?: string
  category?: string
  year?: number
  priceMin?: number
  priceMax?: number
  delayed?: boolean
  page?: number
  pageSize?: number
}

export interface OrderItemPayload {
  productId: string
  quantity: number
  unitPrice: number
  note?: string
}

export interface OrderPaymentPayload {
  type: string
  name?: string
  amount?: number | null
  expectedAt?: string
  dueAt?: string
  paidAt?: string
  status?: 'PENDING' | 'PAID'
  paymentMethod?: string
  transactionNo?: string
  note?: string
}

export interface CreateOrderPayload {
  items: OrderItemPayload[]
  platformId?: string
  storeId?: string
  orderNo?: string
  orderUrl?: string
  orderedAt: string
  currency: string
  autoCalculateGoodsAmount: boolean
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
  paymentMode: string
  payments: OrderPaymentPayload[]
  expectedRelease?: { date: string; precision: 'DAY' | 'MONTH' }
  note?: string
}

export function getOrderList(params: OrderListParams) {
  return http.get<PaginatedResult<OrderListItem>>('/orders', { params }).then(res => res.data)
}

export function getOrderDetail(id: string) {
  return http.get<OrderDetail>(`/orders/${id}`).then(res => res.data)
}

export function createOrder(payload: CreateOrderPayload) {
  return http.post<OrderDetail>('/orders', payload).then(res => res.data)
}

export function updateOrder(id: string, payload: Partial<CreateOrderPayload>) {
  return http.patch<OrderDetail>(`/orders/${id}`, payload).then(res => res.data)
}

export function cancelOrder(id: string, payload: { refund: boolean; note?: string }) {
  return http.post<OrderDetail>(`/orders/${id}/cancel`, payload).then(res => res.data)
}
```

`src/api/payment.api.ts`:

```ts
export function createPayment(orderId: string, payload: OrderPaymentPayload) { /* POST /orders/:orderId/payments */ }
export function updatePayment(id: string, payload: Partial<OrderPaymentPayload> & { sortOrder?: number }) { /* PATCH /payments/:id */ }
export function markPaymentPaid(id: string, payload: {
  paidAmount: number; paidAt?: string; paymentMethod?: string; transactionNo?: string; note?: string; createSupplement?: boolean
}) { /* POST /payments/:id/paid → OrderDetail */ }
export function refundPayment(id: string, payload: {
  amount: number; paidAt?: string; paymentMethod?: string; note?: string; markOriginal?: boolean
}) { /* POST /payments/:id/refund → OrderDetail */ }
```

`src/api/release.api.ts`:

```ts
export function delayRelease(orderId: string, payload: {
  newDate: string; precision?: 'DAY' | 'MONTH'; oldDate?: string; source?: string; sourceUrl?: string; note?: string
}) { /* POST /orders/:orderId/release/delay → OrderDetail */ }

export function markReleased(orderId: string, payload: { date?: string; source?: string; note?: string }) { /* POST /orders/:orderId/release/released */ }
export function markStoreArrived(orderId: string, payload: { date?: string; source?: string; note?: string }) { /* POST /orders/:orderId/release/store-arrived */ }
export function openBalance(orderId: string, payload: { paymentId?: string; paymentType?: string; expectedAt?: string; dueAt?: string; note?: string }) { /* POST /orders/:orderId/release/balance-open */ }
```

`src/api/shipment.api.ts`:

```ts
export function createShipment(orderId: string, payload: {
  carrier?: string; trackingNo?: string; status?: 'WAITING' | 'SHIPPED'; shippedAt?: string
  estimatedDeliveryAt?: string; note?: string; items: Array<{ orderItemId: string; quantity: number }>
}) { /* POST /orders/:orderId/shipments → OrderDetail */ }

export function updateShipment(id: string, payload: {
  carrier?: string; trackingNo?: string; status?: string; shippedAt?: string; estimatedDeliveryAt?: string; note?: string
}) { /* PATCH /shipments/:id → OrderDetail */ }

export function deliverShipment(id: string, payload: { deliveredAt?: string; note?: string }) { /* POST /shipments/:id/delivered → OrderDetail */ }
```

`src/api/product.api.ts` / `platform.api.ts` / `store.api.ts` / `statistics.api.ts` / `calendar` / `collection` / `attachment.api.ts` / `notification.api.ts` 按 P2–P4 的接口一一对应实现，签名示例：

```ts
// product.api.ts
export function getProductList(params: ProductListParams): Promise<PaginatedResult<ProductVo>>
export function createProduct(payload: CreateProductPayload): Promise<ProductVo>
export function getProductDetail(id: string): Promise<ProductVo>
export function updateProduct(id: string, payload: Partial<CreateProductPayload>): Promise<ProductVo>
export function archiveProduct(id: string): Promise<ProductVo>

// statistics.api.ts
export function getDashboard(): Promise<DashboardVo>
export function getMonthlyPayments(params: { from?: string; to?: string; currency?: string }): Promise<MonthlyPaymentVo[]>
export function getFuturePayments(params: { months?: number; currency?: string }): Promise<FuturePaymentVo[]>
export function getDimensionStatistics(dimension: 'categories' | 'platforms' | 'manufacturers' | 'ips', params: { from?: string; to?: string; currency?: string }): Promise<DimensionStatVo[]>

// attachment.api.ts
export function getUploadUrl(payload: { bucket: 'attachments' | 'product-images'; targetType: 'ORDER' | 'PRODUCT'; targetId: string; fileName: string; mimeType: string; fileSize: number }): Promise<{ bucket: string; path: string; token: string; signedUrl: string }>
export function createAttachment(payload: { bucket: string; storagePath: string; type: string; fileName: string; mimeType?: string; fileSize?: number; orderId?: string; productId?: string }): Promise<AttachmentVo>
export function deleteAttachment(id: string): Promise<{ id: string }>
export function getAttachmentUrl(id: string): Promise<{ signedUrl: string }>
```

- [ ] **Step 5: 验证并提交**

Run: `pnpm --filter @hobilog/web test && pnpm --filter @hobilog/web typecheck`

```bash
git add apps/web/src/api apps/web/src/types
git commit -m "feat(web): add http client, api layer and query keys"
```

---

### Task 4: 布局与通用组件

**Files:**
- Create: `apps/web/src/constants/status.ts`
- Create: `apps/web/src/constants/status.spec.ts`
- Create: `apps/web/src/components/layout/AppSidebar.vue`
- Create: `apps/web/src/components/layout/AppHeader.vue`
- Create: `apps/web/src/components/layout/AppBreadcrumb.vue`
- Create: `apps/web/src/components/common/AppPageHeader.vue`
- Create: `apps/web/src/components/common/AppStatusTag.vue`
- Create: `apps/web/src/components/common/AppStatusTag.spec.ts`
- Create: `apps/web/src/components/common/AppCurrency.vue`
- Create: `apps/web/src/components/common/AppCurrency.spec.ts`
- Create: `apps/web/src/components/common/AppDate.vue`
- Create: `apps/web/src/components/common/AppDate.spec.ts`
- Create: `apps/web/src/components/common/AppEmpty.vue`
- Create: `apps/web/src/components/common/AppImage.vue`
- Create: `apps/web/src/components/common/AppSection.vue`
- Create: `apps/web/src/components/common/AppLoading.vue`
- Create: `apps/web/src/components/common/AppErrorState.vue`
- Create: `apps/web/src/components/common/AppConfirm.vue`
- Create: `apps/web/src/utils/format.ts`
- Modify: `apps/web/src/layouts/DefaultLayout.vue`

**Interfaces:**
- Consumes: `@hobilog/shared` 的 `DISPLAY_STATUS_LABELS` / `DISPLAY_STATUS_COLORS`
- Produces:
  - `STATUS_CONFIG: Record<DisplayStatus, { label: string; color: string; icon: string }>`
  - `AppStatusTag`（props：`status: string`、`size?: 'small' | 'default' | 'large'`、`label?: string`）
  - `AppCurrency`（props：`amount?: number | null`、`currency?: string`、`placeholder?: string`）
  - `AppDate`（props：`value?: string | null`、`precision?: 'DAY' | 'MONTH'`）
  - `formatCurrency / formatDate / hasValue`（utils）

- [ ] **Step 1: 写 `constants/status.ts` 与失败测试**

```ts
import { DISPLAY_STATUS_COLORS, DISPLAY_STATUS_LABELS } from '@hobilog/shared'
import type { DisplayStatus } from '@hobilog/shared'

export const STATUS_ICONS: Record<DisplayStatus, string> = {
  CANCELLED: 'CircleClose',
  REFUNDED: 'CircleClose',
  PAYMENT_OVERDUE: 'TriangleAlert',
  WAITING_PAYMENT: 'Wallet',
  SHIPMENT_EXCEPTION: 'TriangleAlert',
  IN_TRANSIT: 'Truck',
  WAITING_SHIPMENT: 'Package',
  WAITING_RELEASE: 'Clock',
  COMPLETED: 'CircleCheck',
  ACTIVE: 'Clock',
}

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = Object.fromEntries(
  (Object.keys(DISPLAY_STATUS_LABELS) as DisplayStatus[]).map(status => [
    status,
    { label: DISPLAY_STATUS_LABELS[status], color: DISPLAY_STATUS_COLORS[status], icon: STATUS_ICONS[status] },
  ]),
)

export const TONE_BY_COLOR: Record<string, string> = {
  orange: 'warning',
  red: 'danger',
  purple: 'primary',
  cyan: 'info',
  blue: 'primary',
  green: 'success',
  gray: 'info',
  'gray-blue': 'info',
}
```

`src/constants/status.spec.ts`:

```ts
import { DISPLAY_STATUSES } from '@hobilog/shared'
import { STATUS_CONFIG } from './status'

describe('STATUS_CONFIG', () => {
  it('覆盖全部 DisplayStatus', () => {
    for (const status of DISPLAY_STATUSES) {
      expect(STATUS_CONFIG[status], `缺少配置：${status}`).toBeTruthy()
    }
  })

  it('每个状态都有中文 label 与 color', () => {
    for (const [status, config] of Object.entries(STATUS_CONFIG)) {
      expect(config.label, status).not.toBe('')
      expect(config.color, status).not.toBe('')
      expect(config.icon, status).not.toBe('')
    }
  })
})
```

- [ ] **Step 2: 写通用组件**

`src/components/common/AppStatusTag.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { TONE_BY_COLOR, STATUS_CONFIG } from '@/constants/status'

const props = withDefaults(
  defineProps<{ status: string; size?: 'small' | 'default' | 'large'; label?: string }>(),
  { size: 'default' },
)

const config = computed(() => STATUS_CONFIG[props.status] ?? { label: props.status, color: 'gray', icon: 'Clock' })
const tone = computed(() => TONE_BY_COLOR[config.value.color] ?? 'info')
</script>

<template>
  <el-tag :type="tone" :size="size" effect="light" round>
    {{ label ?? config.label }}
  </el-tag>
</template>
```

`src/components/common/AppStatusTag.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppStatusTag from './AppStatusTag.vue'

const stubs = { 'el-tag': { template: '<span><slot /></span>' } }

describe('AppStatusTag', () => {
  it('渲染 displayStatus 中文文案', () => {
    const wrapper = mount(AppStatusTag, { props: { status: 'WAITING_PAYMENT' }, global: { stubs } })
    expect(wrapper.text()).toContain('待付款')
  })

  it('PAYMENT_OVERDUE 使用 danger 色调', () => {
    const wrapper = mount(AppStatusTag, { props: { status: 'PAYMENT_OVERDUE' }, global: { stubs } })
    expect(wrapper.findComponent({ name: 'el-tag' }).exists() || wrapper.html()).toBeTruthy()
    expect(wrapper.vm).toBeDefined()
  })

  it('未知状态回退为原值', () => {
    const wrapper = mount(AppStatusTag, { props: { status: 'SOMETHING_NEW' }, global: { stubs } })
    expect(wrapper.text()).toContain('SOMETHING_NEW')
  })

  it('label 覆盖默认文案', () => {
    const wrapper = mount(AppStatusTag, { props: { status: 'WAITING_PAYMENT', label: '待补尾款' }, global: { stubs } })
    expect(wrapper.text()).toContain('待补尾款')
  })
})
```

（第二个用例只做冒烟：Element Plus 的 `type` 属性断言依赖 stub 实现，改用 `props` 断言时把 stub 换成 `{ template: '<span :data-type="type"><slot /></span>', props: ['type'] }` 并断言 `data-type`。）

`src/components/common/AppCurrency.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '@/utils/format'

const props = withDefaults(
  defineProps<{ amount?: number | null; currency?: string; placeholder?: string }>(),
  { currency: 'CNY', placeholder: '待定' },
)

const text = computed(() =>
  props.amount === null || props.amount === undefined ? props.placeholder : formatCurrency(props.amount, props.currency),
)
</script>

<template>
  <span class="app-currency">{{ text }}</span>
</template>
```

`src/utils/format.ts`:

```ts
import dayjs from 'dayjs'

const CURRENCY_SYMBOLS: Record<string, string> = { CNY: '¥', JPY: '¥', USD: '$', HKD: 'HK$' }

export function formatCurrency(amount: number, currency = 'CNY'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  const fractionDigits = currency === 'JPY' ? 0 : 2
  const value = amount.toLocaleString('zh-CN', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  return `${symbol}${value}`
}

export function formatDate(value: string | null | undefined, precision: 'DAY' | 'MONTH' = 'DAY'): string {
  if (!value) return ''
  return precision === 'MONTH'
    ? dayjs(value).format('YYYY年MM月')
    : dayjs(value).format('YYYY-MM-DD')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

export function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}
```

`AppCurrency.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppCurrency from './AppCurrency.vue'

describe('AppCurrency', () => {
  it('amount = null 显示“待定”', () => {
    expect(mount(AppCurrency, { props: { amount: null } }).text()).toBe('待定')
  })

  it('CNY 带 ¥ 前缀', () => {
    expect(mount(AppCurrency, { props: { amount: 1299 } }).text()).toBe('¥1,299')
  })

  it('JPY 不显示小数', () => {
    expect(mount(AppCurrency, { props: { amount: 12000, currency: 'JPY' } }).text()).toBe('¥12,000')
  })

  it('自定义 placeholder', () => {
    expect(mount(AppCurrency, { props: { amount: null, placeholder: '金额未知' } }).text()).toBe('金额未知')
  })
})
```

`src/components/common/AppDate.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { formatDate } from '@/utils/format'

const props = withDefaults(
  defineProps<{ value?: string | null; precision?: 'DAY' | 'MONTH'; placeholder?: string }>(),
  { precision: 'DAY', placeholder: '—' },
)

const text = computed(() => (props.value ? formatDate(props.value, props.precision) : props.placeholder))
</script>

<template>
  <span class="app-date">{{ text }}</span>
</template>
```

`AppDate.spec.ts`:

```ts
it('MONTH 精度显示 2027年05月', () => {
  expect(mount(AppDate, { props: { value: '2027-05-01', precision: 'MONTH' } }).text()).toBe('2027年05月')
})
it('DAY 精度显示 2027-05-18', () => {
  expect(mount(AppDate, { props: { value: '2027-05-18' } }).text()).toBe('2027-05-18')
})
it('空值显示占位符', () => {
  expect(mount(AppDate, { props: { value: null } }).text()).toBe('—')
})
```

其余组件的契约（同样写在 `components/common/`）：

```text
AppPageHeader   props: { title: string; description?: string }              slots: actions, extra
AppSection      props: { title: string; description?: string }              slots: default, extra
AppEmpty        props: { title?: string; description?: string; actionText?: string } emits: action
AppImage        props: { src?: string | null; alt?: string; ratio?: string; fit?: 'cover' | 'contain' }
AppLoading      props: { text?: string }
AppErrorState   props: { message?: string; retryText?: string }             emits: retry
AppConfirm      props: { modelValue: boolean; title: string; message?: string; confirmText?: string; danger?: boolean }
                emits: update:modelValue, confirm
```

`AppImage` 默认比例 `4 / 5`（`docs/06 §76`）；`AppEmpty` 默认文案「还没有任何订单」，`actionText` 传「创建订单」。

- [ ] **Step 3: 写布局**

`src/components/layout/AppSidebar.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const route = useRoute()

const menus = [
  { path: '/dashboard', label: '首页' },
  { path: '/orders', label: '订单' },
  { path: '/products', label: '商品库' },
  { path: '/collection', label: '收藏库' },
  { path: '/calendar', label: '日历' },
  { path: '/statistics', label: '统计' },
  { path: '/platforms', label: '平台 / 店铺' },
  { path: '/settings', label: '设置' },
]

const active = computed(() => menus.find(menu => route.path.startsWith(menu.path))?.path ?? '/dashboard')
</script>

<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': props.collapsed }">
    <div class="app-sidebar__brand" @click="emit('toggle')">HobiLog</div>
    <nav>
      <RouterLink v-for="menu in menus" :key="menu.path" :to="menu.path" :class="{ 'is-active': menu.path === active }">
        <span class="app-sidebar__label">{{ collapsed ? menu.label.slice(0, 1) : menu.label }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: var(--sidebar-width);
  border-right: 1px solid var(--border-color);
  background: var(--card-bg);
  padding: 16px 12px;
}

.app-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
}

.app-sidebar__brand {
  font-weight: 600;
  padding: 8px 12px 20px;
  cursor: pointer;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

a {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
}

a.is-active {
  background: #eef0ff;
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>
```

`AppHeader.vue`（搜索框 + 通知铃铛 + 用户菜单 + 退出登录）、`AppBreadcrumb.vue`（按 `route.matched` 渲染 `el-breadcrumb`）。

`src/layouts/DefaultLayout.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const collapsed = ref(false)
</script>

<template>
  <div class="default-layout">
    <AppSidebar :collapsed="collapsed" @toggle="collapsed = !collapsed" />
    <div class="default-layout__main">
      <AppHeader />
      <main class="default-layout__content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.default-layout {
  display: flex;
  min-height: 100vh;
}

.default-layout__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.default-layout__content {
  flex: 1;
  padding: 20px 24px 40px;
  max-width: 1440px;
}

@media (max-width: 1024px) {
  .default-layout__content {
    padding: 16px;
  }
}
</style>
```

- [ ] **Step 4: 验证并提交**

Run: `pnpm --filter @hobilog/web test && pnpm --filter @hobilog/web typecheck`

Expected: `status.spec.ts`、`AppStatusTag.spec.ts`、`AppCurrency.spec.ts`、`AppDate.spec.ts` 全 PASS。

```bash
git add apps/web/src/constants apps/web/src/components apps/web/src/utils apps/web/src/layouts
git commit -m "feat(web): add layout and common display components"
```

---

### Task 5: Composables 与纯计算 utils

**Files:**
- Create: `apps/web/src/utils/payment.ts`
- Create: `apps/web/src/utils/payment.spec.ts`
- Create: `apps/web/src/utils/order-form.ts`
- Create: `apps/web/src/utils/order-form.spec.ts`
- Create: `apps/web/src/composables/usePaymentSummary.ts`
- Create: `apps/web/src/composables/useOrderForm.ts`
- Create: `apps/web/src/composables/useOrderFilters.ts`
- Create: `apps/web/src/composables/useOrderFilters.spec.ts`
- Create: `apps/web/src/types/forms.ts`

**Interfaces:**
- Consumes: `@hobilog/shared` 的 `PAYMENT_MODES` / `PAYMENT_TYPES` / `SUPPORTED_CURRENCIES`
- Produces:
  - `utils/payment.ts`：`sumPaid`、`sumPending`、`sumRefund`、`netPaid`、`progress`、`nextPaymentOf`
  - `utils/order-form.ts`：`calcGoodsAmount`、`calcTotalAmount`、`defaultPaymentsFor(mode, totalAmount)`
  - `usePaymentSummary(payments, totalAmount)` → `ComputedRef<PaymentSummary>`
  - `useOrderForm(initial?: OrderFormModel)` → `{ form, summary, setPaymentMode, toPayload, errors, validate }`
  - `useOrderFilters()` → `{ filters, applyFromRoute, toQuery, reset, setTab }`

- [ ] **Step 1: 写 `utils/payment.ts` + 失败测试**

```ts
import type { PaymentLike } from '@hobilog/shared'

export interface PaymentFormLike {
  type: string
  amount: number | null
  status: string
  dueAt?: string | null
  paidAt?: string | null
  sortOrder: number
}

const isPending = (payment: PaymentFormLike) => payment.status === 'PENDING' || payment.status === 'OVERDUE'

export function sumPaid(payments: PaymentFormLike[]): number {
  return payments
    .filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND')
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function sumRefund(payments: PaymentFormLike[]): number {
  return payments
    .filter(payment => payment.status === 'PAID' && payment.type === 'REFUND')
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function netPaid(payments: PaymentFormLike[]): number {
  return sumPaid(payments) - sumRefund(payments)
}

export function sumPending(payments: PaymentFormLike[]): number {
  return payments
    .filter(payment => isPending(payment) && payment.amount !== null)
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
}

export function progress(payments: PaymentFormLike[], totalAmount: number): number {
  if (totalAmount <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((sumPaid(payments) / totalAmount) * 100)))
}

export function nextPaymentOf(payments: PaymentFormLike[]): PaymentFormLike | null {
  const candidates = payments.filter(isPending)
  if (candidates.length === 0) return null
  return (
    [...candidates].sort((a, b) => {
      const aDue = a.dueAt ?? '9999-12-31'
      const bDue = b.dueAt ?? '9999-12-31'
      return aDue === bDue ? a.sortOrder - b.sortOrder : aDue < bDue ? -1 : 1
    })[0] ?? null
  )
}
```

`utils/payment.spec.ts`：

```ts
import { netPaid, nextPaymentOf, progress, sumPaid, sumPending } from './payment'

const payments = [
  { type: 'DEPOSIT', amount: 300, status: 'PAID', sortOrder: 0 },
  { type: 'BALANCE', amount: 999, status: 'PENDING', dueAt: '2027-03-20', sortOrder: 1 },
  { type: 'SHIPPING', amount: null, status: 'PENDING', dueAt: null, sortOrder: 2 },
  { type: 'REFUND', amount: 300, status: 'PAID', sortOrder: 3 },
]

describe('付款汇总（与后端同口径，用于表单预览）', () => {
  it('已支付不含退款', () => {
    expect(sumPaid(payments)).toBe(300)
  })
  it('净支出 = 已支付 - 退款', () => {
    expect(netPaid(payments)).toBe(0)
  })
  it('待付款忽略金额待定节点', () => {
    expect(sumPending(payments)).toBe(999)
  })
  it('进度 = 已支付 / 总额', () => {
    expect(progress(payments, 1299)).toBe(23)
  })
  it('下一付款取最早截止，无截止排最后', () => {
    expect(nextPaymentOf(payments)?.type).toBe('BALANCE')
  })
  it('无待付节点时返回 null', () => {
    expect(nextPaymentOf([{ type: 'FULL', amount: 100, status: 'PAID', sortOrder: 0 }])).toBeNull()
  })
})
```

- [ ] **Step 2: 写 `utils/order-form.ts` + 失败测试**

```ts
import { PAYMENT_MODES } from '@hobilog/shared'
import type { OrderPaymentPayload } from '@/api/order.api'

const DEFAULT_PAYMENT_TYPE: Record<string, string> = {
  FULL: 'FULL',
  DEPOSIT_BALANCE: 'DEPOSIT',
  INSTALLMENT: 'INSTALLMENT',
  CUSTOM: 'OTHER',
}

export function calcGoodsAmount(items: Array<{ unitPrice: number; quantity: number }>): number {
  return Number(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2))
}

export function calcTotalAmount(amounts: {
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
}): number {
  return Number(
    (
      amounts.goodsAmount -
      amounts.discountAmount +
      amounts.shippingAmount +
      amounts.taxAmount +
      amounts.extraAmount
    ).toFixed(2),
  )
}

export function defaultPaymentsFor(mode: string, totalAmount: number): OrderPaymentPayload[] {
  if (!PAYMENT_MODES.includes(mode as (typeof PAYMENT_MODES)[number])) return []
  if (mode === 'FULL') {
    return [{ type: 'FULL', amount: totalAmount, status: 'PENDING' }]
  }
  if (mode === 'DEPOSIT_BALANCE') {
    return [
      { type: 'DEPOSIT', amount: 0, status: 'PENDING' },
      { type: 'BALANCE', amount: totalAmount, status: 'PENDING' },
    ]
  }
  return [{ type: DEFAULT_PAYMENT_TYPE[mode] ?? 'OTHER', amount: totalAmount, status: 'PENDING' }]
}
```

`utils/order-form.spec.ts`：

```ts
import { calcGoodsAmount, calcTotalAmount, defaultPaymentsFor } from './order-form'

describe('calcGoodsAmount', () => {
  it('按单价 × 数量求和并保留两位', () => {
    expect(calcGoodsAmount([{ unitPrice: 649.5, quantity: 2 }])).toBe(1299)
  })
})

describe('calcTotalAmount', () => {
  it('商品金额 - 优惠 + 运费 + 税费 + 其他', () => {
    expect(
      calcTotalAmount({ goodsAmount: 1299, discountAmount: 100, shippingAmount: 20, taxAmount: 0, extraAmount: 0 }),
    ).toBe(1219)
  })
})

describe('defaultPaymentsFor', () => {
  it('FULL → 单节点全款', () => {
    expect(defaultPaymentsFor('FULL', 1299)).toEqual([{ type: 'FULL', amount: 1299, status: 'PENDING' }])
  })

  it('DEPOSIT_BALANCE → 定金 + 尾款，尾款默认等于总额', () => {
    expect(defaultPaymentsFor('DEPOSIT_BALANCE', 1299)).toEqual([
      { type: 'DEPOSIT', amount: 0, status: 'PENDING' },
      { type: 'BALANCE', amount: 1299, status: 'PENDING' },
    ])
  })

  it('INSTALLMENT → 单个阶段款节点（后续由用户增删）', () => {
    expect(defaultPaymentsFor('INSTALLMENT', 4280)).toEqual([
      { type: 'INSTALLMENT', amount: 4280, status: 'PENDING' },
    ])
  })

  it('非法模式 → 空数组', () => {
    expect(defaultPaymentsFor('NOPE', 100)).toEqual([])
  })
})
```

- [ ] **Step 3: 写 composables**

`src/composables/useOrderFilters.ts`（`docs/06 §68`：Router Query ↔ Filter State）：

```ts
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface OrderFilterState {
  tab: string
  keyword: string
  paymentSummaryStatus: string
  platformId: string
  storeId: string
  manufacturer: string
  ipName: string
  characterName: string
  category: string
  year: number | undefined
  priceMin: number | undefined
  priceMax: number | undefined
  delayed: boolean
  page: number
  pageSize: number
}

export const DEFAULT_ORDER_FILTERS: OrderFilterState = {
  tab: 'ALL',
  keyword: '',
  paymentSummaryStatus: '',
  platformId: '',
  storeId: '',
  manufacturer: '',
  ipName: '',
  characterName: '',
  category: '',
  year: undefined,
  priceMin: undefined,
  priceMax: undefined,
  delayed: false,
  page: 1,
  pageSize: 20,
}

export function parseFiltersFromQuery(query: Record<string, unknown>): OrderFilterState {
  const numberOrUndefined = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const stringOrEmpty = (value: unknown): string => (typeof value === 'string' ? value : '')

  return {
    ...DEFAULT_ORDER_FILTERS,
    tab: stringOrEmpty(query.tab) || DEFAULT_ORDER_FILTERS.tab,
    keyword: stringOrEmpty(query.keyword),
    paymentSummaryStatus: stringOrEmpty(query.paymentSummaryStatus),
    platformId: stringOrEmpty(query.platformId),
    storeId: stringOrEmpty(query.storeId),
    manufacturer: stringOrEmpty(query.manufacturer),
    ipName: stringOrEmpty(query.ipName),
    characterName: stringOrEmpty(query.characterName),
    category: stringOrEmpty(query.category),
    year: numberOrUndefined(query.year),
    priceMin: numberOrUndefined(query.priceMin),
    priceMax: numberOrUndefined(query.priceMax),
    delayed: query.delayed === 'true' || query.delayed === true,
    page: numberOrUndefined(query.page) ?? 1,
    pageSize: numberOrUndefined(query.pageSize) ?? 20,
  }
}

export function toQuery(filters: OrderFilterState): Record<string, string> {
  const query: Record<string, string> = {}
  const pick = (key: keyof OrderFilterState, value: unknown) => {
    if (value === undefined || value === null || value === '' || value === false) return
    query[String(key)] = String(value)
  }
  pick('tab', filters.tab === 'ALL' ? '' : filters.tab)
  pick('keyword', filters.keyword)
  pick('paymentSummaryStatus', filters.paymentSummaryStatus)
  pick('platformId', filters.platformId)
  pick('storeId', filters.storeId)
  pick('manufacturer', filters.manufacturer)
  pick('ipName', filters.ipName)
  pick('characterName', filters.characterName)
  pick('category', filters.category)
  pick('year', filters.year)
  pick('priceMin', filters.priceMin)
  pick('priceMax', filters.priceMax)
  pick('delayed', filters.delayed ? 'true' : '')
  pick('page', filters.page > 1 ? filters.page : '')
  pick('pageSize', filters.pageSize !== 20 ? filters.pageSize : '')
  return query
}

export function useOrderFilters() {
  const route = useRoute()
  const router = useRouter()
  const filters = reactive<OrderFilterState>(parseFiltersFromQuery(route.query))

  const query = computed(() => toQuery(filters))

  async function syncToRoute(extra: Partial<OrderFilterState> = {}): Promise<void> {
    Object.assign(filters, extra)
    await router.replace({ query })
  }

  async function reset(): Promise<void> {
    Object.assign(filters, DEFAULT_ORDER_FILTERS)
    await router.replace({ query: {} })
  }

  async function setTab(tab: string): Promise<void> {
    await syncToRoute({ tab, page: 1 })
  }

  return { filters, query, parseFiltersFromQuery, toQuery, syncToRoute, reset, setTab }
}
```

`src/composables/useOrderFilters.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_ORDER_FILTERS, parseFiltersFromQuery, toQuery } from './useOrderFilters'

describe('parseFiltersFromQuery', () => {
  it('空 query 返回默认值', () => {
    expect(parseFiltersFromQuery({})).toEqual(DEFAULT_ORDER_FILTERS)
  })

  it('解析字符串数字与布尔', () => {
    const filters = parseFiltersFromQuery({ tab: 'WAITING_PAYMENT', year: '2026', page: '2', delayed: 'true' })
    expect(filters.tab).toBe('WAITING_PAYMENT')
    expect(filters.year).toBe(2026)
    expect(filters.page).toBe(2)
    expect(filters.delayed).toBe(true)
  })

  it('非法数字回退默认', () => {
    expect(parseFiltersFromQuery({ page: 'abc' }).page).toBe(1)
  })
})

describe('toQuery', () => {
  it('默认值不进 URL', () => {
    expect(toQuery(DEFAULT_ORDER_FILTERS)).toEqual({})
  })

  it('写入非默认值', () => {
    expect(
      toQuery({ ...DEFAULT_ORDER_FILTERS, tab: 'IN_TRANSIT', keyword: '芙宁娜', page: 2 }),
    ).toEqual({ tab: 'IN_TRANSIT', keyword: '芙宁娜', page: '2' })
  })
})
```

`src/composables/usePaymentSummary.ts`（表单预览用，列表/详情以服务端为准）：

```ts
import { computed, type ComputedRef, type Ref } from 'vue'
import { netPaid, nextPaymentOf, progress, sumPaid, sumPending } from '@/utils/payment'
import type { PaymentFormLike } from '@/utils/payment'

export interface PaymentSummary {
  paidAmount: number
  pendingAmount: number
  refundAmount: number
  netPaidAmount: number
  progress: number
  nextPayment: PaymentFormLike | null
}

export function usePaymentSummary(
  payments: Ref<PaymentFormLike[]> | ComputedRef<PaymentFormLike[]>,
  totalAmount: Ref<number> | ComputedRef<number>,
): ComputedRef<PaymentSummary> {
  return computed(() => ({
    paidAmount: sumPaid(payments.value),
    pendingAmount: sumPending(payments.value),
    refundAmount: sumPaid(payments.value.filter(payment => payment.type === 'REFUND')),
    netPaidAmount: netPaid(payments.value),
    progress: progress(payments.value, totalAmount.value),
    nextPayment: nextPaymentOf(payments.value),
  }))
}
```

`src/composables/useOrderForm.ts`（`docs/06 §65`）：`form` 为 `reactive<OrderFormModel>`；`summary` 复用 `usePaymentSummary`；`setPaymentMode(mode)` 调 `defaultPaymentsFor(mode, totalAmount)`；`toPayload()` 输出 `CreateOrderPayload`；`validate()` 用 Zod 校验「至少一个商品」「金额非负」「付款节点至少一个」「定金 ≤ 总额时给出 warning 而非错误」。`OrderFormModel` 定义在 `src/types/forms.ts`，与 `docs/05 §5` 一致：

```ts
export interface OrderItemForm { productId: string; name: string; coverUrl: string | null; quantity: number; unitPrice: number }
export interface PaymentFormItem {
  type: string; name?: string; amount: number | null; status: 'PENDING' | 'PAID'
  expectedAt?: string; dueAt?: string; paidAt?: string; paymentMethod?: string; note?: string
}
export interface OrderFormModel {
  items: OrderItemForm[]
  platformId: string
  storeId: string
  orderNo: string
  orderUrl: string
  orderedAt: string
  currency: string
  autoCalculateGoodsAmount: boolean
  goodsAmount: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  extraAmount: number
  paymentMode: string
  payments: PaymentFormItem[]
  useExpectedRelease: boolean
  releaseDate: string
  releaseDatePrecision: 'DAY' | 'MONTH'
  note: string
}
```

- [ ] **Step 4: 验证并提交**

Run: `pnpm --filter @hobilog/web test && pnpm --filter @hobilog/web typecheck`

Expected: `payment.spec.ts`、`order-form.spec.ts`、`useOrderFilters.spec.ts` 全 PASS。

```bash
git add apps/web/src/utils apps/web/src/composables apps/web/src/types/forms.ts
git commit -m "feat(web): add payment/order-form utils and order composables"
```

---

### Task 6: 商品库页面

**Files:**
- Create: `apps/web/src/components/product/ProductFilterBar.vue`
- Create: `apps/web/src/components/product/ProductCard.vue`
- Create: `apps/web/src/components/product/ProductFormDrawer.vue`
- Modify: `apps/web/src/pages/products/index.vue`
- Modify: `apps/web/src/pages/products/detail.vue`

**Interfaces:**
- Consumes: `product.api.ts`、`AppPageHeader`、`AppImage`、`AppCurrency`、`AppEmpty`、`AppErrorState`
- Produces: `ProductCard`（props `product`，emits `click`、`edit`）；`ProductFormDrawer`（props `modelValue`、`product?`，emits `update:modelValue`、`saved`）；`ProductFilterBar`（props `modelValue`，emits `update:modelValue`、`search`、`reset`）

- [ ] **Step 1: 写 `ProductFilterBar.vue` 与 `ProductCard.vue`**

`ProductFilterBar`：关键词输入 + 分类下拉（`PRODUCT_CATEGORY_LABELS`）+ 厂商输入 + 「更多筛选」按钮（`el-drawer` 内放 IP / 角色 / 状态）。watch `modelValue` 触发 `search`（debounce 300ms，用 `@vueuse/core` 的 `useDebounceFn`）。

`ProductCard.vue`：

```vue
<script setup lang="ts">
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppImage from '@/components/common/AppImage.vue'
import { PRODUCT_CATEGORY_LABELS } from '@hobilog/shared'
import type { ProductVo } from '@/types/models'

const props = defineProps<{ product: ProductVo }>()
const emit = defineEmits<{ click: [id: string]; edit: [id: string] }>()
</script>

<template>
  <div class="app-card product-card" @click="emit('click', props.product.id)">
    <AppImage :src="props.product.coverUrl" :alt="props.product.name" ratio="4 / 5" />
    <div class="product-card__title">{{ props.product.name }}</div>
    <div class="product-card__meta">
      <span>{{ PRODUCT_CATEGORY_LABELS[props.product.category as keyof typeof PRODUCT_CATEGORY_LABELS] ?? props.product.category }}</span>
      <span v-if="props.product.manufacturer">· {{ props.product.manufacturer }}</span>
    </div>
    <div class="product-card__meta">
      <span v-if="props.product.ipName">{{ props.product.ipName }}</span>
      <span v-if="props.product.characterName">· {{ props.product.characterName }}</span>
    </div>
    <div class="product-card__price">
      <AppCurrency :amount="props.product.officialPrice" :currency="props.product.officialCurrency ?? 'CNY'" />
    </div>
    <el-button link type="primary" @click.stop="emit('edit', props.product.id)">编辑</el-button>
  </div>
</template>
```

（`ProductVo` 加到 `src/types/models.ts`：字段与 P2 服务端 `ProductVo` 一致，`officialPrice: number | null`、`tagIds: string[]`。）

- [ ] **Step 2: 写 `pages/products/index.vue`（Page 负责取数）**

```vue
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createProduct, getProductList, updateProduct } from '@/api/product.api'
import { queryKeys } from '@/api/query-keys'
import AppEmpty from '@/components/common/AppEmpty.vue'
import AppErrorState from '@/components/common/AppErrorState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import ProductCard from '@/components/product/ProductCard.vue'
import ProductFilterBar from '@/components/product/ProductFilterBar.vue'
import ProductFormDrawer from '@/components/product/ProductFormDrawer.vue'

const router = useRouter()
const filters = ref({ page: 1, pageSize: 24, keyword: '', category: '', manufacturer: '' })
const drawerVisible = ref(false)
const editingId = ref<string | null>(null)

const params = computed(() => ({ ...filters.value }))
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: queryKeys.products.list(params.value),
  queryFn: () => getProductList(params.value),
})

async function onSave(payload: Record<string, unknown>): Promise<void> {
  if (editingId.value) {
    await updateProduct(editingId.value, payload)
  } else {
    await createProduct(payload)
  }
  drawerVisible.value = false
  editingId.value = null
  await refetch()
}
</script>

<template>
  <div>
    <AppPageHeader title="商品库" description="手办 / GK / 周边的商品资料">
      <template #actions>
        <el-button type="primary" @click="drawerVisible = true">新建商品</el-button>
      </template>
    </AppPageHeader>

    <ProductFilterBar v-model="filters" @search="refetch" @reset="filters = { page: 1, pageSize: 24, keyword: '', category: '', manufacturer: '' }" />

    <AppErrorState v-if="isError" @retry="refetch" />
    <el-skeleton v-else-if="isLoading" :rows="6" />
    <AppEmpty
      v-else-if="!data || data.items.length === 0"
      title="还没有商品"
      description="先创建商品，再把它加入订单。"
      action-text="新建商品"
      @action="drawerVisible = true"
    />
    <div v-else class="product-grid">
      <ProductCard
        v-for="product in data.items"
        :key="product.id"
        :product="product"
        @click="id => router.push(`/products/${id}`)"
        @edit="id => { editingId = id; drawerVisible = true }"
      />
    </div>

    <ProductFormDrawer v-model="drawerVisible" :product-id="editingId" @saved="onSave" />
  </div>
</template>

<style scoped>
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
</style>
```

- [ ] **Step 3: 写 `ProductFormDrawer.vue` 与 `pages/products/detail.vue`**

`ProductFormDrawer`：`el-drawer` + `el-form`，字段按 `docs/06 §23`：名称（必填）、封面（上传走 Task 10 的附件流程，V0.1 先支持粘贴 URL）、商品类型、IP、角色、厂商、系列、比例、版本、SKU、官方价格 + 币种、官方发售时间、精度、描述、标签（`el-select` 多选允许自定义）。提交前用 Zod 校验 `name` 非空、`officialPrice >= 0`。

`pages/products/detail.vue`：展示商品资料 + 相关订单列表（调 `getOrderList({ keyword: product.name })` 拿到本商品的订单，V0.1 可接受）+ 购买次数 + 累计金额（对返回的订单做纯计算 `sumPaid` 汇总，多币种分开显示）。

- [ ] **Step 4: 验证并提交**

Run: `pnpm --filter @hobilog/web typecheck && pnpm --filter @hobilog/web build`

```bash
git add apps/web/src/components/product apps/web/src/pages/products
git commit -m "feat(web): add product list, card, form drawer and detail page"
```

---

### Task 7: 订单创建页（核心链路 1/3）

**Files:**
- Create: `apps/web/src/components/order/form/OrderProductSection.vue`
- Create: `apps/web/src/components/order/form/OrderProductItem.vue`
- Create: `apps/web/src/components/order/form/ProductSelectorDrawer.vue`
- Create: `apps/web/src/components/order/form/ProductQuickCreateDrawer.vue`
- Create: `apps/web/src/components/order/form/OrderInfoSection.vue`
- Create: `apps/web/src/components/order/form/AmountSection.vue`
- Create: `apps/web/src/components/payment/PaymentModeSelector.vue`
- Create: `apps/web/src/components/payment/PaymentSection.vue`
- Create: `apps/web/src/components/payment/PaymentNodeCard.vue`
- Create: `apps/web/src/components/payment/PaymentSummary.vue`
- Create: `apps/web/src/components/order/form/ReleaseSection.vue`
- Create: `apps/web/src/components/order/form/OrderSummaryAside.vue`
- Create: `apps/web/src/components/order/OrderForm.vue`
- Modify: `apps/web/src/pages/orders/create.vue`
- Modify: `apps/web/src/pages/orders/edit.vue`

**Interfaces:**
- Consumes: `useOrderForm`、`product.api`、`platform.api`、`store.api`、`order.api`
- Produces: `OrderForm`（props `modelValue: OrderFormModel`、`mode: 'create' | 'edit'`、`loading?: boolean`；emits `update:modelValue`、`submit`、`cancel`）；子组件契约见 `docs/06 §21-§35`

- [ ] **Step 1: 写 `ProductSelectorDrawer.vue` 与 `OrderProductSection.vue`**

`ProductSelectorDrawer`：props `{ modelValue: boolean; selectedIds?: string[] }`，emits `update:modelValue`、`select`、`create`。内部 `useQuery` 拉起商品列表（关键词 / 分类 / 厂商筛选 + 「最近商品」= 按 `createdAt desc` 首页），多选后 emit `select(items)`。

`OrderProductSection`：渲染 `OrderProductItem × N`（数量步进、本次单价、小计、删除、上下移动），底部「+ 添加商品」打开 `ProductSelectorDrawer`，旁边「快速创建」打开 `ProductQuickCreateDrawer`（字段见 `docs/06 §23`，成功后把新商品直接 `emit('select', [created])`）。

- [ ] **Step 2: 写 `PaymentSection` 与四个编辑器**

```text
PaymentSection
├─ PaymentModeSelector    （Radio Card：全款 / 定金+尾款 / 多阶段 / 自定义）
├─ PaymentEditor（按 mode 切换）
│  ├─ FullPaymentEditor        FULL：金额默认 = 订单总额
│  ├─ DepositBalanceEditor     DEPOSIT_BALANCE：输入定金后尾款自动 = 总额 - 定金，可手改
│  ├─ InstallmentPaymentEditor INSTALLMENT：PaymentNodeCard × N + 添加节点（上移/下移/复制/删除）
│  └─ CustomPaymentEditor      CUSTOM：任意类型组合（含补邮、税费、补差价）
└─ PaymentSummary     （总额 / 节点合计 / 已支付 / 待支付 / 差额；差额 ≠ 0 时 warning，不阻止保存）
```

`PaymentNodeCard`：props `{ node: PaymentFormItem; index: number }`，emits `update`、`remove`、`move`。含「金额待定」开关 → `amount = null`（`docs/03 §26`）。

排序 V0.1 用上移/下移按钮（`docs/06 §31` 允许先不用拖拽），SortableJS 留到后续。

- [ ] **Step 3: 写 `AmountSection` / `OrderInfoSection` / `ReleaseSection` / `OrderSummaryAside`**

- `AmountSection`：商品金额 / 优惠 / 运费 / 税费 / 其他费用 + 「自动计算商品金额」开关；订单总额只读并实时 `calcTotalAmount`。
- `OrderInfoSection`：平台 → 店铺联动（平台变化时重新拉 `getStoreList({ platformId })`）、订单号、订单链接、下单日期、币种（`SUPPORTED_CURRENCIES`）；无店铺时提供「快速创建店铺」内联表单。
- `ReleaseSection`：「是否记录预计出货」开关 + 日期 + 精度（默认 `MONTH`）。
- `OrderSummaryAside`：`position: sticky; top: 20px`，展示商品数量、金额分项、总金额、已支付、待支付、差额，底部「保存订单」按钮（`loading` 来自 props）。

- [ ] **Step 4: 写 `OrderForm.vue` 与页面**

`src/components/order/OrderForm.vue`:

```vue
<script setup lang="ts">
import OrderInfoSection from './form/OrderInfoSection.vue'
import AmountSection from './form/AmountSection.vue'
import OrderProductSection from './form/OrderProductSection.vue'
import OrderSummaryAside from './form/OrderSummaryAside.vue'
import ReleaseSection from './form/ReleaseSection.vue'
import PaymentSection from '@/components/payment/PaymentSection.vue'
import type { OrderFormModel } from '@/types/forms'

const props = withDefaults(
  defineProps<{ modelValue: OrderFormModel; mode: 'create' | 'edit'; loading?: boolean }>(),
  { loading: false },
)

const emit = defineEmits<{ 'update:modelValue': [OrderFormModel]; submit: []; cancel: [] }>()

function patch(part: Partial<OrderFormModel>): void {
  emit('update:modelValue', { ...props.modelValue, ...part })
}
</script>

<template>
  <div class="order-form">
    <div class="order-form__main">
      <OrderProductSection :items="modelValue.items" @change="items => patch({ items })" />
      <OrderInfoSection :model-value="modelValue" @change="patch" />
      <AmountSection :model-value="modelValue" @change="patch" />
      <PaymentSection :model-value="modelValue" @change="patch" />
      <ReleaseSection :model-value="modelValue" @change="patch" />
    </div>
    <OrderSummaryAside
      :model-value="modelValue"
      :mode="mode"
      :loading="loading"
      @submit="emit('submit')"
      @cancel="emit('cancel')"
    />
  </div>
</template>

<style scoped>
.order-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
}

.order-form__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1024px) {
  .order-form {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
```

`src/pages/orders/create.vue`:

```vue
<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createOrder } from '@/api/order.api'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import OrderForm from '@/components/order/OrderForm.vue'
import { useOrderForm } from '@/composables/useOrderForm'

const router = useRouter()
const { form, toPayload, validate } = useOrderForm()
const submitting = ref(false)

async function onSubmit(): Promise<void> {
  const result = validate()
  if (!result.ok) {
    ElMessage.error(result.message)
    return
  }
  submitting.value = true
  try {
    const order = await createOrder(toPayload())
    ElMessage.success('订单已创建')
    await router.replace(`/orders/${order.id}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <AppPageHeader title="新建订单" description="记录一次实际购买">
      <template #actions>
        <el-button @click="router.back()">返回</el-button>
      </template>
    </AppPageHeader>
    <OrderForm v-model="form" mode="create" :loading="submitting" @submit="onSubmit" @cancel="router.back()" />
  </div>
</template>
```

`src/pages/orders/edit.vue`：`useQuery` 取详情 → `useOrderForm(mapDetailToFormModel(detail))` → `updateOrder(id, toPayload())`；**货币、付款节点不在编辑页修改**（付款节点走详情页操作），因此编辑页的 `PaymentSection` 以 `mode="edit"` 只读展示。

（`ref` / `useState` 混用为笔误，实现时统一用 `import { ref } from 'vue'`。）

- [ ] **Step 5: 验证并提交**

Run: `pnpm --filter @hobilog/web typecheck && pnpm --filter @hobilog/web build`

手工冒烟：`pnpm dev:server` + `pnpm --filter @hobilog/web dev`，登录后走到 `/orders/create`，添加商品、切换付款模式、填写金额，确认右侧摘要实时更新。

```bash
git add apps/web/src/components/order apps/web/src/components/payment apps/web/src/pages/orders
git commit -m "feat(web): add order create form with product selector and payment editor"
```

`src/pages/orders/edit.vue`：`useQuery` 取详情 → `useOrderForm(mapDetailToFormModel(detail))` → `updateOrder(id, toPayload())`；**货币、付款节点不在编辑页修改**（付款节点走详情页操作），因此编辑页的 `PaymentSection` 以 `mode="edit"` 只读展示。

- [ ] **Step 5: 验证并提交**

Run: `pnpm --filter @hobilog/web typecheck && pnpm --filter @hobilog/web build`

手工冒烟：`pnpm dev:server` + `pnpm --filter @hobilog/web dev`，登录后走到 `/orders/create`，添加商品、切换付款模式、填写金额，确认右侧摘要实时更新。

```bash
git add apps/web/src/components/order apps/web/src/components/payment apps/web/src/pages/orders
git commit -m "feat(web): add order create form with product selector and payment editor"
```

---

### Task 8: 订单列表页（核心链路 2/3）

**Files:**
- Create: `apps/web/src/components/order/OrderQuickTabs.vue`
- Create: `apps/web/src/components/order/OrderFilterBar.vue`
- Create: `apps/web/src/components/order/OrderViewSwitch.vue`
- Create: `apps/web/src/components/order/OrderTable.vue`
- Create: `apps/web/src/components/order/OrderGrid.vue`
- Create: `apps/web/src/components/order/OrderCard.vue`
- Create: `apps/web/src/components/order/OrderProductSummary.vue`
- Create: `apps/web/src/components/payment/PaymentProgress.vue`
- Create: `apps/web/src/components/release/ReleaseSummary.vue`
- Create: `apps/web/src/components/shipment/ShipmentSummary.vue`
- Create: `apps/web/src/stores/view-preference.ts`
- Modify: `apps/web/src/pages/orders/index.vue`

**Interfaces:**
- Consumes: `useOrderFilters`、`order.api`、`queryKeys`、`AppStatusTag`
- Produces:
  - `OrderQuickTabs`（props `modelValue: string`、`counts?: Record<string, number>`；emits `update:modelValue`）
  - `OrderViewSwitch`（props `modelValue: 'table' | 'grid'`；emits `update:modelValue`，写 `localStorage`）
  - `OrderTable`（props `items: OrderListItem[]`、`loading?: boolean`；emits `view`、`edit`、`mark-payment`、`update-release`、`add-shipment`）
  - `OrderGrid` / `OrderCard`（emits `click`、`quick-action`）

- [ ] **Step 1: 写 `OrderQuickTabs.vue` 与视图偏好 store**

```vue
<script setup lang="ts">
const props = defineProps<{ modelValue: string; counts?: Record<string, number> }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const tabs = [
  { label: '全部', value: 'ALL' },
  { label: '待付款', value: 'WAITING_PAYMENT' },
  { label: '待出货', value: 'WAITING_RELEASE' },
  { label: '运输中', value: 'IN_TRANSIT' },
  { label: '已完成', value: 'COMPLETED' },
]
</script>

<template>
  <div class="order-quick-tabs">
    <el-button
      v-for="tab in tabs"
      :key="tab.value"
      :type="props.modelValue === tab.value ? 'primary' : 'default'"
      round
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
      <span v-if="props.counts?.[tab.value] !== undefined">&nbsp;{{ props.counts[tab.value] }}</span>
    </el-button>
  </div>
</template>
```

`src/stores/view-preference.ts`（`docs/06 §14`：视图偏好可存 localStorage 或 Pinia，这里两者结合）：

```ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'hobilog:order-view'

export const useViewPreferenceStore = defineStore('view-preference', () => {
  const orderView = ref<'table' | 'grid'>(
    (localStorage.getItem(STORAGE_KEY) as 'table' | 'grid' | null) ?? 'table',
  )

  watch(orderView, value => localStorage.setItem(STORAGE_KEY, value))

  function setOrderView(value: 'table' | 'grid'): void {
    orderView.value = value
  }

  return { orderView, setOrderView }
})
```

- [ ] **Step 2: 写 `OrderTable.vue`（8 列）**

列：商品（`OrderProductSummary`）、平台/店铺、订单金额（`AppCurrency`）、付款（`PaymentProgress`）、预计出货（`ReleaseSummary`）、物流（`ShipmentSummary`）、下单时间（`AppDate`）、操作（详情 / 编辑 / 标记付款 / 更新出货 / 添加物流）。

```vue
<template>
  <el-table :data="props.items" v-loading="props.loading" row-key="id" @row-click="row => emit('view', row.id)">
    <el-table-column label="商品" min-width="220">
      <template #default="{ row }">
        <OrderProductSummary :order="row" />
      </template>
    </el-table-column>
    <el-table-column label="平台 / 店铺" min-width="160">
      <template #default="{ row }">
        <div>{{ row.platformName ?? '—' }}</div>
        <div class="text-secondary">{{ row.storeName ?? '—' }}</div>
      </template>
    </el-table-column>
    <el-table-column label="订单金额" width="140">
      <template #default="{ row }">
        <AppCurrency :amount="row.totalAmount" :currency="row.currency" />
      </template>
    </el-table-column>
    <el-table-column label="付款" min-width="180">
      <template #default="{ row }">
        <PaymentProgress
          :total-amount="row.totalAmount"
          :paid-amount="row.paymentSummary.paidAmount"
          :pending-amount="row.paymentSummary.pendingAmount"
          :refunded-amount="row.paymentSummary.refundAmount"
          :currency="row.currency"
          :next-payment="row.paymentSummary.nextPayment"
        />
      </template>
    </el-table-column>
    <el-table-column label="预计出货" min-width="150">
      <template #default="{ row }">
        <ReleaseSummary :summary="row.releaseSummary" />
      </template>
    </el-table-column>
    <el-table-column label="物流" min-width="150">
      <template #default="{ row }">
        <ShipmentSummary :summary="row.shipmentSummary" />
      </template>
    </el-table-column>
    <el-table-column label="下单时间" width="120">
      <template #default="{ row }">
        <AppDate :value="row.orderedAt" />
      </template>
    </el-table-column>
    <el-table-column label="操作" width="200" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary" @click.stop="emit('view', row.id)">详情</el-button>
        <el-button link @click.stop="emit('edit', row.id)">编辑</el-button>
        <el-dropdown @command="command => emit(command, row.id)">
          <el-button link>更多</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="mark-payment">标记付款</el-dropdown-item>
              <el-dropdown-item command="update-release">更新出货</el-dropdown-item>
              <el-dropdown-item command="add-shipment">添加物流</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </el-table-column>
  </el-table>
</template>
```

`PaymentProgress.vue`（`docs/06 §40`）：

```vue
<script setup lang="ts">
import AppCurrency from '@/components/common/AppCurrency.vue'
import type { OrderPaymentSummary } from '@/types/models'

const props = defineProps<{
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  refundedAmount?: number
  currency: string
  nextPayment?: OrderPaymentSummary['nextPayment']
}>()
</script>

<template>
  <div class="payment-progress">
    <div class="payment-progress__amount">
      <AppCurrency :amount="props.paidAmount" :currency="props.currency" />
      <span class="text-secondary"> / <AppCurrency :amount="props.totalAmount" :currency="props.currency" /></span>
    </div>
    <el-progress
      :percentage="props.totalAmount > 0 ? Math.min(100, Math.round((props.paidAmount / props.totalAmount) * 100)) : 0"
      :show-text="false"
      :stroke-width="6"
    />
    <div v-if="props.nextPayment" class="payment-progress__next">
      {{ props.nextPayment.type === 'BALANCE' ? '尾款' : props.nextPayment.type }}
      <AppCurrency :amount="props.nextPayment.amount" :currency="props.currency" />
      <span v-if="props.nextPayment.dueAt"> · <AppDate :value="props.nextPayment.dueAt" /></span>
      <span v-if="props.nextPayment.isOverdue" class="text-danger"> · 已逾期 {{ props.nextPayment.overdueDays }} 天</span>
    </div>
  </div>
</template>
```

`ReleaseSummary.vue`：显示 `plannedDate`（按 `precision` 走 `AppDate`）+ 延期标签（`delayMonths > 0` → `el-tag type="warning"` 显示「延期 N 个月」，`docs/01 §12`）。

`ShipmentSummary.vue`：`status` 走 `AppStatusTag`，带 `carrier trackingNo`；`inTransitCount > 1` 显示「N 个包裹运输中」。

- [ ] **Step 3: 写 `pages/orders/index.vue`**

```vue
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getOrderList } from '@/api/order.api'
import { queryKeys } from '@/api/query-keys'
import AppEmpty from '@/components/common/AppEmpty.vue'
import AppErrorState from '@/components/common/AppErrorState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import OrderFilterBar from '@/components/order/OrderFilterBar.vue'
import OrderGrid from '@/components/order/OrderGrid.vue'
import OrderQuickTabs from '@/components/order/OrderQuickTabs.vue'
import OrderTable from '@/components/order/OrderTable.vue'
import OrderViewSwitch from '@/components/order/OrderViewSwitch.vue'
import { useOrderFilters } from '@/composables/useOrderFilters'
import { useViewPreferenceStore } from '@/stores/view-preference'

const router = useRouter()
const viewPreference = useViewPreferenceStore()
const { filters, syncToRoute, reset, setTab } = useOrderFilters()
const detailDrawer = ref<{ visible: boolean; orderId: string | null }>({ visible: false, orderId: null })

const params = computed(() => ({
  ...filters,
  keyword: filters.keyword || undefined,
  platformId: filters.platformId || undefined,
  storeId: filters.storeId || undefined,
  paymentSummaryStatus: filters.paymentSummaryStatus || undefined,
}))

const { data, isLoading, isError, refetch } = useQuery({
  queryKey: queryKeys.orders.list(params.value),
  queryFn: () => getOrderList(params.value),
})

function onQuickAction(action: string, id: string): void {
  detailDrawer.value = { visible: true, orderId: id }
  void action
}
</script>

<template>
  <div>
    <AppPageHeader title="订单" description="管理所有正在等待到家的收藏">
      <template #actions>
        <el-button type="primary" @click="router.push('/orders/create')">新建订单</el-button>
      </template>
    </AppPageHeader>

    <OrderQuickTabs :model-value="filters.tab" @update:model-value="setTab" />
    <OrderFilterBar v-model="filters" @search="refetch" @reset="reset" />
    <div class="orders-toolbar">
      <span class="text-secondary">共 {{ data?.total ?? 0 }} 条</span>
      <OrderViewSwitch
        :model-value="viewPreference.orderView"
        @update:model-value="viewPreference.setOrderView"
      />
    </div>

    <AppErrorState v-if="isError" @retry="refetch" />
    <el-skeleton v-else-if="isLoading" :rows="8" />
    <AppEmpty
      v-else-if="!data || data.items.length === 0"
      title="还没有任何订单"
      description="把第一件正在等到家的收藏记录下来吧。"
      action-text="创建订单"
      @action="router.push('/orders/create')"
    />
    <template v-else>
      <OrderTable
        v-if="viewPreference.orderView === 'table'"
        :items="data.items"
        @view="id => router.push(`/orders/${id}`)"
        @edit="id => router.push(`/orders/${id}/edit`)"
        @mark-payment="id => onQuickAction('mark-payment', id)"
        @update-release="id => onQuickAction('update-release', id)"
        @add-shipment="id => onQuickAction('add-shipment', id)"
      />
      <OrderGrid v-else :items="data.items" @click="id => router.push(`/orders/${id}`)" @quick-action="onQuickAction" />

      <el-pagination
        class="orders-pagination"
        layout="prev, pager, next, sizes"
        :total="data.total"
        :current-page="filters.page"
        :page-size="filters.pageSize"
        @current-change="page => syncToRoute({ page })"
        @size-change="pageSize => syncToRoute({ pageSize, page: 1 })"
      />
    </template>
  </div>
</template>
```

`OrderFilterBar` 契约：props `modelValue: OrderFilterState`，emits `update:modelValue`、`search`、`reset`；包含关键词、付款状态（`PAYMENT_SUMMARY_STATUSES`）、平台、店铺、出货状态，以及「更多筛选」`el-drawer`（IP / 角色 / 厂商 / 商品类型 / 年份 / 价格区间 / 是否延期），筛选变化写回 URL（`docs/03 §21`：`/orders?paymentSummaryStatus=PENDING&platformId=xxx&page=2`）。

- [ ] **Step 4: 验证并提交**

Run: `pnpm --filter @hobilog/web typecheck && pnpm --filter @hobilog/web build`

手工冒烟：切换到卡片视图 → 刷新页面确认偏好保留；改筛选条件 → 确认 URL query 同步、返回可复原。

```bash
git add apps/web/src/components/order apps/web/src/components/payment/PaymentProgress.vue apps/web/src/components/release apps/web/src/components/shipment apps/web/src/stores apps/web/src/pages/orders/index.vue
git commit -m "feat(web): add order list with tabs, filters, table and card views"
```

---

### Task 9: 订单详情页（核心链路 3/3）

**Files:**
- Create: `apps/web/src/components/order/detail/OrderDetailHeader.vue`
- Create: `apps/web/src/components/order/detail/PaymentDetailSection.vue`
- Create: `apps/web/src/components/payment/PaymentDetailCard.vue`
- Create: `apps/web/src/components/payment/MarkPaymentPaidDialog.vue`
- Create: `apps/web/src/components/payment/RefundPaymentDialog.vue`
- Create: `apps/web/src/components/release/ReleaseDetailSection.vue`
- Create: `apps/web/src/components/release/ReleaseDelayDialog.vue`
- Create: `apps/web/src/components/release/ReleaseTimeline.vue`
- Create: `apps/web/src/components/shipment/ShipmentDetailSection.vue`
- Create: `apps/web/src/components/shipment/ShipmentCard.vue`
- Create: `apps/web/src/components/shipment/ShipmentFormDrawer.vue`
- Create: `apps/web/src/components/order/detail/OrderTimeline.vue`
- Create: `apps/web/src/components/order/detail/OrderOverviewAside.vue`
- Create: `apps/web/src/components/attachment/AttachmentSection.vue`
- Modify: `apps/web/src/pages/orders/detail.vue`

**Interfaces:**
- Consumes: `order.api`、`payment.api`、`release.api`、`shipment.api`、`attachment.api`、`useMutation`（TanStack Query）
- Produces: 详情页四类操作的完整闭环：标记付款 / 退款 / 延期 / 厂商出货 / 添加物流 / 签收 / 附件

- [ ] **Step 1: 写 `OrderDetailHeader.vue` 与 `OrderOverviewAside.vue`**

`OrderDetailHeader`：props `{ order: OrderDetail }`；展示主商品名、平台 · 店铺、`AppStatusTag`（用 `displayStatus` + `displayStatusLabel`）；操作「编辑」+「更多」（复制订单 / 取消订单 / 归档 / 删除）。取消订单走 `AppConfirm` + `cancelOrder(id, { refund, note })`。

`OrderOverviewAside`：右侧卡片（`docs/06 §50`）——状态、总金额、已支付、待支付、退款、下一付款、预计出货、平台、店铺、订单号、下单时间；快捷操作按钮「标记付款」「更新出货」「添加物流」，分别 emit 给页面打开对应 Dialog/Drawer。

- [ ] **Step 2: 写付款区块与两个 Dialog**

`PaymentDetailSection`：`PaymentProgress` + `PaymentList`（`PaymentDetailCard × N`，按 `sortOrder ASC`）+ 「+ 添加付款」。

`PaymentDetailCard` 按状态给操作（`docs/06 §42`）：

```text
PENDING（含动态逾期）  标记已付款 / 编辑 / 删除
PAID                  查看付款信息 / 退款 / 编辑备注
PARTIALLY_REFUNDED    查看付款信息 / 继续退款
REFUNDED / CANCELLED  只读
```

`MarkPaymentPaidDialog`：字段「计划金额（只读）」「实际付款金额」「付款时间」「支付方式」「交易号」「备注」；当实际 > 计划时显示「将创建补差价 ¥X」提示，并给出「是否创建补差价」开关（默认开，对应 `createSupplement`）。提交调 `markPaymentPaid(id, payload)`。

`RefundPaymentDialog`：字段「退款金额」（默认 = 节点金额 − 已退款）「退款时间」「退款方式」「备注」「是否回写原节点状态」（对应 `markOriginal`）。提交调 `refundPayment(id, payload)`。

- [ ] **Step 3: 写出货区块、时间轴与 `ShipmentFormDrawer`**

`ReleaseDetailSection`：当前预计出货（`precision` 决定显示粒度）、累计延期 `delayMonths` 个月、厂商出货状态、店铺到货状态、`ReleaseTimeline`；操作「更新预计出货」「标记厂商出货」「标记店铺到货」「开启补款」。

`ReleaseDelayDialog`：当前预计（只读）/ 新预计 / 精度 / 来源 / 来源链接 / 备注；实时显示「延期 N 个月」（月份差，`docs/03 §31`）；提交调 `delayRelease`。

`ReleaseTimeline`：按 `occurredAt ASC` 渲染 `EXPECTED_RELEASE → DELAY → RELEASED → STORE_ARRIVED`，DELAY 项显示 `oldDate → newDate`（**保留历史，不合并**）。

`OrderTimeline`（`docs/06 §49`）：props `{ items: TimelineItem[] }`，按 `source` 做轻微颜色区分（PAYMENT / RELEASE / SHIPMENT / ORDER），展示时间、标题、描述。数据直接用服务端返回的 `order.timeline`（方案 A：只映射实体时间字段）。

`ShipmentFormDrawer`：物流公司、物流单号、发货时间、预计到货、包含商品（多选 `order.items`，数量可调，前端校验「跨 Shipment 合计 ≤ 订单数量」）、备注；提交调 `createShipment`。`ShipmentCard` 操作「更新状态」「标记签收」「编辑」「删除」。

- [ ] **Step 4: 写 `pages/orders/detail.vue` 并接好失效刷新**

```vue
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { cancelOrder, getOrderDetail, updateOrder } from '@/api/order.api'
import { markPaymentPaid, refundPayment } from '@/api/payment.api'
import { deliverShipment, createShipment } from '@/api/shipment.api'
import { delayRelease, markReleased, markStoreArrived, openBalance } from '@/api/release.api'
import { queryKeys } from '@/api/query-keys'
import AppErrorState from '@/components/common/AppErrorState.vue'
import OrderDetailHeader from '@/components/order/detail/OrderDetailHeader.vue'
import OrderOverviewAside from '@/components/order/detail/OrderOverviewAside.vue'
import OrderTimeline from '@/components/order/detail/OrderTimeline.vue'
import PaymentDetailSection from '@/components/order/detail/PaymentDetailSection.vue'
import ReleaseDetailSection from '@/components/release/ReleaseDetailSection.vue'
import ShipmentDetailSection from '@/components/shipment/ShipmentDetailSection.vue'
import AttachmentSection from '@/components/attachment/AttachmentSection.vue'

const route = useRoute()
const queryClient = useQueryClient()
const orderId = computed(() => String(route.params.id))

const { data: order, isLoading, isError, refetch } = useQuery({
  queryKey: queryKeys.orders.detail(orderId.value),
  queryFn: () => getOrderDetail(orderId.value),
})

const dialog = ref<{ markPaid: string | null; refund: string | null; delay: boolean; release: boolean }>({
  markPaid: null,
  refund: null,
  delay: false,
  release: false,
})

async function invalidateAll(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['orders'] }),
    queryClient.invalidateQueries({ queryKey: ['statistics'] }),
    queryClient.invalidateQueries({ queryKey: ['calendar'] }),
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  ])
}

const markPaidMutation = useMutation({
  mutationFn: (payload: { id: string; body: Parameters<typeof markPaymentPaid>[1] }) =>
    markPaymentPaid(payload.id, payload.body),
  onSuccess: async () => {
    ElMessage.success('已标记付款')
    dialog.value.markPaid = null
    await invalidateAll()
    await refetch()
  },
  onError: error => ElMessage.error(error instanceof Error ? error.message : '操作失败'),
})

const refundMutation = useMutation({
  mutationFn: (payload: { id: string; body: Parameters<typeof refundPayment>[1] }) =>
    refundPayment(payload.id, payload.body),
  onSuccess: async () => {
    ElMessage.success('已记录退款')
    dialog.value.refund = null
    await invalidateAll()
    await refetch()
  },
  onError: error => ElMessage.error(error instanceof Error ? error.message : '操作失败'),
})

const delayMutation = useMutation({
  mutationFn: (body: Parameters<typeof delayRelease>[1]) => delayRelease(orderId.value, body),
  onSuccess: async () => {
    ElMessage.success('已更新预计出货')
    dialog.value.delay = false
    await invalidateAll()
    await refetch()
  },
})

const releaseMutation = useMutation({
  mutationFn: (kind: 'released' | 'store-arrived' | 'balance-open') =>
    kind === 'released'
      ? markReleased(orderId.value, {})
      : kind === 'store-arrived'
        ? markStoreArrived(orderId.value, {})
        : openBalance(orderId.value, {}),
  onSuccess: async () => {
    ElMessage.success('已记录出货事件')
    await invalidateAll()
    await refetch()
  },
})

const shipmentMutation = useMutation({
  mutationFn: (body: Parameters<typeof createShipment>[1]) => createShipment(orderId.value, body),
  onSuccess: async () => {
    ElMessage.success('已添加物流')
    await invalidateAll()
    await refetch()
  },
})

const deliverMutation = useMutation({
  mutationFn: (id: string) => deliverShipment(id, {}),
  onSuccess: async () => {
    ElMessage.success('已标记签收')
    await invalidateAll()
    await refetch()
  },
})

const cancelMutation = useMutation({
  mutationFn: (body: { refund: boolean; note?: string }) => cancelOrder(orderId.value, body),
  onSuccess: async () => {
    ElMessage.success('订单已取消')
    await invalidateAll()
    await refetch()
  },
})
</script>
```

模板：左侧主列（商品 / 付款 / 出货 / 物流 / 附件 / 时间轴）+ 右侧 `OrderOverviewAside`；`<el-skeleton v-if="isLoading">`、`<AppErrorState v-else-if="isError" @retry="refetch" />`、`<template v-else-if="order">` 渲染内容。每个操作成功后都 `invalidateAll() + refetch()`，保证「无需手工刷新」（`docs/06 §79`）。

`AttachmentSection`：列表 + 上传按钮；上传流程为 `getUploadUrl` → `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)` → `createAttachment` → 刷新订单详情；删除走 `deleteAttachment`。

- [ ] **Step 5: 验证并提交**

Run: `pnpm --filter @hobilog/web typecheck && pnpm --filter @hobilog/web build`

手工冒烟（对齐 `docs/06 §79`）：标记付款 → 新增延期 → 标记厂商出货 → 添加物流 → 标记签收，每一步页面状态自动更新且「刷新页面后结果一致」。

```bash
git add apps/web/src/components/order apps/web/src/components/payment apps/web/src/components/release apps/web/src/components/shipment apps/web/src/components/attachment apps/web/src/pages/orders/detail.vue
git commit -m "feat(web): add order detail with payment, release, shipment and timeline sections"
```

---

### Task 10: Dashboard / Calendar / Statistics / Collection / 平台店铺 / 设置

**Files:**
- Create: `apps/web/src/components/dashboard/DashboardGreeting.vue`
- Create: `apps/web/src/components/dashboard/DashboardKpiCard.vue`
- Create: `apps/web/src/components/dashboard/DashboardKpiGrid.vue`
- Create: `apps/web/src/components/dashboard/TodoPanel.vue`
- Create: `apps/web/src/components/dashboard/FuturePaymentChart.vue`
- Create: `apps/web/src/components/dashboard/UpcomingReleasePanel.vue`
- Create: `apps/web/src/components/dashboard/ShippingPanel.vue`
- Create: `apps/web/src/components/dashboard/RecentOrderPanel.vue`
- Create: `apps/web/src/components/chart/AppChart.vue`
- Create: `apps/web/src/components/calendar/CalendarToolbar.vue`
- Create: `apps/web/src/components/calendar/CalendarEventDrawer.vue`
- Create: `apps/web/src/components/statistics/*.vue`（KpiGrid / PaymentTrendChart / FuturePaymentChart / CategoryChart / PlatformChart / ManufacturerChart / IpRanking）
- Create: `apps/web/src/components/collection/CollectionStats.vue`
- Create: `apps/web/src/components/collection/CollectionGrid.vue`
- Create: `apps/web/src/components/platform/PlatformList.vue`
- Create: `apps/web/src/components/platform/StoreList.vue`
- Modify: `apps/web/src/pages/dashboard/index.vue`
- Modify: `apps/web/src/pages/calendar/index.vue`
- Modify: `apps/web/src/pages/statistics/index.vue`
- Modify: `apps/web/src/pages/collection/index.vue`
- Modify: `apps/web/src/pages/platforms/index.vue`
- Modify: `apps/web/src/pages/settings/index.vue`

**Interfaces:**
- Consumes: `statistics.api`、`calendar`（`statistics`/`calendar` API 模块）、`collection`、`platform.api`、`store.api`、`notification.api`
- Produces: 六个页面 + `AppChart`（props `{ option: EChartsOption; height?: string }`，内部 `echarts.init` + `ResizeObserver` 销毁）

- [ ] **Step 1: 写 `AppChart.vue`（ECharts 薄封装）**

```vue
<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ option: EChartsOption; height?: string }>(), { height: '280px' })

const container = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

onMounted(() => {
  if (!container.value) return
  chart = echarts.init(container.value)
  chart.setOption(props.option)
  const observer = new ResizeObserver(() => chart?.resize())
  observer.observe(container.value)
  onBeforeUnmount(() => {
    observer.disconnect()
    chart?.dispose()
    chart = null
  })
})

watch(
  () => props.option,
  option => chart?.setOption(option, true),
  { deep: true },
)
</script>

<template>
  <div ref="container" :style="{ height: props.height, width: '100%' }" />
</template>
```

- [ ] **Step 2: 写 Dashboard 页**

KPI 卡片（`DashboardKpiCard`，props `{ title, value, description?, clickable? }`）+ 点击跳转规则（`docs/06 §10`）：

```text
待付款        → /orders?tab=WAITING_PAYMENT
未来 30 天待付 → /orders?tab=WAITING_PAYMENT
本月预计出货   → /orders?tab=WAITING_RELEASE
运输中        → /orders?tab=IN_TRANSIT
收藏总数      → /collection
```

`TodoPanel` 展示 `todos`（每条显示 `title`、`displayStatusLabel`、`displayStatusHint`、金额、跳转 `/orders/:id`）；`FuturePaymentChart` 用 `dashboard.futurePayments` 数据画柱状图（多币种分组，**不合并**）；`UpcomingReleasePanel` / `ShippingPanel` / `RecentOrderPanel` 分别渲染对应数组。

- [ ] **Step 3: 写 Calendar 页**

`FullCalendar`（`@fullcalendar/vue3`）挂载 `dayGridMonth` / `timeGridWeek` / `listMonth` 三个视图；`CalendarToolbar` 提供视图切换 + 上/下月；数据来自 `getCalendarEvents({ from, to })`（当前视图区间），事件按 `type` 上色：

```text
PAYMENT_DUE      红
DELIVERY         蓝
EXPECTED_RELEASE 紫
RELEASED         绿
```

点击事件打开 `CalendarEventDrawer`（商品 / 事件类型 / 日期 / 金额 / 订单状态 + 「查看订单」按钮 → `/orders/:id`）。

- [ ] **Step 4: 写 Statistics / Collection / 平台店铺 / 设置页**

- Statistics：`StatisticsKpiGrid`（累计消费 / 今年消费 / 未来待付款 / 收藏数量，多币种分行显示）+ `PaymentTrendChart`（`getMonthlyPayments`）+ `FuturePaymentChart`（`getFuturePayments`，6~12 个月）+ `CategoryChart` / `PlatformChart` / `ManufacturerChart`（`getDimensionStatistics`）+ `IpRanking`（按金额倒序，多币种分列）。
- Collection：`CollectionStats` + `CollectionFilterBar` + `CollectionGrid`（卡片：图片、名称、厂商、入库时间 = `deliveredAt`、购入价 = `purchasePrice`）；空状态文案「还没有已入库的收藏」。
- 平台店铺：左侧 `PlatformList`（CRUD + 「导入预置平台」按钮调 `createPresets`）+ 右侧 `StoreList`（按选中平台过滤，CRUD，含平台归属选择）。
- 设置：分组「账户（邮箱 / 退出登录）」「显示（订单默认视图）」「默认币种 / 时区」「提醒（`REMINDER_OFFSET_DAYS` 只读展示）」「数据（导出入口预留）」。默认币种 / 时区写回 `useAuthStore` 之外的本地设置 store（Pinia），V0.1 不改服务端 `user_profiles`。

- [ ] **Step 5: 验证并提交**

Run: `pnpm --filter @hobilog/web typecheck && pnpm --filter @hobilog/web build`

```bash
git add apps/web/src/components apps/web/src/pages
git commit -m "feat(web): add dashboard, calendar, statistics, collection, platform and settings pages"
```

---

### Task 11: P5 验收

**Files:**
- Create: `docs/superpowers/verification/2026-09-18-P5-verification.md`
- Modify: `README.md`（补「本地启动」三步：install / env / dev）

**Interfaces:**
- Consumes: P1–P4 后端 + P5 前端
- Produces: 前端验收记录（覆盖 `docs/06 §79` 全清单）

- [ ] **Step 1: 全量检查**

Run:

```bash
pnpm -r build
pnpm -r test
pnpm -r typecheck
pnpm --filter @hobilog/server test:e2e
```

Expected: 全绿。

- [ ] **Step 2: 按 `docs/06 §79` 逐条手工验收**

启动 `pnpm dev:server` 与 `pnpm --filter @hobilog/web dev`，在浏览器逐条打勾并记录截图路径：

```text
[ ] 创建全款订单
[ ] 创建定金尾款订单
[ ] 创建多阶段订单
[ ] 列表筛选（Tab + 关键词 + 平台 + 付款状态 + 是否延期）
[ ] 详情查看
[ ] 标记付款（含实付 > 计划触发补差价）
[ ] 新增延期（oldDate → newDate 保留历史）
[ ] 标记厂商出货
[ ] 添加物流（拆单：A×1 + B×1，再发 B×1）
[ ] 标记签收（全部签收后订单变 COMPLETED）
[ ] 每一步页面无需手工刷新即可正确更新
```

- [ ] **Step 3: 越权与边界抽查**

```text
[ ] 未登录访问 /orders → 跳转 /login 且登录后回到原路径
[ ] 用 B 账号直接访问 A 的 /orders/:id → 页面显示「订单加载失败」+ 重试按钮（后端 404）
[ ] 金额待定节点在列表/详情显示「待定」而非 0
[ ] JPY 订单金额不带两位小数
[ ] 视口 1024px 以下右侧 Aside 落回普通流
```

- [ ] **Step 4: 写验收记录并汇报**

`docs/superpowers/verification/2026-09-18-P5-verification.md` 记录：命令输出摘要、逐条打勾结果、发现的问题与处理结论。

汇报格式：

```text
P5 完成：登录 → 商品 → 订单创建/列表/详情 主链路 + Dashboard/Calendar/Statistics/Collection/平台店铺/设置
验收：docs/06 §79 全项通过；越权与边界抽查通过
全量：pnpm -r build / test / typecheck + server e2e 全绿
V0.1 主链路闭环完成（docs/02 §40）
```

- [ ] **Step 5: 提交（需用户授权）**

```bash
git add README.md docs/superpowers/verification
git commit -m "docs: record P5 verification and add local setup guide"
```
