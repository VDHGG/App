import { api } from './api'

export type LoginAdminResult = {
  accessToken: string
  tokenType: 'Bearer'
}

export async function loginAdmin(email: string, password: string): Promise<LoginAdminResult> {
  const { data } = await api.post<LoginAdminResult>('/auth/login', { email, password })
  return data
}
