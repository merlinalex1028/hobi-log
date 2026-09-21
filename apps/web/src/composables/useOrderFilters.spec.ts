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

  it('空字符串数字回退默认', () => {
    const filters = parseFiltersFromQuery({ year: '', priceMin: '', priceMax: '' })
    expect(filters.year).toBeUndefined()
    expect(filters.priceMin).toBeUndefined()
    expect(filters.priceMax).toBeUndefined()
  })

  it('字符串数组 query 值不会污染状态', () => {
    const filters = parseFiltersFromQuery({ keyword: ['a', 'b'], delayed: 'false' })
    expect(filters.keyword).toBe('')
    expect(filters.delayed).toBe(false)
  })

  it('负数与零被保留', () => {
    expect(parseFiltersFromQuery({ priceMin: '-10', priceMax: '0' }).priceMin).toBe(-10)
    expect(parseFiltersFromQuery({ priceMin: '-10', priceMax: '0' }).priceMax).toBe(0)
  })
})

describe('toQuery', () => {
  it('默认值不进 URL', () => {
    expect(toQuery(DEFAULT_ORDER_FILTERS)).toEqual({})
  })

  it('写入非默认值', () => {
    expect(toQuery({ ...DEFAULT_ORDER_FILTERS, tab: 'IN_TRANSIT', keyword: '芙宁娜', page: 2 })).toEqual({
      tab: 'IN_TRANSIT',
      keyword: '芙宁娜',
      page: '2',
    })
  })

  it('自定义 pageSize 与 priceMin = 0 也要写入', () => {
    expect(toQuery({ ...DEFAULT_ORDER_FILTERS, pageSize: 50, priceMin: 0 })).toEqual({
      pageSize: '50',
      priceMin: '0',
    })
  })

  it('delayed 为 true 时写 delayed=true', () => {
    expect(toQuery({ ...DEFAULT_ORDER_FILTERS, delayed: true })).toEqual({ delayed: 'true' })
  })

  it('parse 与 to 往返保持一致', () => {
    const state = { ...DEFAULT_ORDER_FILTERS, tab: 'WAITING_PAYMENT', year: 2026, page: 3, pageSize: 50 }
    expect(parseFiltersFromQuery(toQuery(state))).toEqual(state)
  })
})
