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
    <div class="app-sidebar__brand" @click="emit('toggle')">HobiLog</div>
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
  background: var(--card-bg);
  padding: 16px 12px;
}

.app-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
}

.app-sidebar__brand {
  font-weight: 600;
  padding: 8px 12px 20px;
  cursor: pointer;
  user-select: none;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

a {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
}

a:hover {
  background: var(--page-bg);
}

a.is-active {
  background: #eef0ff;
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>
