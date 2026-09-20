import { Prisma } from '../../../generated/prisma/client'
import { toProductVo, type ProductWithTags } from './product.mapper'

const base: ProductWithTags = {
  id: 'p1',
  userId: 'u1',
  name: '芙宁娜 1/7',
  originalName: null,
  coverUrl: null,
  category: 'SCALE_FIGURE',
  ipName: '原神',
  characterName: '芙宁娜',
  manufacturer: 'ALTER',
  seriesName: null,
  scale: '1/7',
  version: null,
  sku: null,
  officialPrice: new Prisma.Decimal('1299.00'),
  officialCurrency: 'CNY',
  announcedAt: new Date('2026-01-02T00:00:00.000Z'),
  originalReleaseDate: new Date('2027-05-01T00:00:00.000Z'),
  releaseDatePrecision: 'MONTH',
  description: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-09-18T10:00:00.000Z'),
  updatedAt: new Date('2026-09-18T10:00:00.000Z'),
  productTags: [{ tagId: 't1' }, { tagId: 't2' }],
}

describe('toProductVo', () => {
  it('Decimal → number 且不泄露 userId', () => {
    const vo = toProductVo(base)
    expect(vo.officialPrice).toBe(1299)
    expect(vo).not.toHaveProperty('userId')
    expect(vo).not.toHaveProperty('productTags')
  })

  it('日期按类型输出', () => {
    const vo = toProductVo(base)
    expect(vo.originalReleaseDate).toBe('2027-05-01')
    expect(vo.createdAt).toBe('2026-09-18T10:00:00.000Z')
  })

  it('tagIds 来自 productTags', () => {
    expect(toProductVo(base).tagIds).toEqual(['t1', 't2'])
  })

  it('officialPrice 为 null 时输出 null', () => {
    expect(toProductVo({ ...base, officialPrice: null }).officialPrice).toBeNull()
  })
})
