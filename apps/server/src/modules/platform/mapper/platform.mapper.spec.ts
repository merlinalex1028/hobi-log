import { toPlatformVo, type PlatformWithCount } from './platform.mapper'

const base: PlatformWithCount = {
  id: 'pf1',
  userId: 'u1',
  name: '淘宝',
  logoUrl: null,
  website: 'https://www.taobao.com',
  region: null,
  defaultCurrency: 'CNY',
  note: null,
  createdAt: new Date('2026-09-18T10:00:00.000Z'),
  updatedAt: new Date('2026-09-18T10:00:00.000Z'),
  _count: { stores: 2 },
}

describe('toPlatformVo', () => {
  it('输出 ISO 时间且不泄露 userId', () => {
    const vo = toPlatformVo(base)
    expect(vo.createdAt).toBe('2026-09-18T10:00:00.000Z')
    expect(vo).not.toHaveProperty('userId')
    expect(vo).not.toHaveProperty('_count')
  })

  it('storeCount 来自 _count.stores', () => {
    expect(toPlatformVo(base).storeCount).toBe(2)
  })

  it('可选字段缺失时输出 null', () => {
    const vo = toPlatformVo({ ...base, website: null, defaultCurrency: null, _count: { stores: 0 } })
    expect(vo.website).toBeNull()
    expect(vo.defaultCurrency).toBeNull()
    expect(vo.storeCount).toBe(0)
  })
})
