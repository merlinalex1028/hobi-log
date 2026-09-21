<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const mode = ref<'signIn' | 'signUp'>('signIn')
const form = reactive({ email: '', password: '' })

async function submit(): Promise<void> {
  loading.value = true
  try {
    if (mode.value === 'signIn') {
      await auth.signIn(form.email, form.password)
    } else {
      await auth.signUp(form.email, form.password)
      ElMessage.success('注册成功，请查收邮件后登录')
      mode.value = 'signIn'
      return
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="app-card login-card">
      <h1>HobiLog</h1>
      <p class="login-subtitle">记录每一件正在等到家的收藏</p>

      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="邮箱">
          <el-input v-model="form.email" type="email" placeholder="you@example.com" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password @keyup.enter="submit" />
        </el-form-item>
        <el-button type="primary" :loading="loading" style="width: 100%" @click="submit">
          {{ mode === 'signIn' ? '登录' : '注册' }}
        </el-button>
      </el-form>

      <el-button link type="primary" @click="mode = mode === 'signIn' ? 'signUp' : 'signIn'">
        {{ mode === 'signIn' ? '没有账号？注册' : '已有账号？登录' }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--page-bg);
}

.login-card {
  width: 360px;
  padding: 32px;
}

.login-subtitle {
  color: var(--text-secondary);
  margin-bottom: 24px;
}
</style>
