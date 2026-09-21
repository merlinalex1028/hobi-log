import { DISPLAY_STATUS_COLORS, DISPLAY_STATUS_LABELS } from '@hobilog/shared'
import type { DisplayStatus } from '@hobilog/shared'

export type TagTone = 'primary' | 'success' | 'info' | 'warning' | 'danger'

export const STATUS_ICONS: Record<DisplayStatus, string> = {
  CANCELLED: 'CircleClose',
  REFUNDED: 'CircleClose',
  PAYMENT_OVERDUE: 'TriangleAlert',
  WAITING_PAYMENT: 'Wallet',
  SHIPMENT_EXCEPTION: 'TriangleAlert',
  IN_TRANSIT: 'Truck',
  WAITING_SHIPMENT: 'Package',
  WAITING_RELEASE: 'Clock',
  COMPLETED: 'CircleCheck',
  ACTIVE: 'Clock',
}

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = Object.fromEntries(
  (Object.keys(DISPLAY_STATUS_LABELS) as DisplayStatus[]).map(status => [
    status,
    { label: DISPLAY_STATUS_LABELS[status], color: DISPLAY_STATUS_COLORS[status], icon: STATUS_ICONS[status] },
  ]),
)

export const TONE_BY_COLOR: Record<string, TagTone> = {
  orange: 'warning',
  red: 'danger',
  purple: 'primary',
  cyan: 'info',
  blue: 'primary',
  green: 'success',
  gray: 'info',
  'gray-blue': 'info',
}
