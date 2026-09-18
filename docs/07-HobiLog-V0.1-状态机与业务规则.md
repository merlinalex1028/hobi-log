# HobiLog V0.1 状态机与业务规则

> 本文档定义 HobiLog V0.1 中订单、付款、出货、物流之间的状态关系、派生状态、优先级、动作约束与边界场景。

---

# 1. 为什么必须做状态机

HobiLog 不是普通订单系统。

同一个订单可能同时处于：

```text
付款：
已付定金

出货：
等待厂商出货

物流：
未发货
```

因此不能使用一个字段：

```text
status
```

描述全部业务。

正确方式：

```text
OrderStatus
+
PaymentStatus[]
+
ReleaseEvent[]
+
ShipmentStatus[]
+
DisplayStatus
```

---

# 2. OrderStatus

数据库层：

```text
ACTIVE
COMPLETED
CANCELLED
REFUNDED
```

归档独立使用：

```text
archived: boolean
```

含义：

### ACTIVE

订单正常进行。

### COMPLETED

所有核心流程结束。

一般要求：

```text
无待付款
+
所有物流已签收
```

### CANCELLED

订单取消。

### REFUNDED

整单已退款结束。

---

# 3. PaymentStatus

```text
PENDING
PAID
OVERDUE
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 4. Payment 状态规则

### PENDING

付款节点已存在，但尚未支付。

可能有：

```text
amount = null
```

例如：

```text
补邮金额待定
```

---

### PAID

必须尽量有：

```text
paid_at
```

建议校验：

```text
status = PAID
→
paid_at != null
```

---

### OVERDUE

V0.1 可以动态判断：

```text
status = PENDING
且
due_at < today
```

页面展示成：

```text
OVERDUE
```

数据库本身仍可保持：

```text
PENDING
```

后期定时任务再真正更新。

---

### CANCELLED

付款节点不再需要支付。

例如：

```text
订单取消后
未支付尾款
→ CANCELLED
```

---

### REFUNDED

该付款节点已完全退款。

---

### PARTIALLY_REFUNDED

该付款节点已部分退款。

---

# 5. PaymentType

```text
FULL
DEPOSIT
BALANCE
INSTALLMENT
SHIPPING
TAX
SUPPLEMENT
REFUND
OTHER
```

---

# 6. 退款业务规则

退款单独记录：

```text
Payment(type = REFUND)
```

金额使用正数。

例如：

```text
DEPOSIT
¥300
PAID

REFUND
¥300
PAID
```

则：

```text
总支付 ¥300
退款 ¥300
净支出 ¥0
```

不要：

```text
REFUND = -300
```

---

# 7. 付款汇总状态

派生：

```text
UNPAID
PARTIALLY_PAID
PAID
OVERDUE
```

不是数据库字段。

---

# 8. PaymentSummaryStatus 规则

优先级：

```text
OVERDUE
>
PARTIALLY_PAID
>
UNPAID
>
PAID
```

更准确逻辑：

### OVERDUE

存在：

```text
待付款节点
且
已超过 due_at
```

### PAID

不存在：

```text
PENDING / OVERDUE
```

并且至少存在实际付款节点。

### PARTIALLY_PAID

存在：

```text
PAID
```

同时还存在：

```text
PENDING / OVERDUE
```

### UNPAID

没有任何已付款金额，且存在待付款。

---

# 9. ReleaseEvent

```text
EXPECTED_RELEASE
DELAY
RELEASED
STORE_ARRIVED
BALANCE_OPEN
SHIPMENT_READY
```

这是事件，而不是状态表。

---

# 10. 出货派生状态

建议派生：

```text
UNKNOWN
WAITING_RELEASE
DELAYED
RELEASED
STORE_ARRIVED
READY_TO_SHIP
```

---

# 11. ReleaseStatus 判断

如果最新事件：

```text
EXPECTED_RELEASE
→ WAITING_RELEASE
```

如果最新事件：

```text
DELAY
→ DELAYED
```

如果存在最新：

```text
RELEASED
→ RELEASED
```

如果：

```text
STORE_ARRIVED
→ STORE_ARRIVED
```

如果：

```text
SHIPMENT_READY
→ READY_TO_SHIP
```

---

# 12. 延期规则

延期绝不能覆盖原时间。

正确：

```text
EXPECTED_RELEASE
2027-01

