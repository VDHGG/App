import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

const alias = {
  '@domain': path.resolve(__dirname, './src/domain'),
  '@usecase': path.resolve(__dirname, './src/usecase'),
  '@port': path.resolve(__dirname, './src/port'),
  '@adapter': path.resolve(__dirname, './src/adapter'),
  '@infra': path.resolve(__dirname, './src/infra'),
}

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
