// Changed on 2026-05-23 20:02:10
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 8081
    },
    define: {
      'process.env.PROJECT_URL': JSON.stringify(env.PROJECT_URL),
      'process.env.PUBLISHABLE_KEY': JSON.stringify(env.PUBLISHABLE_KEY),
      'process.env.JAMENDO_CLIENT_ID': JSON.stringify(env.JAMENDO_CLIENT_ID)
    }
  }
})

