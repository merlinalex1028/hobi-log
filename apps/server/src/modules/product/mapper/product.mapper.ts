import type { Prisma } from '../../../generated/prisma/client'
import { toDateString, toNumber } from '../../../common/utils/serialize'

export type ProductWithTags = Omit<
  Prisma.ProductGetPayload<{ include: { productTags: true } }>,
  'productTags'
> & { productTags: Array<{ tagId: string }> }

export interface ProductVo {
  id: string
  name: string
  originalName: string | null
  coverUrl: string | null
  category: string
  ipName: string | null
  characterName: string | null
  manufacturer: string | null
  seriesName: string | null
  scale: string | null
  version: string | null
  sku: string | null
  officialPrice: number | null
  officialCurrency: string | null
  announcedAt: string | null
  originalReleaseDate: string | null
  releaseDatePrecision: string | null
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
  tagIds: string[]
}

export function toProductVo(product: ProductWithTags): ProductVo {
  return {
    id: product.id,
    name: product.name,
    originalName: product.originalName,
    coverUrl: product.coverUrl,
    category: product.category,
    ipName: product.ipName,
    characterName: product.characterName,
    manufacturer: product.manufacturer,
    seriesName: product.seriesName,
    scale: product.scale,
    version: product.version,
    sku: product.sku,
    officialPrice: toNumber(product.officialPrice),
    officialCurrency: product.officialCurrency,
    announcedAt: toDateString(product.announcedAt),
    originalReleaseDate: toDateString(product.originalReleaseDate),
    releaseDatePrecision: product.releaseDatePrecision,
    description: product.description,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    tagIds: product.productTags.map(item => item.tagId),
  }
}