DELAY
2027-01 → 2027-03

DELAY
2027-03 → 2027-05
```

最终：

```text
当前预计 2027-05
```

同时可以统计：

```text
累计延期 4个月
```

---

# 13. 厂商出货 ≠ 店铺发货

必须分开。

```text
厂商 RELEASED
```

意味着：

```text
商品从生产方出货
```

但不代表：

```text
店铺已经寄给用户
```

店铺寄出由：

```text
Shipment
```

表达。

---

# 14. ShipmentStatus

```text
WAITING
SHIPPED
IN_TRANSIT
DELIVERED
EXCEPTION
RETURNED
```

---

# 15. Shipment 状态规则

### WAITING

物流记录已创建，但还没真正发出。

### SHIPPED

店铺已寄出。

### IN_TRANSIT

运输中。

### DELIVERED

用户已签收。

### EXCEPTION

物流异常。

### RETURNED

包裹被退回。

---

# 16. 多 Shipment 订单

一个订单可能：

```text
Shipment A
DELIVERED

Shipment B
IN_TRANSIT
```

此时订单整体：

```text
IN_TRANSIT
```

不能因为有一个已签收就算完成。

---

# 17. Shipment 汇总优先级

```text
EXCEPTION
>
IN_TRANSIT
>
SHIPPED
>
WAITING
>
DELIVERED
```

如果任一 Shipment：

```text
EXCEPTION
```

订单物流展示：

```text
物流异常
```

---

# 18. OrderDisplayStatus

最终给用户看的核心状态。

建议：

```text
PAYMENT_OVERDUE

WAITING_PAYMENT

SHIPMENT_EXCEPTION

IN_TRANSIT

WAITING_SHIPMENT

WAITING_RELEASE

COMPLETED

CANCELLED

REFUNDED

ACTIVE
```

---

# 19. DisplayStatus 优先级

推荐：

```text
CANCELLED

REFUNDED

PAYMENT_OVERDUE

WAITING_PAYMENT

SHIPMENT_EXCEPTION

IN_TRANSIT

WAITING_SHIPMENT

WAITING_RELEASE

COMPLETED

ACTIVE
```

---

# 20. 为什么付款优先于出货

例如：

```text
厂商已经出货

但是用户尾款明天截止
```

用户最需要看到：

```text
待补款
```

而不是：

```text
厂商已出货
```

所以：

```text
WAITING_PAYMENT
```

优先级更高。

---

# 21. DisplayStatus 规则伪代码

```ts
if order.status === 'CANCELLED'
  return CANCELLED

if order.status === 'REFUNDED'
  return REFUNDED

if order.status === 'ARCHIVED'
  return ARCHIVED

if hasOverduePayment(order)
  return PAYMENT_OVERDUE

if hasPendingPayment(order)
  return WAITING_PAYMENT

if hasShipmentException(order)
  return SHIPMENT_EXCEPTION

if hasInTransitShipment(order)
  return IN_TRANSIT

if hasShippedNotDelivered(order)
  return WAITING_SHIPMENT

if isWaitingRelease(order)
  return WAITING_RELEASE

if isOrderCompleted(order)
  return COMPLETED

return ACTIVE
```

---

# 22. WAITING_SHIPMENT 定义

适用于：

```text
付款已经完成

厂商 / 店铺已经有货

但店铺还没有实际发给用户
```

可判断：

```text
无待付款

且
已 RELEASED / STORE_ARRIVED / SHIPMENT_READY

且
不存在已发出 Shipment
```

---

# 23. WAITING_RELEASE 定义

```text
无待付款

且
未 RELEASED

且
没有 Shipment
```

显示：

```text
等待出货
```

---

# 24. COMPLETED 定义

建议：

```text
OrderStatus = COMPLETED
```

或者动态满足：

```text
无待付款

且
存在 Shipment

且
所有 Shipment = DELIVERED
```

---

# 25. 订单自动完成规则

推荐在 `OrderService.refreshStatus(orderId, userId)` 中统一判断。

完成条件：

```text
没有 PENDING / OVERDUE Payment

存在至少一个 Shipment

