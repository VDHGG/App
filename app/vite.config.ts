import { loadEnv } from 'vite'
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.API_PROXY_TARGET?.trim() || 'http://localhost:3000'

  return {
    plugins: [react()],
    resolve: { alias },
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: false,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
