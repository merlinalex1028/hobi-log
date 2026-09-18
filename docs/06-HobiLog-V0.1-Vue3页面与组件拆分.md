# HobiLog V0.1 Vue3 页面与组件拆分

> 本文档用于指导 HobiLog V0.1 前端页面结构、组件边界、Props / Emits 设计、布局和交互拆分。

---

# 1. 页面总览

```text
/dashboard

/orders
/orders/create
/orders/:id
/orders/:id/edit

/products
/products/:id

/collection

/calendar

/statistics

/platforms

/settings
```

V0.1 优先：

```text
/orders
/orders/create
/orders/:id
```

这三个页面决定核心业务是否顺畅。

---

# 2. Layout

```text
DefaultLayout
├─ AppSidebar
├─ AppHeader
└─ RouterView
```

组件：

```text
src/layouts/DefaultLayout.vue

src/components/layout/
├─ AppSidebar.vue
├─ AppHeader.vue
└─ AppBreadcrumb.vue
```

---

# 3. AppSidebar

菜单：

```text
首页

订单
商品库
收藏库
日历
统计
平台 / 店铺
设置
```

推荐桌面端宽度：

```text
220px ~ 240px
```

支持折叠：

```text
64px
```

---

# 4. 通用页面结构

```text
AppPage
├─ AppPageHeader
├─ Toolbar / Filters
└─ Content
```

`AppPageHeader`：

Props：

```ts
interface Props {
  title: string
  description?: string
}
```

Slots：

```text
actions
extra
```

---

# 5. Common 组件

```text
components/common/
├─ AppPageHeader.vue
├─ AppStatusTag.vue
├─ AppCurrency.vue
├─ AppDate.vue
├─ AppEmpty.vue
├─ AppImage.vue
├─ AppSection.vue
├─ AppConfirm.vue
├─ AppLoading.vue
└─ AppErrorState.vue
```

---

# 6. AppStatusTag

统一所有状态视觉。

Props：

```ts
interface Props {
  status: string
  size?: 'small' | 'default' | 'large'
}
```

内部读取：

```text
STATUS_CONFIG
```

不要页面自己写：

```vue
<el-tag type="warning">
```

---

# 7. AppCurrency

Props：

```ts
interface Props {
  amount?: number | null
  currency?: string
  placeholder?: string
}
```

支持：

```text
CNY
JPY
USD
HKD
```

`amount = null` 时：

```text
待定
```

---

# 8. AppDate

Props：

```ts
interface Props {
  value?: string | null
  precision?: 'DAY' | 'MONTH'
}
```

展示：

```text
DAY
2027-05-18

MONTH
2027年05月
```

---

# 9. Dashboard 页面

文件：

```text
pages/dashboard/index.vue
```

拆分：

```text
DashboardPage
├─ DashboardGreeting
├─ DashboardKpiGrid
│  └─ DashboardKpiCard × N
├─ TodoPanel
├─ FuturePaymentChart
├─ UpcomingReleasePanel
├─ ShippingPanel
└─ RecentOrderPanel
```

---

# 10. DashboardKpiCard

Props：

```ts
interface Props {
  title: string
  value: string | number
  description?: string
  icon?: Component
  clickable?: boolean
}
```

点击：

```text
跳到预设过滤后的订单页
```

例如：

```text
待付款
→
/orders?status=WAITING_PAYMENT
```

---

# 11. OrderList 页面

文件：

```text
pages/orders/index.vue
```

结构：

```text
OrderListPage
├─ AppPageHeader
├─ OrderQuickTabs
├─ OrderFilterBar
├─ OrderViewSwitch
├─ OrderTable / OrderGrid
└─ Pagination
```

---

# 12. OrderQuickTabs

Props：

```ts
interface QuickTab {
  label: string
  value: string
  count?: number
}
```

默认：

```text
全部
待付款
待出货
运输中
已完成
```