所有 Shipment = DELIVERED
```

然后：

```text
Order.status → COMPLETED
```

---

# 26. 未创建 Shipment 的情况

有些用户可能：

```text
线下自提
```

所以后期可支持：

```text
delivery_method
```

V0.1 可以先手动：

```text
直接标记完成
```

但建议记录备注。

---

# 27. 订单取消规则

操作：

```text
cancelOrder
```

建议：

1. `Order.status = CANCELLED`
2. 所有未支付 Payment：
   `PENDING / OVERDUE → CANCELLED`
3. 已支付 Payment 不改
4. 若退款，额外创建 REFUND Payment
5. 已有 Shipment 不自动删除
6. 写入 OrderEvent

---

# 28. 取消订单示例

```text
定金 ¥300
PAID

尾款 ¥999
PENDING
```

取消后：

```text
定金 ¥300
PAID

尾款 ¥999
CANCELLED
```

如果退定金：

```text
退款 ¥300
PAID
```

---

# 29. 全额退款规则

如果：

```text
净支付 = 0
且
订单已取消 / 售后结束
```

可以允许：

```text
Order.status = REFUNDED
```

---

# 30. ARCHIVED

归档只使用：

```text
archived = true
```

它仅影响：

```text
日常列表
待办
统计默认范围
```

不改变订单业务终态，也不删除数据。

正式实现中：

```text
OrderStatus 不包含 ARCHIVED
```

---

# 31. 重复状态字段优化建议

同理：

```text
Order.status
```

只保存真正终态 / 生命周期顶层状态：

```text
ACTIVE
COMPLETED
CANCELLED
REFUNDED
```

归档独立：

```text
archived boolean
```

这样更清晰。

---

# 32. 付款模式切换规则

订单创建时：

```text
FULL
DEPOSIT_BALANCE
INSTALLMENT
CUSTOM
```

只是编辑器模式。

一旦创建后：

```text
Payment[]
```

才是真实来源。

---

# 33. FULL 模式

默认生成：

```text
PaymentType = FULL
```

一个节点。

如果：

```text
已付款
```

设置：

```text
status = PAID
paid_at = now / 输入值
```

---

# 34. DEPOSIT_BALANCE 模式

默认生成：

```text
DEPOSIT
BALANCE
```

允许：

```text
定金已付
尾款待付
```

也允许：

```text
定金待付
尾款待付
```

---

# 35. INSTALLMENT 模式

支持多个：

```text
INSTALLMENT
```

最后可以再有：

```text
BALANCE
```

也可以没有。

---

# 36. CUSTOM 模式

允许：

```text
DEPOSIT
INSTALLMENT
SHIPPING
TAX
SUPPLEMENT
OTHER
```

任意组合。

---

# 37. Payment amount = null

表示：

```text
金额待定
```

规则：

- 可以 PENDING
- 不参与金额求和
- 仍然参与“存在待付款”判断

例如：

```text
SHIPPING
amount = null
status = PENDING
```

订单 DisplayStatus：

```text
WAITING_PAYMENT
```

即使金额未知。

---

# 38. Payment 截止时间为空

允许：

```text
due_at = null
```

表示：

```text
待付款
但暂时不知道截止日
```

排序时放到：

```text
有截止日节点之后
```

---

# 39. NextPayment 规则

在：

```text
PENDING / OVERDUE
```

中选择：

```text
最早 due_at
```

如果都没有：

```text
sort_order 最小
```

---

# 40. 订单金额与 Payment 不强一致

订单：

```text
total_amount = 1299
```

Payment：

```text
DEPOSIT 300
BALANCE 999
SHIPPING null
```

这是合法的。

后续：

```text
SHIPPING 20
```

此时付款合计：

```text
1319
```

也可能合法。

原因：

```text
订单总额可能不包含后补运费
```

因此只提示：

```text
金额差额
```

不要阻止。

---

# 41. 已支付金额定义

```text
所有 PAID 且 type != REFUND 的 amount 求和
```

---

# 42. 退款金额定义

```text
所有 PAID 且 type = REFUND 的 amount 求和
```

---

# 43. 净支出

```text
paidAmount - refundAmount
```

---

# 44. 待付款金额

```text
PENDING / OVERDUE
且 amount != null
```

求和。

---

# 45. 出货日期精度

`MONTH`：

```text
2027-05-01
precision = MONTH
```

展示：

```text
2027年05月
```

`DAY`：

```text
2027-05-18
precision = DAY
```

展示：

```text
2027-05-18
```

---

# 46. 延期月数

建议按月份差计算，不按天。

例如：

```text
2027-01
→
2027-05
```

显示：

```text
延期 4个月
```

---

# 47. 多次延期

累计延期：

```text
初始预计
→
最新预计
```

而不是每次延期间隔相加。

这样不会因中间修正产生重复。

---

# 48. 出货历史不可直接编辑覆盖

如果用户录错：

推荐：

```text
允许编辑历史事件
```

但需要明确：

```text
修改的是历史记录
```

而不是直接更新当前状态。

---

# 49. Shipment 与 OrderItem

一个 Shipment 可以关联多个 OrderItem。

一个 OrderItem 也可以拆到多个 Shipment。

因此：

```text
shipment_items
```

是多对多关系。

---

# 50. ShipmentItem quantity 规则

不能超过：

```text
OrderItem.quantity
```

跨 Shipment 合计也不应超过。

V0.1 前端校验。

后续数据库可增加约束 / RPC。

---

# 51. 拆单示例

订单：

```text
A ×1
B ×2
```

Shipment 1：

```text
A ×1
B ×1
```

Shipment 2：

```text
B ×1
```

合法。

---

# 52. Shipment 创建时状态

如果用户已经拿到单号：

```text
SHIPPED
```

如果只是预创建：

```text
WAITING
```

---

# 53. 标记签收

必须：

```text
status = DELIVERED
delivered_at != null
```

然后调用：

```text
refresh_order_status
```

---

# 54. 物流异常

如果任一：

```text
EXCEPTION
```

DisplayStatus：

```text
SHIPMENT_EXCEPTION
```

优先于：

```text
IN_TRANSIT
```

---

# 55. 物流退回

`RETURNED` 不等于订单结束。

可能后续：

```text
重新发货
```

所以：

```text
Order.status
```

仍可 ACTIVE。

---

# 56. 商品与订单关系

Product 是商品资料。

OrderItem 是一次购买。

例如同一 Product：

```text
2026 淘宝买 1 个

