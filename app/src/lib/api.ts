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
  if (err instanceof Error) return err.message
  return 'An unexpected error occurred.'
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const path =
        typeof window !== 'undefined' ? window.location.pathname : ''
      const publicPaths = ['/login', '/signup']
      if (
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
      const data = err.response.data as ApiError
      err.message = data.message ?? err.message
    }
    return Promise.reject(err)
  },
)
