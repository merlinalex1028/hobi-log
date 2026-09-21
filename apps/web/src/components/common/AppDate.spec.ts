import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppDate from './AppDate.vue'

describe('AppDate', () => {
  it('MONTH 精度显示 2027年05月', () => {
    expect(mount(AppDate, { props: { value: '2027-05-01', precision: 'MONTH' } }).text()).toBe('2027年05月')
  })

  it('DAY 精度显示 2027-05-18', () => {
    expect(mount(AppDate, { props: { value: '2027-05-18' } }).text()).toBe('2027-05-18')
  })

  it('空值显示占位符', () => {
    expect(mount(AppDate, { props: { value: null } }).text()).toBe('—')
  })
})
