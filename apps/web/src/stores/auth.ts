import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const initialized = ref(false)

  const isAuthenticated = (): boolean => session.value !== null

  async function init(): Promise<void> {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    supabase.auth.onAuthStateChange((_event, next) => {
      session.value = next
      user.value = next?.user ?? null
    })
    initialized.value = true
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
    session.value = null
    user.value = null
  }

  async function accessToken(): Promise<string | null> {
    return (await supabase.auth.getSession()).data.session?.access_token ?? null
  }

  return { session, user, initialized, isAuthenticated, init, signIn, signUp, signOut, accessToken }
})
