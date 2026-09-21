<script setup lang="ts">
import { ArrowDown, Bell, Search, SwitchButton } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(defineProps<{ todoCount?: number }>(), { todoCount: 0 })
const emit = defineEmits<{ notifications: [] }>()

const router = useRouter()
const auth = useAuthStore()
const keyword = ref('')

const email = computed(() => auth.user?.email ?? '')

async function submitSearch(): Promise<void> {
  const value = keyword.value.trim()
  await router.push({ path: '/orders', query: value === '' ? {} : { keyword: value } })
}

async function logout(): Promise<void> {
  await auth.signOut()
  await router.replace('/login')
}
</script>

<template>
  <header class="app-header">
    <AppBreadcrumb />

    <div class="app-header__right">
      <el-input
        v-model="keyword"
        class="app-header__search"
        :prefix-icon="Search"
        placeholder="搜索订单号 / 商品名"
        clearable
        @keyup.enter="submitSearch"
      />

      <el-badge :value="props.todoCount" :hidden="props.todoCount === 0">
        <el-button circle :icon="Bell" @click="emit('notifications')" />
      </el-badge>

      <el-dropdown>
        <span class="app-header__user">
          <span class="app-header__email">{{ email }}</span>
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="router.push('/settings')">设置</el-dropdown-item>
            <el-dropdown-item :icon="SwitchButton" divided @click="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
}

.app-header__right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-header__search {
  width: 260px;
}

.app-header__user {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--text-secondary);
}

.app-header__email {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .app-header {
    padding: 12px 16px;
  }

  .app-header__search {
    width: 160px;
  }
}
</style>
