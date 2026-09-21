<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string; actionText?: string }>(), {
  title: '还没有任何订单',
})
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <el-empty class="app-empty">
    <template #description>
      <p class="app-empty__title">{{ title }}</p>
      <p v-if="description" class="app-empty__description">{{ description }}</p>
    </template>
    <el-button v-if="actionText" type="primary" @click="emit('action')">{{ actionText }}</el-button>
  </el-empty>
</template>

<style scoped>
.app-empty__title {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.app-empty__description {
  color: var(--text-secondary);
  margin: 6px 0 0;
}
</style>
