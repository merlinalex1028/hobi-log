<script setup lang="ts">
import { computed } from 'vue'
import { REMINDER_OFFSET_DAYS, SUPPORTED_CURRENCIES } from '@hobilog/shared'
import { useRouter } from 'vue-router'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import AppSection from '@/components/common/AppSection.vue'
import { useAppSettingsStore, TIME_ZONE_OPTIONS, ORDER_DEFAULT_VIEWS } from '@/stores/app-settings'
import { useAuthStore } from '@/stores/auth'
import { useViewPreferenceStore } from '@/stores/view-preference'

const router = useRouter()
const auth = useAuthStore()
const settings = useAppSettingsStore()
const viewPreference = useViewPreferenceStore()

const email = computed(() => auth.user?.email ?? '未登录')
const reminderDays = REMINDER_OFFSET_DAYS.map(days => `${days} 天`).join(' / ')

const currencyOptions = SUPPORTED_CURRENCIES.map(currency => ({ value: currency, label: currency }))

const timeZoneOptions = computed(() => {
  const options = TIME_ZONE_OPTIONS.map(option => ({ value: option.value as string, label: option.label as string }))
  return options.some(option => option.value === settings.timeZone)
    ? options
    : [{ value: settings.timeZone, label: `${settings.timeZone}（本机时区）` }, ...options]
})

async function signOut(): Promise<void> {
  await auth.signOut()
  await router.push('/login')
}
</script>

<template>
  <div>
    <AppPageHeader title="设置" description="账户、显示偏好与默认值" />

    <AppSection title="账户">
      <div class="settings-row">
        <span class="settings-row__label">邮箱</span>
        <span>{{ email }}</span>
      </div>
      <div class="settings-row">
        <span class="settings-row__label">操作</span>
        <el-button type="danger" plain @click="signOut">退出登录</el-button>
      </div>
    </AppSection>

    <AppSection title="显示">
      <div class="settings-row">
        <span class="settings-row__label">订单默认视图</span>
        <el-select
          class="settings-row__control"
          :model-value="settings.orderDefaultView"
          @update:model-value="settings.setOrderDefaultView($event as 'last-used' | 'table' | 'grid')"
        >
          <el-option
            v-for="option in ORDER_DEFAULT_VIEWS"
            :key="option.value"
            :value="option.value"
            :label="option.label"
          />
        </el-select>
      </div>
      <div class="settings-row">
        <span class="settings-row__label">当前视图</span>
        <el-select
          class="settings-row__control"
          :model-value="viewPreference.orderView"
          @update:model-value="viewPreference.setOrderView($event as 'table' | 'grid')"
        >
          <el-option value="table" label="表格" />
          <el-option value="grid" label="卡片" />
        </el-select>
      </div>
    </AppSection>

    <AppSection title="默认币种 / 时区">
      <div class="settings-row">
        <span class="settings-row__label">默认币种</span>
        <el-select
          class="settings-row__control"
          :model-value="settings.defaultCurrency"
          @update:model-value="settings.setDefaultCurrency($event as string)"
        >
          <el-option
            v-for="option in currencyOptions"
            :key="option.value"
            :value="option.value"
            :label="option.label"
          />
        </el-select>
      </div>
      <div class="settings-row">
        <span class="settings-row__label">时区</span>
        <el-select
          class="settings-row__control"
          :model-value="settings.timeZone"
          @update:model-value="settings.setTimeZone($event as string)"
        >
          <el-option
            v-for="option in timeZoneOptions"
            :key="option.value"
            :value="option.value"
            :label="option.label"
          />
        </el-select>
      </div>
      <p class="text-secondary">V0.1 只保存在本机（localStorage），不改服务端 user_profiles。</p>
    </AppSection>

    <AppSection title="提醒">
      <div class="settings-row">
        <span class="settings-row__label">提前提醒</span>
        <span>{{ reminderDays }}（只读，来自 REMINDER_OFFSET_DAYS）</span>
      </div>
    </AppSection>

    <AppSection title="数据">
      <div class="settings-row">
        <span class="settings-row__label">导出</span>
        <el-button disabled>导出入口预留（V0.1 未实现）</el-button>
      </div>
    </AppSection>
  </div>
</template>

<style scoped>
.settings-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.settings-row__label {
  width: 120px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.settings-row__control {
  width: 240px;
}
</style>
