# HobiLog V0.1 文档索引（正式后端版）

当前正式架构：

```text
Vue3 Web
   ↓ REST API
NestJS
   ↓ Prisma
Supabase PostgreSQL

Auth    → Supabase Auth
Storage → Supabase Storage
```

Web 不直接 CRUD 业务数据库；旧版以 Supabase RPC 为核心的方案已调整为 NestJS Service + Prisma Transaction。

## 文档

1. `01-HobiLog-V0.1-初版方案.md`
2. `02-HobiLog-V0.1-详细设计.md`
3. `03-HobiLog-V0.1-数据库SQL与核心页面原型.md`
4. `04-HobiLog-V0.1-PrismaSchema与Migration.md`
5. `05-HobiLog-V0.1-TypeScript类型与REST-API层.md`
6. `06-HobiLog-V0.1-Vue3页面与组件拆分.md`
7. `07-HobiLog-V0.1-状态机与业务规则.md`
8. `08-HobiLog-V0.1-NestJS后端工程设计.md`

## 推荐开发顺序

```text
1. Monorepo 初始化
2. Supabase 项目 / Auth
3. Prisma Schema + Migration
4. NestJS Auth Guard + Prisma
5. Product / Platform / Store
6. Order Create / List / Detail
7. Payment / Release / Shipment
8. Vue3 三个核心页面
9. Dashboard / Calendar / Statistics
10. Attachment / Notification
```
