export interface ShipmentAllocation {
  orderItemId: string
  quantity: number
}

export interface ShipmentLike {
  items: ShipmentAllocation[]
}

export interface OrderItemLike {
  id: string
  productName: string
  quantity: number
}

export function allocatedQuantities(shipments: ShipmentLike[]): Record<string, number> {
  const allocated: Record<string, number> = {}
  for (const shipment of shipments) {
    for (const item of shipment.items) {
      allocated[item.orderItemId] = (allocated[item.orderItemId] ?? 0) + item.quantity
    }
  }
  return allocated
}

export function remainingQuantities(orderItems: OrderItemLike[], shipments: ShipmentLike[]): Record<string, number> {
  const allocated = allocatedQuantities(shipments)
  const remaining: Record<string, number> = {}
  for (const item of orderItems) {
    remaining[item.id] = item.quantity - (allocated[item.id] ?? 0)
  }
  return remaining
}

export function validateShipmentSelection(
  selected: ShipmentAllocation[],
  orderItems: OrderItemLike[],
  shipments: ShipmentLike[],
): string[] {
  if (selected.length === 0) return ['至少选择一件商品']
  const remaining = remainingQuantities(orderItems, shipments)
  const errors: string[] = []
  for (const item of selected) {
    const orderItem = orderItems.find(candidate => candidate.id === item.orderItemId)
    if (!orderItem) {
      errors.push('商品不属于当前订单')
      continue
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      errors.push(`商品「${orderItem.productName}」数量必须是大于 0 的整数`)
      continue
    }
    const left = remaining[item.orderItemId] ?? 0
    if (item.quantity > left) {
      errors.push(`商品「${orderItem.productName}」超出可发货数量（剩余 ${left}）`)
    }
  }
  return errors
}
