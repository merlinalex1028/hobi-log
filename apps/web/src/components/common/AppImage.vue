<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ src?: string | null; alt?: string; ratio?: string; fit?: 'cover' | 'contain' }>(),
  { alt: '', ratio: '4 / 5', fit: 'cover' },
)

const imageSrc = computed(() => (typeof props.src === 'string' && props.src !== '' ? props.src : null))
</script>

<template>
  <div class="app-image" :style="{ aspectRatio: props.ratio }">
    <img
      v-if="imageSrc"
      class="app-image__img"
      :src="imageSrc"
      :alt="props.alt"
      :style="{ objectFit: props.fit }"
    />
    <div v-else class="app-image__placeholder">暂无图片</div>
  </div>
</template>

<style scoped>
.app-image {
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--page-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-image__img {
  width: 100%;
  height: 100%;
  display: block;
}

.app-image__placeholder {
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
