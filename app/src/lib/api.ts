import axios from 'axios'
import { clearAccessToken, getAccessToken } from './authStorage'

export function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim().replace(/\/$/, '')
  }
  return '/api/v1'
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export type ApiError = {
  error: string
  message: string
  details?: Array<{ field: string; message: string }>
}

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const o = data as Record<string, unknown>
      if (typeof o.message === 'string' && o.message.trim() !== '') {
        return o.message
      }
      if (typeof o.error === 'string' && o.error.trim() !== '') {
        return o.error
      }
    }
    if (typeof err.message === 'string' && err.message.trim() !== '') {
      return err.message
    }
    if (err.code === 'ERR_NETWORK') {
      return 'Không kết nối được máy chủ API. Hãy chạy backend (npm run server) và thử lại.'
    }
  }
  if (err instanceof Error && err.message.trim() !== '') {
    return err.message
  }
  if (typeof err === 'string') return err
  return 'An unexpected error occurred.'
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const reqUrl = axios.isAxiosError(err) ? (err.config?.url ?? '') : ''
    const isChatRequest = reqUrl.includes('/chat')

    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const path =
        typeof window !== 'undefined' ? window.location.pathname : ''
      const publicPaths = ['/login', '/signup']
      if (
        !isChatRequest &&
        getAccessToken() &&
        !publicPaths.some((p) => path === p || path.startsWith(`${p}/`))
      ) {
        clearAccessToken()
        const search =
          typeof window !== 'undefined' ? window.location.search ?? '' : ''
        const from = encodeURIComponent(path + search)
        window.location.assign(`/login?from=${from}`)
      }
    }
    if (axios.isAxiosError(err) && err.response?.data) {
      const raw = err.response.data
      if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
        const data = raw as ApiError & { error?: string }
        err.message = data.message ?? data.error ?? err.message
      }
    }
    return Promise.reject(err)
  },
)
