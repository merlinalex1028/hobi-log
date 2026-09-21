import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import App from './App.vue'
import { router } from './router'
import { installAuthGuard } from './router/guards'
import './styles/global.css'

installAuthGuard(router)

createApp(App).use(createPinia()).use(router).use(VueQueryPlugin).use(ElementPlus, { locale: zhCn }).mount('#app')
