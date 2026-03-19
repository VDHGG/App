import axios from 'axios'

const API_BASE = import.meta.env.DEV ? '/api/v1' : '/api/v1'

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

export type ApiError = {
  error: string
  message: string
  details?: Array<{ field: string; message: string }>
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data as ApiError
      err.message = data.message ?? err.message
    }
    return Promise.reject(err)
  }
)
