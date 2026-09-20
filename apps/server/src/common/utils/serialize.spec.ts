import { Prisma } from '../../generated/prisma/client'
import { toDateString, toIsoString, toNumber } from './serialize'

describe('toNumber', () => {
  it('Decimal → number', () => {
    expect(toNumber(new Prisma.Decimal('1299.50'))).toBe(1299.5)
  })

  it('null / undefined → null', () => {
    expect(toNumber(null)).toBeNull()
    expect(toNumber(undefined)).toBeNull()
  })

  it('字符串数字 → number', () => {
    expect(toNumber('0')).toBe(0)
  })
})

describe('toDateString', () => {
  it('日期取 UTC 年月日', () => {
    expect(toDateString(new Date('2027-05-01T00:00:00.000Z'))).toBe('2027-05-01')
  })

  it('null → null', () => {
    expect(toDateString(null)).toBeNull()
  })
})

describe('toIsoString', () => {
  it('输出完整 ISO', () => {
    expect(toIsoString(new Date('2027-05-18T10:00:00.000Z'))).toBe('2027-05-18T10:00:00.000Z')
  })

  it('null → null', () => {
    expect(toIsoString(undefined)).toBeNull()
  })
})
