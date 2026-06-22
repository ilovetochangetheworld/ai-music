import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 部署到 GitHub Pages 时位于 https://<user>.github.io/ai-music/，
// 因此生产构建需要以仓库名作为 base；本地开发仍用根路径。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ai-music/' : '/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    pool: 'forks',
  },
}))