Emits：

```text
change
```

---

# 13. OrderFilterBar

文件：

```text
components/order/OrderFilterBar.vue
```

包含：

```text
关键词
付款状态
平台
店铺
出货状态
更多筛选
```

Props：

```ts
interface Props {
  modelValue: OrderFilterState
}
```

Emits：

```text
update:modelValue
search
reset
```

高级筛选放：

```text
ElDrawer
```

而不是把所有字段铺在顶部。

---

# 14. OrderViewSwitch

```text
表格
卡片
```

保存用户偏好：

```text
localStorage
```

或 Pinia。

---

# 15. OrderTable

文件：

```text
components/order/OrderTable.vue
```

Props：

```ts
interface Props {
  items: OrderListItem[]
  loading?: boolean
}
```

Emits：

```text
view
edit
mark-payment
update-release
add-shipment
```

---

# 16. OrderTable 列

```text
商品

平台 / 店铺

订单金额

付款

预计出货

物流

下单时间

操作
```

商品列使用：

```text
OrderProductSummary
```

付款列：

```text
PaymentProgress
```

出货列：

```text
ReleaseSummary
```

物流列：

```text
ShipmentSummary
```

---

# 17. OrderGrid

文件：

```text
components/order/OrderGrid.vue
```

内部：

```text
OrderCard × N
```

卡片重点展示：

```text
图片
商品名
平台
店铺
当前状态
付款进度
下一付款
预计出货
```

---

# 18. OrderCard

Props：

```ts
interface Props {
  order: OrderListItem
}
```

Emits：

```text
click
quick-action
```

快捷动作：

```text
标记付款
更新出货
添加物流
```

---

# 19. OrderCreate 页面

文件：

```text
pages/orders/create.vue
```

建议布局：

```text
OrderCreatePage

┌──────────────────────┬───────────────┐
│ 主表单                │ 订单摘要      │
│                      │               │
│ ProductSection       │ OrderSummary  │
│ OrderInfoSection     │               │
│ AmountSection        │               │
│ PaymentSection       │               │
│ ReleaseSection       │               │
│ AttachmentSection    │               │
└──────────────────────┴───────────────┘
```

---

# 20. OrderForm

核心组件：

```text
components/order/OrderForm.vue
```

Props：

```ts
interface Props {
  modelValue: OrderFormModel
  mode: 'create' | 'edit'
  loading?: boolean
}
```

Emits：

```text
update:modelValue
submit
cancel
```

---

# 21. OrderProductSection

文件：

```text
components/order/form/OrderProductSection.vue
```

功能：

```text
添加已有商品
快速创建商品
修改数量
修改本次购买单价
删除商品
```

内部：

```text
OrderProductItem × N
+ ProductSelectorDrawer
+ ProductQuickCreateDrawer
```

---

# 22. ProductSelectorDrawer

Props：

```ts
interface Props {
  modelValue: boolean
  selectedIds?: string[]
}
```

Emits：

```text
update:modelValue
select
create
```

支持：

```text
关键词搜索
最近商品
分类筛选
厂商筛选
```

---

# 23. ProductQuickCreateDrawer

字段：

```text
商品名称 *
商品图片
商品类型
IP
角色
厂商
比例
版本
官方价格
```

创建成功：

```text
自动加入当前订单
```

---

# 24. OrderInfoSection

字段：

```text
平台
店铺
订单号
订单链接
下单日期
币种
```

平台改变时：

```text
重新加载店铺列表
```

如果没有店铺：

```text
允许快速创建
```

---

# 25. AmountSection

字段：

```text
商品金额
优惠
运费
税费
其他费用
订单总额
```

支持：

```text
自动计算商品金额
```

开关。

订单总额实时计算。

---

# 26. PaymentSection

文件：

```text
components/payment/PaymentSection.vue
```

结构：

```text
PaymentModeSelector
PaymentEditor
PaymentSummary
```

