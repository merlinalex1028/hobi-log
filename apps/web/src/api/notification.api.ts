import type { ReminderVo } from '@/types/models'
import { http } from './http'

export function getTodos(): Promise<ReminderVo[]> {
  return http.get<ReminderVo[]>('/notifications/todos').then(res => res.data)
}