2027 AmiAmi 又买 1 个
```

应该：

```text
一个 Product
两个 OrderItem
两个 Order
```

不要复制商品资料。

---

# 57. 商品删除规则

已被订单引用：

```text
禁止删除
```

只能：

```text
归档 Product
```

---

# 58. OrderEvent 规则

适合记录：

```text
用户操作
审计
备注型事件
```

不要求所有实体变化都重复写。

例如：

```text
Payment.paid_at
```

已经能形成时间轴。

OrderEvent 更多用于：

```text
创建订单
用户备注
取消订单
状态操作
```

---

# 59. Timeline 规则

时间轴数据来自：

```text
Payment
ReleaseEvent
Shipment
OrderEvent
```

统一映射后排序。

不要在数据库再维护一份“完整时间轴表”。

---

# 60. 时间轴重复去重

如果：

```text
Payment paid
```

同时又创建：

```text
OrderEvent PAYMENT_PAID
```

前端会重复。

因此两种方案二选一：

### 方案 A

主要依赖实体时间字段，不生成重复 OrderEvent。

### 方案 B

全部动作统一写 OrderEvent，时间轴只读 OrderEvent。

V0.1 推荐：

```text
方案 A
```

OrderEvent 只放额外事件。

这样数据更自然。

---

# 61. Dashboard 待付款

包括：

```text
PENDING
动态 OVERDUE
```

排除：

```text
CANCELLED
REFUNDED
ARCHIVED
```

---

# 62. Dashboard 本月出货

读取：

```text
最新 release date
```

并且：

```text
precision = MONTH / DAY
```

落在当前月。

排除：

```text
CANCELLED
REFUNDED
```

---

# 63. Dashboard 运输中

Shipment：

```text
SHIPPED
IN_TRANSIT
```

数量可统计：

```text
包裹数
```

或：

```text
订单数
```

V0.1 推荐显示：

```text
订单数
```

避免同一订单拆包导致数字膨胀。

---

# 64. 收藏数量

V0.1 可按：

```text
已完成订单中的 OrderItem quantity
```

求和。

但严格来说：

```text
订单完成 != 当前还持有
```

V0.2 应引入：

```text
collection_items
```

处理：

```text
已出售
已转让
损坏
收纳
展示
```

---

# 65. Calendar 事件

至少：

```text
PAYMENT_DUE
EXPECTED_RELEASE
RELEASED
DELIVERY
```

来源：

```text
payments.due_at
release_events
shipments.estimated_delivery_at
```

---

# 66. Calendar 优先级

同一天多事件按：

```text
PAYMENT_DUE
>
DELIVERY
>
EXPECTED_RELEASE
```

因为付款更需要操作。

---

# 67. 提醒规则

默认：

```text
7 天
3 天
1 天
当天
```

---

# 68. 提醒触发

Payment：

```text
status = PENDING
due_at != null
```

才触发。

---

# 69. 逾期提醒

如果：

```text
due_at < today
```

显示：

```text
已逾期 N 天
```

---

# 70. 没有截止日的付款

显示：

```text
待付款 · 暂无截止日期
```

不触发时间型提醒。

---

# 71. 订单取消后提醒

订单：

```text
CANCELLED
```

则所有付款 / 出货提醒停止。

---

# 72. 已归档后提醒

```text
archived = true
```

默认不再出现在 Dashboard 待办。

---

# 73. 统计口径：实际消费

必须使用：

```text
Payment.paid_at
```

不是：

```text
Order.ordered_at
```

---

# 74. 统计口径：订单金额

单独一个指标：

```text
Order.total_amount
```

表示：

```text
下单规模
```

不等于现金流。

---

# 75. 统计口径：净支出

```text
所有非退款 PAID
-
所有 REFUND PAID
```

---

# 76. 多币种统计

V0.1：

```text
不同币种分开统计
```

不要直接：

```text
CNY + JPY + USD
```

相加。

如果首页只能显示一个总额：

推荐：

```text
默认币种订单
```

或明确显示：

```text
CNY ¥...
JPY ¥...
```

V0.2 再做换汇。

---

# 77. FULL 全款预售

这是必须支持的典型状态。

```text
Payment
FULL PAID