---

# 27. PaymentModeSelector

卡片：

```text
全款

定金 + 尾款

多阶段付款

自定义
```

Props：

```ts
interface Props {
  modelValue: PaymentMode
}
```

---

# 28. PaymentEditor

根据模式切换：

```text
FULL
→
FullPaymentEditor

DEPOSIT_BALANCE
→
DepositBalanceEditor

INSTALLMENT
→
InstallmentPaymentEditor

CUSTOM
→
CustomPaymentEditor
```

---

# 29. FullPaymentEditor

字段：

```text
金额
状态
付款时间
截止时间
支付方式
备注
```

默认金额：

```text
订单总额
```

---

# 30. DepositBalanceEditor

固定两个节点：

```text
定金
尾款
```

输入定金后：

```text
默认尾款 =
订单总额 - 定金
```

但允许手工修改。

---

# 31. InstallmentPaymentEditor

```text
PaymentNodeCard × N

+ 添加付款节点
```

支持：

```text
拖拽排序
编辑
删除
```

建议使用：

```text
SortableJS
```

或轻量拖拽方案。

V0.1 也可以先用上下移动按钮。

---

# 32. PaymentNodeCard

展示：

```text
节点名称
类型
金额
状态
截止时间
```

操作：

```text
编辑
复制
删除
上移
下移
```

---

# 33. PaymentSummary

展示：

```text
订单总额

付款节点合计

已支付

待支付

差额
```

如果：

```text
节点合计 != 订单总额
```

显示 warning，不阻止保存。

---

# 34. ReleaseSection

字段：

```text
是否记录预计出货

预计日期

精度
- 月
- 日
```

默认：

```text
MONTH
```

---

# 35. OrderSummaryAside

右侧 Sticky：

```text
position: sticky
top: 20px
```

内容：

```text
商品数量
商品金额
优惠
运费
税费
其他
总金额
已支付
待支付
```

底部：

```text
保存订单
```

---

# 36. OrderDetail 页面

文件：

```text
pages/orders/detail.vue
```

布局：

```text
OrderDetailPage
├─ OrderDetailHeader
├─ MainColumn
│  ├─ OrderProductSection
│  ├─ PaymentDetailSection
│  ├─ ReleaseDetailSection
│  ├─ ShipmentDetailSection
│  ├─ AttachmentSection
│  └─ OrderTimeline
└─ OrderOverviewAside
```

---

# 37. OrderDetailHeader

展示：

```text
主商品名
平台 · 店铺
状态 Tag
```

操作：

```text
编辑
更多
```

更多：

```text
复制订单
取消订单
归档
删除
```

---

# 38. OrderProductSection

如果一个商品：

```text
大图 + 信息
```

多个商品：

```text
ProductMiniCard × N
```

---

# 39. PaymentDetailSection

```text
PaymentProgress
PaymentList
+ 添加付款
```

---

# 40. PaymentProgress

Props：

```ts
interface Props {
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  refundedAmount?: number
  currency: string
}
```

展示：

```text
¥300 / ¥1299
23%
```

---

# 41. PaymentList

```text
PaymentDetailCard × N
```

排序：

```text
sortOrder ASC
```

---

# 42. PaymentDetailCard

状态不同显示不同操作。

PENDING：

```text
标记已付款
编辑
删除
```

PAID：

```text
查看付款信息
退款
编辑备注
```

OVERDUE：

```text
标记已付款
修改截止日
取消
```

---

# 43. MarkPaymentPaidDialog

字段：

```text
计划金额
实际付款金额
付款时间
支付方式
交易号
备注
```

如果实际 > 计划：

```text
提供补差价处理选项
```

---

# 44. ReleaseDetailSection

展示：

```text
当前预计出货
累计延期
厂商出货状态
店铺到货状态
```

历史：

```text
ReleaseTimeline
```

操作：

```text
更新预计出货
标记厂商出货
标记店铺到货
```

