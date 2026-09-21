<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header class="app-page-header">
    <div class="app-page-header__main">
      <div>
        <h1 class="app-page-header__title">{{ title }}</h1>
        <p v-if="description" class="app-page-header__description">{{ description }}</p>
      </div>
      <div class="app-page-header__actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="app-page-header__extra">
      <slot name="extra" />
    </div>
  </header>
</template>

<style scoped>
.app-page-header {
  margin-bottom: 16px;
}

.app-page-header__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.app-page-header__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.app-page-header__description {
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.app-page-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.app-page-header__extra {
  margin-top: 12px;
}
</style>
