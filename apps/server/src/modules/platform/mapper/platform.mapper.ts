import type { Prisma } from '../../../generated/prisma/client'

export type PlatformWithCount = Prisma.PlatformGetPayload<{
  include: { _count: { select: { stores: true } } }
}>

export interface PlatformVo {
  id: string
  name: string
  logoUrl: string | null
  website: string | null
  region: string | null
  defaultCurrency: string | null
  note: string | null
  createdAt: string
  storeCount: number
}

export function toPlatformVo(platform: PlatformWithCount): PlatformVo {
  return {
    id: platform.id,
    name: platform.name,
    logoUrl: platform.logoUrl,
    website: platform.website,
    region: platform.region,
    defaultCurrency: platform.defaultCurrency,
    note: platform.note,
    createdAt: platform.createdAt.toISOString(),
    storeCount: platform._count.stores,
  }
}