---

# 45. ReleaseDelayDialog

字段：

```text
当前预计
新预计
精度
来源
来源链接
备注
```

自动显示：

```text
延期 N 个月
```

---

# 46. ShipmentDetailSection

展示：

```text
ShipmentCard × N
```

操作：

```text
+ 添加物流
```

---

# 47. ShipmentCard

显示：

```text
物流公司
物流单号
状态
发货时间
签收时间
包含商品
```

操作：

```text
更新状态
标记签收
编辑
删除
```

---

# 48. ShipmentFormDrawer

字段：

```text
物流公司
物流单号
发货时间
预计到货
包含商品
备注
```

“包含商品”基于：

```text
OrderItem[]
```

多选。

---

# 49. OrderTimeline

Props：

```ts
interface Props {
  items: TimelineItem[]
}
```

样式：

```text
时间
圆点 / 图标
标题
描述
```

来源颜色：

```text
付款
出货
物流
订单
```

只做轻微视觉区分。

---

# 50. OrderOverviewAside

右侧卡片：

```text
状态

总金额
已支付
待支付
退款

下一付款
预计出货

平台
店铺
订单号
下单时间
```

快捷操作：

```text
标记付款
更新出货
添加物流
```

---

# 51. ProductList 页面

```text
ProductListPage
├─ ProductFilterBar
├─ ProductGrid
│  └─ ProductCard
└─ Pagination
```

ProductCard 展示：

```text
图片
名称
厂商
IP
角色
分类
```

---

# 52. ProductDetail 页面

展示：

```text
商品资料
相关订单
购买次数
累计购买金额
当前收藏状态
```

V0.1 可以简化。

---

# 53. Collection 页面

```text
CollectionPage
├─ CollectionStats
├─ CollectionFilterBar
└─ CollectionGrid
```

卡片：

```text
图片
名称
厂商
入库时间
购入价
```

V0.1 可直接由已签收订单推导。

---

# 54. Calendar 页面

```text
CalendarPage
├─ CalendarToolbar
├─ FullCalendar
└─ CalendarEventDrawer
```

事件类型：

```text
PAYMENT_DUE
EXPECTED_RELEASE
RELEASED
DELIVERY
```

---

# 55. CalendarEventDrawer

展示：

```text
商品
事件类型
日期
金额
订单状态
```

按钮：

```text
查看订单
```

---

# 56. Statistics 页面

```text
StatisticsPage
├─ StatisticsKpiGrid
├─ PaymentTrendChart
├─ FuturePaymentChart
├─ CategoryChart
├─ PlatformChart
├─ ManufacturerChart
└─ IpRanking
```

---

# 57. Platform 页面

```text
PlatformStorePage
├─ PlatformList
└─ StoreList
```

支持：

```text
平台 CRUD
店铺 CRUD
```

---

# 58. Settings 页面

分组：

```text
账户
显示
默认币种
时区
提醒
数据
```

---

# 59. Dialog / Drawer 使用原则

Dialog：

```text
确认类
小表单
状态操作
```

例如：

```text
标记付款
延期
取消订单
```

Drawer：

```text
需要更多字段
需要边看主页面边操作
```

例如：

```text
新增商品
新增物流
高级筛选
```

独立页面：

```text
订单创建
订单编辑
```

---

# 60. 页面数据加载

页面负责：

```text
调用 API
处理 loading
处理 error
组合页面数据
```

组件负责：

```text
展示
输入
触发事件
```

不要让展示组件直接请求 Supabase。

---

# 61. Props / Emits 原则

数据流：

```text
Page
↓ props
Component
↑ emits
Page
```

避免：

```text
子组件直接修改 Pinia / API
```

除非明确属于全局组件。

---

# 62. 组件命名

推荐：

```text
OrderCard
OrderTable
OrderFilterBar

PaymentCard
PaymentForm

ShipmentCard
ShipmentForm

ReleaseTimeline
ReleaseDelayDialog
```

