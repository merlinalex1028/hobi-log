<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { CreatePlatformPayload } from '@/api/platform.api'
import type { PlatformVo } from '@/types/models'

const props = defineProps<{
  platforms: PlatformVo[]
  selectedId: string | null
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  create: [payload: CreatePlatformPayload]
  update: [id: string, payload: CreatePlatformPayload]
  remove: [id: string]
  'import-presets': []
}>()

function emptyForm(): CreatePlatformPayload {
  return { name: '', logoUrl: '', website: '', region: '', defaultCurrency: '', note: '' }
}

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<CreatePlatformPayload>(emptyForm())

watch(dialogVisible, visible => {
  if (!visible) {
    editingId.value = null
    Object.assign(form, emptyForm())
  }
})

function openCreate(): void {
  editingId.value = null
  Object.assign(form, emptyForm())
  dialogVisible.value = true
}

function openEdit(platform: PlatformVo): void {
  editingId.value = platform.id
  Object.assign(form, {
    name: platform.name,
    logoUrl: platform.logoUrl ?? '',
    website: platform.website ?? '',
    region: platform.region ?? '',
    defaultCurrency: platform.defaultCurrency ?? '',
    note: platform.note ?? '',
  })
  dialogVisible.value = true
}

function submit(): void {
  const payload: CreatePlatformPayload = { ...form }
  if (editingId.value) emit('update', editingId.value, payload)
  else emit('create', payload)
  dialogVisible.value = false
}
</script>

<template>
  <div class="platform-list">
    <div class="platform-list__header">
      <h2 class="platform-list__title">平台</h2>
      <div class="platform-list__actions">
        <el-button size="small" @click="emit('import-presets')">导入预置平台</el-button>
        <el-button size="small" type="primary" @click="openCreate">新建平台</el-button>
      </div>
    </div>

    <p v-if="props.loading" class="text-secondary">加载中…</p>
    <p v-else-if="props.platforms.length === 0" class="text-secondary">还没有平台，先导入预置平台。</p>
    <ul v-else class="platform-list__items">
      <li
        v-for="platform in props.platforms"
        :key="platform.id"
        class="platform-list__item"
        :class="{ 'is-active': platform.id === props.selectedId }"
      >
        <button class="platform-list__select" type="button" @click="emit('select', platform.id)">
          <span class="platform-list__name">{{ platform.name }}</span>
          <span class="platform-list__meta text-secondary">
            {{ platform.defaultCurrency ?? '—' }} · {{ platform.storeCount }} 个店铺
          </span>
        </button>
        <span class="platform-list__controls">
          <el-button link size="small" @click="openEdit(platform)">编辑</el-button>
          <el-button link size="small" @click="emit('remove', platform.id)">删除</el-button>
        </span>
      </li>
    </ul>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑平台' : '新建平台'" width="480px">
      <el-form label-width="88px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="例如：AmiAmi" />
        </el-form-item>
        <el-form-item label="官网">
          <el-input v-model="form.website" placeholder="https://" />
        </el-form-item>
        <el-form-item label="地区">
          <el-input v-model="form.region" placeholder="JP / CN / US" />
        </el-form-item>
        <el-form-item label="默认币种">
          <el-input v-model="form.defaultCurrency" placeholder="JPY" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="form.name.trim() === ''" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.platform-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.platform-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.platform-list__title {
  margin: 0;
  font-size: 15px;
}

.platform-list__actions {
  display: flex;
  gap: 8px;
}

.platform-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.platform-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.platform-list__item.is-active {
  border-color: var(--el-color-primary);
  background: var(--color-primary-soft);
}

.platform-list__select {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: left;
}

.platform-list__name {
  font-weight: 500;
}

.platform-list__meta {
  font-size: 12px;
}

.platform-list__controls {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
</style>
