import { toStoreVo, type StoreWithPlatform } from './store.mapper'

const base: StoreWithPlatform = {
  id: 's1',
  userId: 'u1',
  platformId: 'pf1',
  name: 'XXX手办店',
  url: 'https://example.com',
  contact: '旺旺',
  note: null,
  createdAt: new Date('2026-09-18T10:00:00.000Z'),
  updatedAt: new Date('2026-09-18T10:00:00.000Z'),
  platform: { name: '淘宝' },
}

describe('toStoreVo', () => {
  it('输出 platformName 且不泄露 userId', () => {
    const vo = toStoreVo(base)
    expect(vo.platformName).toBe('淘宝')
    expect(vo).not.toHaveProperty('userId')
    expect(vo).not.toHaveProperty('platform')
  })

  it('无平台时 platformName 为 null', () => {
    const vo = toStoreVo({ ...base, platformId: null, platform: null })
    expect(vo.platformId).toBeNull()
    expect(vo.platformName).toBeNull()
  })
})
