import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dirs: [],
      directives: true,
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@hobilog/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5173 },
  build: {
    sourcemap: process.env.SOURCEMAP === 'true',
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'vendor-echarts', test: /node_modules[\\/].*(echarts|zrender)/ },
            { name: 'vendor-element', test: /node_modules[\\/].*(element-plus|@element-plus)/ },
            { name: 'vendor-calendar', test: /node_modules[\\/].*@fullcalendar/ },
            { name: 'vendor-supabase', test: /node_modules[\\/].*@supabase/ },
            { name: 'vendor-vue', test: /node_modules[\\/].*(vue|vue-router|pinia|@vueuse|@tanstack)/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
})
