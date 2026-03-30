import { api } from './api'

export type AuthRole = 'admin' | 'customer'

export type AuthSession = {
  accessToken: string
  tokenType: 'Bearer'
  role: AuthRole
  customerId: string | null
}

export type MeResponse = {
  sub: string
  role: AuthRole
  customerId: string | null
  fullName: string
  email: string
  phone: string | null
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const { data } = await api.post<AuthSession>('/auth/login', { email, password })
  return data
}

export async function registerAccount(body: {
  fullName: string
  email: string
  phone: string
  password: string
}): Promise<AuthSession> {
  const { data } = await api.post<AuthSession>('/auth/register', body)
  return data
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me')
  return data
}

export async function updateProfile(body: {
  fullName: string
  email: string
  phone: string
}): Promise<MeResponse> {
  const { data } = await api.patch<MeResponse>('/auth/me', body)
  return data
}

export async function changePassword(body: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  await api.post('/auth/change-password', body)
}