Release
WAITING_RELEASE

Shipment
无
```

DisplayStatus：

```text
WAITING_RELEASE
```

不是：

```text
COMPLETED
```

---

# 78. 定金已付但尚未开放尾款

Payment：

```text
DEPOSIT PAID
BALANCE PENDING
due_at = null
```

DisplayStatus：

```text
WAITING_PAYMENT
```

但前端文案可以更细：

```text
等待补款
```

而不是“待付款”。

---

# 79. BALANCE_OPEN

如果店铺通知补款：

创建：

```text
ReleaseEvent
BALANCE_OPEN
```

同时更新：

```text
BALANCE expected_at / due_at
```

---

# 80. 页面状态文案细化

同样的：

```text
WAITING_PAYMENT
```

可以进一步按下一 Payment 类型显示：

```text
DEPOSIT
→ 待付定金

BALANCE
→ 待补尾款

SHIPPING
→ 待补邮

TAX
→ 待补税

INSTALLMENT
→ 待阶段付款
```

这样用户体验更自然。

---

# 81. WAITING_RELEASE 文案

可以结合 Release：

```text
等待出货

预计 2027年05月
```

如果有延期：

```text
延期 · 等待出货
```

---

# 82. WAITING_SHIPMENT 文案

根据 ReleaseEvent：

```text
厂商已出货
等待店铺发货
```

或者：

```text
店铺已到货
等待发货
```

---

# 83. IN_TRANSIT 文案

如果一个包裹：

```text
运输中
```

多个：

```text
2 个包裹运输中
```

---

# 84. COMPLETED 文案

```text
已签收
```

比：

```text
已完成
```

更贴近收藏品场景。

列表 Tab 仍可叫：

```text
已完成
```

---

# 85. 状态颜色建议

```text
PAYMENT_OVERDUE
红

WAITING_PAYMENT
橙

WAITING_RELEASE
紫

WAITING_SHIPMENT
青

IN_TRANSIT
蓝

COMPLETED
绿

CANCELLED
灰

