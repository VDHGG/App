import { api } from './api'

export type SystemUserSummary = {
  userId: string
  fullName: string
  email: string
  phone: string | null
  roleId: number
  customerId: string | null
  isActive: boolean
}

export type ListSystemUsersResponse = {
  users: SystemUserSummary[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ListSystemUsersQuery = {
  page?: number
  pageSize?: number
  search?: string
}

export async function listSystemUsers(
  query?: ListSystemUsersQuery
): Promise<ListSystemUsersResponse> {
  const { data } = await api.get<ListSystemUsersResponse>('/system-users', {
    ...(query ? { params: query } : {}),
  })
  return data
}

export async function getSystemUser(userId: string): Promise<SystemUserSummary> {
  const { data } = await api.get<SystemUserSummary>(`/system-users/${encodeURIComponent(userId)}`)
  return data
}

export type UpdateSystemUserRequest = {
  fullName: string
  email: string
  phone: string | null
  roleId: number
  isActive: boolean
  customerId: string | null
  newPassword?: string
}

export type UpdateSystemUserResponse = {
  user: SystemUserSummary
}

export async function updateSystemUser(
  userId: string,
  body: UpdateSystemUserRequest
): Promise<UpdateSystemUserResponse> {
  const { data } = await api.patch<UpdateSystemUserResponse>(
    `/system-users/${encodeURIComponent(userId)}`,
    body
  )
  return data
}
