import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 使用相对路径，确保部署到任意静态托管平台都能正确加载资源
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
