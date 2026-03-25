import axios from 'axios'
import { clearAdminAccessToken, getAdminAccessToken } from './authStorage'

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
  const token = getAdminAccessToken()
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
      if (
        getAdminAccessToken() &&
        path.startsWith('/admin') &&
        !path.startsWith('/admin/login')
      ) {
        clearAdminAccessToken()
        window.location.assign('/admin/login')
      }
    }
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data as ApiError
      err.message = data.message ?? err.message
    }
    return Promise.reject(err)
  }
)
