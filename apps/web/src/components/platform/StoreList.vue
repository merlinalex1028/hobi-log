<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { CreateStorePayload } from '@/api/store.api'
import type { PlatformVo, StoreVo } from '@/types/models'

const props = defineProps<{
  stores: StoreVo[]
  platforms: PlatformVo[]
  platformId: string | null
  loading?: boolean
  total: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  create: [payload: CreateStorePayload]
  update: [id: string, payload: CreateStorePayload]
  remove: [id: string]
  'page-change': [page: number]
}>()

function emptyForm(): CreateStorePayload {
  return { name: '', platformId: props.platformId ?? undefined, url: '', contact: '', note: '' }
}

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<CreateStorePayload>(emptyForm())

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

function openEdit(store: StoreVo): void {
  editingId.value = store.id
  Object.assign(form, {
    name: store.name,
    platformId: store.platformId ?? undefined,
    url: store.url ?? '',
    contact: store.contact ?? '',
    note: store.note ?? '',
  })
  dialogVisible.value = true
}

function submit(): void {
  const payload: CreateStorePayload = { ...form }
  if (editingId.value) emit('update', editingId.value, payload)
  else emit('create', payload)
  dialogVisible.value = false
}
</script>

<template>
  <div class="store-list">
    <div class="store-list__header">
      <h2 class="store-list__title">店铺</h2>
      <el-button size="small" type="primary" @click="openCreate">新建店铺</el-button>
    </div>

    <p v-if="props.loading" class="text-secondary">加载中…</p>
    <p v-else-if="props.stores.length === 0" class="text-secondary">该平台下还没有店铺。</p>
    <table v-else class="store-list__table">
      <thead>
        <tr>
          <th>名称</th>
          <th>平台</th>
          <th>链接</th>
          <th>联系方式</th>
          <th class="store-list__actions-header">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="store in props.stores" :key="store.id">
          <td>{{ store.name }}</td>
          <td>{{ store.platformName ?? '未归属平台' }}</td>
          <td class="store-list__url">{{ store.url ?? '—' }}</td>
          <td>{{ store.contact ?? '—' }}</td>
          <td class="store-list__actions">
            <el-button link size="small" @click="openEdit(store)">编辑</el-button>
            <el-button link size="small" @click="emit('remove', store.id)">删除</el-button>
          </td>
        </tr>
      </tbody>
    </table>

    <el-pagination
      v-if="props.total > props.pageSize"
      class="store-list__pagination"
      layout="prev, pager, next, total"
      :current-page="props.page"
      :page-size="props.pageSize"
      :total="props.total"
      @current-change="emit('page-change', $event as number)"
    />

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑店铺' : '新建店铺'" width="480px">
      <el-form label-width="88px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="例如：AmiAmi 官方店" />
        </el-form-item>
        <el-form-item label="所属平台">
          <el-select v-model="form.platformId" placeholder="未归属">
            <el-option
              v-for="platform in props.platforms"
              :key="platform.id"
              :value="platform.id"
              :label="platform.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="链接">
          <el-input v-model="form.url" placeholder="https://" />
        </el-form-item>
        <el-form-item label="联系方式">
          <el-input v-model="form.contact" />
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
.store-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.store-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.store-list__title {
  margin: 0;
  font-size: 15px;
}

.store-list__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.store-list__table th,
.store-list__table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
}

.store-list__url {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.store-list__actions,
.store-list__actions-header {
  width: 120px;
}

.store-list__pagination {
  justify-content: flex-end;
}
</style>
