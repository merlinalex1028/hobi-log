import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import 'element-plus/es/components/message/style/css'
import App from './App.vue'
import { ApiError, setUnauthorizedHandler } from './api/http'
import { router } from './router'
import { installAuthGuard } from './router/guards'
import { useAuthStore } from './stores/auth'
import './styles/global.css'

installAuthGuard(router)

const pinia = createPinia()
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => error instanceof ApiError && error.statusCode >= 500 && failureCount < 1,
      retryDelay: attemptIndex => Math.min(500 * 2 ** attemptIndex, 2_000),
    },
  },
})

createApp(App).use(pinia).use(router).use(VueQueryPlugin, { queryClient }).mount('#app')

setUnauthorizedHandler(async () => {
  if (router.currentRoute.value.path === '/login') return
  const redirect = router.currentRoute.value.fullPath
  await useAuthStore(pinia).signOut()
  queryClient.clear()
  await router.replace({ path: '/login', query: redirect ? { redirect } : undefined })
})
