import { describe, expect, it } from 'vitest'
import {
  allocatedQuantities,
  remainingQuantities,
  validateShipmentSelection,
  type OrderItemLike,
  type ShipmentLike,
} from './shipment'

const orderItems: OrderItemLike[] = [
  { id: 'i1', productName: '芙宁娜 1/7', quantity: 2 },
  { id: 'i2', productName: '可莉 粘土人', quantity: 1 },
]

function shipments(items: { orderItemId: string; quantity: number }[]): ShipmentLike[] {
  return [{ items }]
}

describe('allocatedQuantities', () => {
  it('合并多个包裹的同一商品行', () => {
    expect(
      allocatedQuantities([
        { items: [{ orderItemId: 'i1', quantity: 1 }] },
        { items: [{ orderItemId: 'i1', quantity: 1 }] },
      ]),
    ).toEqual({ i1: 2 })
  })

  it('没有包裹时为空对象', () => {
    expect(allocatedQuantities([])).toEqual({})
  })
})

describe('remainingQuantities', () => {
  it('按已发货数量扣减，剩余可为 0', () => {
    expect(remainingQuantities(orderItems, shipments([{ orderItemId: 'i1', quantity: 2 }]))).toEqual({
      i1: 0,
      i2: 1,
    })
  })

  it('无历史包裹时等于订单数量', () => {
    expect(remainingQuantities(orderItems, [])).toEqual({ i1: 2, i2: 1 })
  })
})

describe('validateShipmentSelection', () => {
  it('未选择任何商品时报错', () => {
    expect(validateShipmentSelection([], orderItems, [])).toEqual(['至少选择一件商品'])
  })

  it('数量超过订单数量时报错并带商品名', () => {
    expect(validateShipmentSelection([{ orderItemId: 'i2', quantity: 2 }], orderItems, [])).toEqual([
      '商品「可莉 粘土人」超出可发货数量（剩余 1）',
    ])
  })

  it('跨 Shipment 合计超出时报错', () => {
    const errors = validateShipmentSelection(
      [{ orderItemId: 'i1', quantity: 2 }],
      orderItems,
      shipments([{ orderItemId: 'i1', quantity: 1 }]),
    )
    expect(errors).toEqual(['商品「芙宁娜 1/7」超出可发货数量（剩余 1）'])
  })

  it('数量为 0 或负数时报错', () => {
    expect(validateShipmentSelection([{ orderItemId: 'i1', quantity: 0 }], orderItems, [])).toEqual([
      '商品「芙宁娜 1/7」数量必须是大于 0 的整数',
    ])
  })

  it('不属于当前订单的商品行报错', () => {
    expect(validateShipmentSelection([{ orderItemId: 'nope', quantity: 1 }], orderItems, [])).toEqual([
      '商品不属于当前订单',
    ])
  })

  it('合法选择返回空数组', () => {
    expect(
      validateShipmentSelection(
        [
          { orderItemId: 'i1', quantity: 1 },
          { orderItemId: 'i2', quantity: 1 },
        ],
        orderItems,
        shipments([{ orderItemId: 'i1', quantity: 1 }]),
      ),
    ).toEqual([])
  })
})
