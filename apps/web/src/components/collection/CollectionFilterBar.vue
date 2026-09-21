<script setup lang="ts">
import type { CollectionFilterState } from '@/utils/collection'

const props = defineProps<{ modelValue: CollectionFilterState }>()
const emit = defineEmits<{ 'update:modelValue': [value: CollectionFilterState]; reset: [] }>()

function patch(next: Partial<CollectionFilterState>): void {
  emit('update:modelValue', { ...props.modelValue, ...next })
}
</script>

<template>
  <div class="collection-filter-bar">
    <el-input
      class="collection-filter-bar__keyword"
      :model-value="props.modelValue.keyword"
      placeholder="按名称搜索"
      clearable
      @update:model-value="patch({ keyword: $event as string })"
    />
    <el-checkbox
      :model-value="props.modelValue.onlyDelivered"
      @update:model-value="patch({ onlyDelivered: $event === true })"
    >
      仅显示已入库
    </el-checkbox>
    <span class="collection-filter-bar__hint text-secondary">筛选作用于当前页</span>
    <el-button link @click="emit('reset')">重置</el-button>
  </div>
</template>

<style scoped>
.collection-filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.collection-filter-bar__keyword {
  width: 240px;
}

.collection-filter-bar__hint {
  font-size: 12px;
}
</style>
