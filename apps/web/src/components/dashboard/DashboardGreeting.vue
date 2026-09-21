<script setup lang="ts">
import { computed } from 'vue'
import AppDate from '@/components/common/AppDate.vue'
import { greetingFor } from '@/utils/dashboard'
import { formatDate } from '@/utils/format'

const props = withDefaults(
  defineProps<{ name?: string; todoCount?: number; today?: string }>(),
  { todoCount: 0 },
)

const greeting = computed(() => greetingFor(new Date().getHours()))
const todayText = computed(() => formatDate(props.today ?? new Date().toISOString()))
</script>

<template>
  <div class="dashboard-greeting">
    <div>
      <h2 class="dashboard-greeting__title">
        {{ greeting }}<template v-if="props.name">，{{ props.name }}</template>
      </h2>
      <p class="dashboard-greeting__subtitle">
        <AppDate :value="todayText" />
        <span v-if="props.todoCount > 0"> · 有 {{ props.todoCount }} 条待办</span>
        <span v-else> · 暂无待办</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.dashboard-greeting {
  margin-bottom: 16px;
}

.dashboard-greeting__title {
  margin: 0;
  font-size: 20px;
}

.dashboard-greeting__subtitle {
  margin: 4px 0 0;
  color: var(--text-secondary);
}
</style>
