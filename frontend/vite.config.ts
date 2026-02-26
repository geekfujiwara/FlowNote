import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { ProxyOptions } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy: Record<string, ProxyOptions> = {}
  if (env.VITE_API_BASE_URL) {
    proxy['/api'] = { target: env.VITE_API_BASE_URL, changeOrigin: true }
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
  }
})
