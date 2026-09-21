import type { CalendarEventVo } from '@/types/models'
import { describe, expect, it } from 'vitest'
import { readEventProps, toCalendarEventInputs } from './calendar'

function event(overrides: Partial<CalendarEventVo> = {}): CalendarEventVo {
  return {
    id: 'payment:p1',
    type: 'PAYMENT_DUE',
    date: '2026-11-20',
    orderId: 'o1',
    title: '芙宁娜 1/7 手办',
    amount: 500,
    currency: 'CNY',
    precision: 'DAY',
    displayStatus: 'WAITING_PAYMENT',
    ...overrides,
  }
}

describe('utils/calendar', () => {
  it('按事件类型上色（付款红 / 物流蓝 / 预计出货紫 / 已出货绿）', () => {
    const inputs = toCalendarEventInputs([
      event({ id: 'e1', type: 'PAYMENT_DUE' }),
      event({ id: 'e2', type: 'DELIVERY' }),
      event({ id: 'e3', type: 'EXPECTED_RELEASE' }),
      event({ id: 'e4', type: 'RELEASED' }),
    ])
    expect(inputs.map(input => input.backgroundColor)).toEqual(['#d14b4b', '#3d5fd8', '#8a53d1', '#2f9e63'])
    expect(inputs.every(input => input.allDay)).toBe(true)
  })

  it('extendedProps 带上抽屉需要的字段', () => {
    const [input] = toCalendarEventInputs([event()])
    expect(input?.extendedProps).toMatchObject({
      orderId: 'o1',
      title: '芙宁娜 1/7 手办',
      date: '2026-11-20',
      amount: 500,
      currency: 'CNY',
      precision: 'DAY',
      displayStatus: 'WAITING_PAYMENT',
    })
  })

  it('金额待定的事件保留 null', () => {
    const [input] = toCalendarEventInputs([event({ amount: null, currency: null })])
    expect(input?.extendedProps.amount).toBeNull()
  })

  it('readEventProps 对合法 extendedProps 返回原对象', () => {
    const props = { orderId: 'o1', type: 'RELEASED' }
    expect(readEventProps(props)).toBe(props)
  })

  it('readEventProps 缺少 orderId / type 时返回 null', () => {
    expect(readEventProps({ orderId: 'o1' })).toBeNull()
    expect(readEventProps({ type: 'RELEASED' })).toBeNull()
    expect(readEventProps({ orderId: 1, type: 'RELEASED' })).toBeNull()
  })
})
