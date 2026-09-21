<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const ROUTE_TITLES: Record<string, string> = {
  dashboard: '首页',
  orders: '订单',
  'order-create': '创建订单',
  'order-detail': '订单详情',
  'order-edit': '编辑订单',
  products: '商品库',
  'product-detail': '商品详情',
  collection: '收藏库',
  calendar: '日历',
  statistics: '统计',
  platforms: '平台 / 店铺',
  settings: '设置',
}

const route = useRoute()

const titles = computed(() =>
  route.matched
    .map(record => {
      if (typeof record.meta.title === 'string' && record.meta.title !== '') return record.meta.title
      if (typeof record.name === 'string') return ROUTE_TITLES[record.name] ?? ''
      return ''
    })
    .filter(title => title !== ''),
)

const items = computed(() => {
  const list = titles.value
  if (list.length === 0) return ['首页']
  return list[0] === '首页' ? list : ['首页', ...list]
})
</script>

<template>
  <el-breadcrumb class="app-breadcrumb" separator="/">
    <el-breadcrumb-item v-for="(title, index) in items" :key="`${title}-${index}`">
      {{ title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>
