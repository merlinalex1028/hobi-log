import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_TYPES,
  DISPLAY_STATUSES,
  ORDER_STATUSES,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PRODUCT_CATEGORIES,
  RELEASE_EVENT_TYPES,
  RELEASE_STATUSES,
  SHIPMENT_STATUSES,
} from './index'
import {
  ATTACHMENT_TYPE_LABELS,
  DISPLAY_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_MODE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  PRODUCT_CATEGORY_LABELS,
  RELEASE_EVENT_TYPE_LABELS,
  RELEASE_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
} from './labels'
import { DISPLAY_STATUS_PRIORITY, SHIPMENT_SUMMARY_PRIORITY } from '../constants'

const cases: Array<[readonly string[], Record<string, string>]> = [
  [PAYMENT_MODES, PAYMENT_MODE_LABELS],
  [ORDER_STATUSES, ORDER_STATUS_LABELS],
  [PAYMENT_STATUSES, PAYMENT_STATUS_LABELS],
  [SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS],
  [PAYMENT_TYPES, PAYMENT_TYPE_LABELS],
  [RELEASE_EVENT_TYPES, RELEASE_EVENT_TYPE_LABELS],
  [PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS],
  [ATTACHMENT_TYPES, ATTACHMENT_TYPE_LABELS],
  [DISPLAY_STATUSES, DISPLAY_STATUS_LABELS],
  [RELEASE_STATUSES, RELEASE_STATUS_LABELS],
]

describe('枚举标签完整性', () => {
  it.each(cases)('每个枚举值都有中文标签', (values, labels) => {
    for (const value of values) {
      expect(labels[value], `缺少标签: ${value}`).toBeTruthy()
    }
  })
})

describe('状态枚举取值', () => {
  it('OrderStatus 只有 4 个终态', () => {
    expect([...ORDER_STATUSES]).toEqual(['ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED'])
  })

  it('PaymentStatus 落库不含 OVERDUE', () => {
    expect([...PAYMENT_STATUSES]).toEqual([
      'PENDING',
      'PAID',
      'CANCELLED',
      'REFUNDED',
      'PARTIALLY_REFUNDED',
    ])
  })

  it('DisplayStatus 优先级覆盖全部展示状态', () => {
    expect(Object.keys(DISPLAY_STATUS_PRIORITY).sort()).toEqual([...DISPLAY_STATUSES].sort())
  })

  it('Shipment 汇总优先级覆盖全部物流状态', () => {
    expect(Object.keys(SHIPMENT_SUMMARY_PRIORITY).sort()).toEqual([...SHIPMENT_STATUSES].sort())
  })
})
