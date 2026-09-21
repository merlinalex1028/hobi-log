import { defineStore } from 'pinia'
import type { Session, Subscription, User } from '@supabase/supabase-js'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const initialized = ref(false)

  let initPromise: Promise<void> | null = null
  let subscription: Subscription | null = null

  function applySession(next: Session | null): void {
    session.value = next
    user.value = next?.user ?? null
  }

  const isAuthenticated = (): boolean => session.value !== null

  function init(): Promise<void> {
    initPromise ??= (async () => {
      const { data } = await supabase.auth.getSession()
      applySession(data.session)
      subscription = supabase.auth.onAuthStateChange((_event, next) => {
        applySession(next)
      }).data.subscription
      initialized.value = true
    })()
    return initPromise
  }

  function dispose(): void {
    subscription?.unsubscribe()
    subscription = null
    initPromise = null
    initialized.value = false
  }

  async function signIn(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    session.value = data.session
    user.value = data.user
  }

  async function signUp(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
    applySession(null)
  }

  async function accessToken(): Promise<string | null> {
    return (await supabase.auth.getSession()).data.session?.access_token ?? null
  }

  return { session, user, initialized, isAuthenticated, init, dispose, signIn, signUp, signOut, accessToken }
})
