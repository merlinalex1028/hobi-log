import type { Prisma } from '../../../generated/prisma/client'

export type StoreWithPlatform = Prisma.StoreGetPayload<{
  include: { platform: { select: { name: true } } }
}>

export interface StoreVo {
  id: string
  name: string
  platformId: string | null
  platformName: string | null
  url: string | null
  contact: string | null
  note: string | null
  createdAt: string
}

export function toStoreVo(store: StoreWithPlatform): StoreVo {
  return {
    id: store.id,
    name: store.name,
    platformId: store.platformId,
    platformName: store.platform?.name ?? null,
    url: store.url,
    contact: store.contact,
    note: store.note,
    createdAt: store.createdAt.toISOString(),
  }
}
