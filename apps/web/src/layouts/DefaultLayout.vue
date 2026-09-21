<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const collapsed = ref(false)
</script>

<template>
  <div class="default-layout">
    <AppSidebar :collapsed="collapsed" @toggle="collapsed = !collapsed" />
    <div class="default-layout__main">
      <AppHeader />
      <main class="default-layout__content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.default-layout {
  display: flex;
  min-height: 100vh;
}

.default-layout__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.default-layout__content {
  flex: 1;
  padding: 20px 24px 40px;
  max-width: 1440px;
}

@media (max-width: 1024px) {
  .default-layout__content {
    padding: 16px;
  }
}
</style>
