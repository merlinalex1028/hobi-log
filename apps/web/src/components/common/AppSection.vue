<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <section class="app-section app-card">
    <div class="app-section__header">
      <div>
        <h2 class="app-section__title">{{ title }}</h2>
        <p v-if="description" class="app-section__description">{{ description }}</p>
      </div>
      <div class="app-section__extra">
        <slot name="extra" />
      </div>
    </div>
    <div class="app-section__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.app-section {
  margin-bottom: 16px;
}

.app-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.app-section__title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.app-section__description {
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.app-section__extra {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
