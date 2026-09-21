import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { ApiError } from './http'

function toApiError(error: { message: string; status?: number | undefined; code?: string | undefined }): ApiError {
  return new ApiError({
    statusCode: error.status ?? 0,
    code: error.code ?? 'AUTH_ERROR',
    message: error.message,
  })
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw toApiError(error)
  return data.session
}

export async function getAccessToken(): Promise<string | null> {
  return (await getSession())?.access_token ?? null
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw toApiError(error)
  if (!data.session) throw new ApiError({ statusCode: 0, code: 'AUTH_ERROR', message: '登录失败，请稍后重试' })
  return data.session
}

export async function signUpWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw toApiError(error)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw toApiError(error)
}

export function onAuthStateChange(handler: (session: Session | null) => void): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session))
  return { unsubscribe: () => data.subscription.unsubscribe() }
}
