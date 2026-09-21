import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const DefaultLayout = () => import('@/layouts/DefaultLayout.vue')

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/login/index.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', redirect: '/dashboard' },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/pages/dashboard/index.vue'),
      },
      { path: 'orders', name: 'orders', component: () => import('@/pages/orders/index.vue') },
      {
        path: 'orders/create',
        name: 'order-create',
        component: () => import('@/pages/orders/create.vue'),
      },
      {
        path: 'orders/:id',
        name: 'order-detail',
        component: () => import('@/pages/orders/detail.vue'),
      },
      {
        path: 'orders/:id/edit',
        name: 'order-edit',
        component: () => import('@/pages/orders/edit.vue'),
      },
      { path: 'products', name: 'products', component: () => import('@/pages/products/index.vue') },
      {
        path: 'products/:id',
        name: 'product-detail',
        component: () => import('@/pages/products/detail.vue'),
      },
      {
        path: 'collection',
        name: 'collection',
        component: () => import('@/pages/collection/index.vue'),
      },
      { path: 'calendar', name: 'calendar', component: () => import('@/pages/calendar/index.vue') },
      {
        path: 'statistics',
        name: 'statistics',
        component: () => import('@/pages/statistics/index.vue'),
      },
      {
        path: 'platforms',
        name: 'platforms',
        component: () => import('@/pages/platforms/index.vue'),
      },
      { path: 'settings', name: 'settings', component: () => import('@/pages/settings/index.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
