import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export function installAuthGuard(router: Router): void {
  router.beforeEach(async to => {
    const auth = useAuthStore()
    if (!auth.initialized) await auth.init()

    if (to.meta.public) return true
    if (!auth.isAuthenticated()) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
    return true
  })
}
