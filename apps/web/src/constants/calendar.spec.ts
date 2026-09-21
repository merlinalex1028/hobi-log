import { describe, expect, it } from 'vitest'
import { CALENDAR_DEFAULT_VIEW, CALENDAR_EVENT_CONFIG, CALENDAR_VIEWS } from './calendar'
import { toCalendarEventInputs } from '@/utils/calendar'
import type { CalendarEventType } from '@/types/models'

const TYPES: CalendarEventType[] = ['PAYMENT_DUE', 'DELIVERY', 'EXPECTED_RELEASE', 'RELEASED']

describe('constants/calendar', () => {
  it('四种事件类型都有中文标签与颜色', () => {
    for (const type of TYPES) {
      const config = CALENDAR_EVENT_CONFIG[type]
      expect(config.label).not.toBe('')
      expect(config.color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('配色符合计划：付款红 / 物流蓝 / 预计出货紫 / 已出货绿', () => {
    expect(CALENDAR_EVENT_CONFIG.PAYMENT_DUE.color).toBe('#d14b4b')
    expect(CALENDAR_EVENT_CONFIG.DELIVERY.color).toBe('#3d5fd8')
    expect(CALENDAR_EVENT_CONFIG.EXPECTED_RELEASE.color).toBe('#8a53d1')
    expect(CALENDAR_EVENT_CONFIG.RELEASED.color).toBe('#2f9e63')
  })

  it('三个视图与默认视图一致', () => {
    expect(CALENDAR_VIEWS.map(view => view.value)).toEqual(['dayGridMonth', 'timeGridWeek', 'listMonth'])
    expect(CALENDAR_VIEWS.some(view => view.value === CALENDAR_DEFAULT_VIEW)).toBe(true)
  })

  it('常量配置与事件映射取同一色值', () => {
    const [input] = toCalendarEventInputs([
      {
        id: 'e1',
        type: 'DELIVERY',
        date: '2026-09-10',
        orderId: 'o1',
        title: 't',
        amount: null,
        currency: null,
        precision: 'DAY',
        displayStatus: 'IN_TRANSIT',
      },
    ])
    expect(input?.backgroundColor).toBe(CALENDAR_EVENT_CONFIG.DELIVERY.color)
  })
})
