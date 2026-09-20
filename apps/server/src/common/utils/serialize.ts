import { Prisma } from '../../generated/prisma/client'

export function toNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

export function toDateString(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function toIsoString(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString()
}
