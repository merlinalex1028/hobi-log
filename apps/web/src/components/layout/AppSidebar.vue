<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const route = useRoute()

const menus = [
  { path: '/dashboard', label: '首页' },
  { path: '/orders', label: '订单' },
  { path: '/products', label: '商品库' },
  { path: '/collection', label: '收藏库' },
  { path: '/calendar', label: '日历' },
  { path: '/statistics', label: '统计' },
  { path: '/platforms', label: '平台 / 店铺' },
  { path: '/settings', label: '设置' },
]

const active = computed(() => menus.find(menu => route.path.startsWith(menu.path))?.path ?? '/dashboard')
</script>

<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': props.collapsed }">
    <button
      type="button"
      class="app-sidebar__brand"
      :aria-label="props.collapsed ? '展开侧边栏' : '收起侧边栏'"
      @click="emit('toggle')"
    >
      <img class="app-sidebar__brand-mark" src="/brand/hobilog-mark.png" alt="" />
      <span v-if="!props.collapsed">HobiLog</span>
    </button>
    <nav>
      <RouterLink
        v-for="menu in menus"
        :key="menu.path"
        :to="menu.path"
        :title="menu.label"
        :class="{ 'is-active': menu.path === active }"
      >
        <span class="app-sidebar__label">{{ props.collapsed ? menu.label.slice(0, 1) : menu.label }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background: var(--cocoa-900);
  padding: 16px 12px;
  color: var(--vanilla-50);
}

.app-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
}

.app-sidebar__brand {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  padding: 8px 12px 20px;
  cursor: pointer;
  user-select: none;
  border: 0;
  background: transparent;
  color: var(--vanilla-50);
  font: inherit;
  text-align: left;
}

.app-sidebar__brand:focus-visible,
a:focus-visible {
  outline: 2px solid var(--butter-500);
  outline-offset: 2px;
}

.app-sidebar__brand-mark {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  object-fit: contain;
}

.app-sidebar.is-collapsed .app-sidebar__brand {
  justify-content: center;
  padding-inline: 0;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

a {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: rgb(255 243 211 / 72%);
  text-decoration: none;
  transition: background-color 180ms ease, color 180ms ease, transform 180ms ease;
}

a:hover {
  background: rgb(246 200 95 / 14%);
  color: var(--vanilla-50);
}

a.is-active {
  background: var(--butter-500);
  color: var(--cocoa-900);
  font-weight: 600;
}
</style>
