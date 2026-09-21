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