避免：

```text
OrderInfo1
MyCard
CommonDialog2
```

---

# 63. 页面命名

推荐：

```text
pages/orders/index.vue
pages/orders/create.vue
pages/orders/detail.vue
pages/orders/edit.vue
```

路由组件清晰即可。

---

# 64. Composition API

统一：

```vue
<script setup lang="ts">
```

业务逻辑抽到：

```text
composables
```

例如：

```text
useOrderDetail
useOrderForm
usePaymentSummary
useOrderTimeline
useOrderFilters
```

---

# 65. useOrderForm

负责：

```text
初始化表单
计算商品金额
计算订单总额
切换付款模式
生成默认 Payment
转换 Payload
校验
```

---

# 66. usePaymentSummary

返回：

```text
paidAmount
pendingAmount
refundAmount
netPaidAmount
progress
nextPayment
```

---

# 67. useOrderTimeline

输入：

```text
payments
releaseEvents
shipments
orderEvents
```

输出：

```text
TimelineItem[]
```

---

# 68. useOrderFilters

负责：

```text
Router Query
↔
Filter State
```

---

# 69. 空状态

订单列表：

```text
还没有任何订单

把第一件正在等到家的收藏记录下来吧。

[创建订单]
```

付款：

```text
暂无付款节点
```

物流：

```text
暂无物流信息
```

出货：

```text
暂未记录预计出货
```

---

# 70. Loading

不要整页一直 Skeleton。

推荐：

```text
首次：
页面 Skeleton

局部操作：
按钮 loading

刷新：
区域 loading
```

---

# 71. Error

详情加载失败：

```text
订单加载失败

[重试]
```

API 操作失败：

```text
ElMessage.error
```

并保留表单数据。

---

# 72. Desktop Breakpoint

主要目标：

```text
>= 1280px
```

保证：

```text
左侧导航
主内容
右侧 Aside
```

可完整展示。

---

# 73. 小屏兼容

小于：

```text
1024px
```

右侧 Aside 改为：

```text
普通流布局
```

Sidebar 可折叠。

V0.1 不优先做复杂移动端。

---

# 74. 样式变量

建议：

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
}
```

具体色值后续可统一设计。

---

# 75. 卡片风格

```text
轻边框
浅阴影可选
圆角 12px
padding 16~20px
```

避免企业后台式：

```text
大量蓝色边框
重 Header
过密表格
```

---

# 76. 图片比例

订单卡片建议：

```text
4:5
```

商品详情：

```text
1:1 或 4:5
```

保持 `object-fit: cover/contain` 可配置。

---

# 77. 第一阶段组件实现顺序

```text
1. AppPageHeader
2. AppStatusTag
3. AppCurrency
4. AppDate
5. ProductSelectorDrawer
6. OrderProductSection
7. PaymentModeSelector
8. PaymentNodeCard
9. OrderForm
10. OrderTable
11. OrderCard
12. PaymentDetailCard
13. ReleaseTimeline
14. ShipmentCard
15. OrderTimeline
```

---

# 78. 页面实现顺序

```text
1. /orders/create

2. /orders

3. /orders/:id

4. /products

5. /dashboard

6. /calendar

7. /statistics

8. /collection
```

先把创建 → 列表 → 详情跑通。

---

# 79. V0.1 前端验收

至少跑通：

```text
创建全款订单
创建定金尾款订单
创建多阶段订单

列表筛选

详情查看

标记付款

新增延期

标记厂商出货

添加物流

标记签收
```

并且每一步页面无需手工刷新即可正确更新。

---

# 80. 组件设计最终原则

```text
Page 负责业务
Component 负责交互和展示
Composable 负责可复用逻辑
API 负责数据访问
Utils 负责纯计算
```

这五层分清后，整个 Vue3 项目会比较稳定。