REFUNDED
灰蓝
```

---

# 86. 状态图标

可以使用：

```text
Clock
Wallet
Package
Truck
CircleCheck
CircleClose
TriangleAlert
```

不要使用 emoji 作为正式 UI 主要图标。

---

# 87. 操作权限规则

### 标记付款

仅：

```text
PENDING / OVERDUE
```

可以。

### 延期

订单：

```text
ACTIVE
```

且：

```text
未 RELEASED
```

时允许。

### 创建物流

订单：

```text
ACTIVE
```

且未：

```text
CANCELLED / REFUNDED
```

即可。

### 标记签收

Shipment：

```text
SHIPPED / IN_TRANSIT
```

可以。

---

# 88. 删除 Payment

如果：

```text
PAID
```

默认不建议直接删除。

应：

```text
退款
或
取消付款记录
```

如果用户明确删除：

```text
二次确认
```

---

# 89. 删除 Shipment

如果：

```text
DELIVERED
```

二次确认。

因为会影响：

```text
订单完成状态
收藏统计
```

---

# 90. 修改历史付款

允许：

```text
金额
时间
支付方式
备注
```

但要刷新：

```text
统计
Dashboard
订单状态
```

---

# 91. 数据一致性原则

所有影响：

```text
付款
出货
物流
订单完成
```

的关键动作统一通过 NestJS Service 处理，并在需要时使用：

```ts
prisma.$transaction(...)
```

保证原子性。

避免前端分别：

```text
update A
insert B
update C
```

导致半成功。

---

# 92. 状态来源原则

每个状态只能有一个权威来源。

例如：

```text
付款完成
权威来源 = payments
```

不要同时存：

```text
orders.payment_status
```

---

# 93. 出货权威来源

```text
release_events
```

不要额外：

```text
orders.release_status
```

---

# 94. 物流权威来源

```text
shipments
```

不要：

```text
orders.shipping_status
```

---

# 95. DisplayStatus 权威来源

```text
纯计算
```

不存库。

---

# 96. V0.1 状态机验收场景

必须全部验证：

### A 全款现货

```text
FULL PAID
Shipment SHIPPED
Shipment DELIVERED
→ COMPLETED
```

### B 全款预售

```text
FULL PAID
EXPECTED_RELEASE
→ WAITING_RELEASE
```

### C 定金尾款

```text
DEPOSIT PAID
BALANCE PENDING
→ WAITING_PAYMENT
```

### D 尾款逾期

```text
BALANCE PENDING
due_at < today
→ PAYMENT_OVERDUE
```

### E 延期

```text
DELAY
→ WAITING_RELEASE
但展示“延期”
```

### F 厂商出货

```text
RELEASED
无 Shipment
→ WAITING_SHIPMENT
```

### G 运输中

```text
Shipment IN_TRANSIT
→ IN_TRANSIT
```

### H 物流异常

```text
Shipment EXCEPTION
→ SHIPMENT_EXCEPTION
```

### I 多包裹

```text
1 DELIVERED
1 IN_TRANSIT
→ IN_TRANSIT
```

### J 全部签收

```text
全部 DELIVERED
无待付款
→ COMPLETED
```

### K 订单取消

```text
Order CANCELLED
→ CANCELLED
```

### L 退款结束

```text
Order REFUNDED
→ REFUNDED
```

---

# 97. 当前模型建议修正点

从前面的方案继续落地时，建议做两处调整。

### 调整一

`OrderStatus`：

原：

```text
ACTIVE
COMPLETED
CANCELLED
REFUNDED
ARCHIVED
```

建议：

```text
ACTIVE
COMPLETED
CANCELLED
REFUNDED
```

归档改为：

```text
archived boolean
```

避免双来源。

### 调整二

时间轴不要：

```text
Payment
+
OrderEvent PAYMENT_PAID
```

双写同一事件。

V0.1 建议：

```text
Payment / Release / Shipment
直接映射时间轴
```

`OrderEvent` 仅用于额外事件与用户备注。

---

# 98. 最终核心原则

```text
Order 只负责顶层生命周期

Payment 负责钱

ReleaseEvent 负责生产 / 厂商出货

Shipment 负责店铺到用户

DisplayStatus 负责告诉用户“现在最该关注什么”
```

只要坚持这个原则，后续新增：

```text
OCR
邮件解析
物流同步
自动提醒
商品抓取
多平台
```

都不会破坏现有核心模型。
