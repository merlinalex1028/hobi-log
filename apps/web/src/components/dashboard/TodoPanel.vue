<script setup lang="ts">
import AppCurrency from '@/components/common/AppCurrency.vue'
import AppDate from '@/components/common/AppDate.vue'
import AppStatusTag from '@/components/common/AppStatusTag.vue'
import type { DashboardVo } from '@/types/models'

const props = defineProps<{ todos: DashboardVo['todos'] }>()
const emit = defineEmits<{ open: [orderId: string] }>()
</script>

<template>
  <div class="todo-panel">
    <p v-if="props.todos.length === 0" class="text-secondary">今天没有待办，轻松一下。</p>
    <ul v-else class="todo-panel__list">
      <li
        v-for="todo in props.todos"
        :key="todo.orderId"
        class="todo-panel__item"
        role="button"
        tabindex="0"
        @click="emit('open', todo.orderId)"
      >
        <div class="todo-panel__main">
          <div class="todo-panel__title">
            <span>{{ todo.title }}</span>
            <AppStatusTag
              :status="todo.displayStatus"
              :label="todo.displayStatusLabel"
              size="small"
            />
          </div>
          <p v-if="todo.displayStatusHint" class="todo-panel__hint">{{ todo.displayStatusHint }}</p>
        </div>
        <div class="todo-panel__meta">
          <AppCurrency :amount="todo.amount" :currency="todo.currency" />
          <AppDate :value="todo.dueAt" />
          <span v-if="todo.overdueDays > 0" class="text-danger">逾期 {{ todo.overdueDays }} 天</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.todo-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.todo-panel__item:hover {
  border-color: var(--el-color-primary);
}

.todo-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.todo-panel__hint {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.todo-panel__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>
