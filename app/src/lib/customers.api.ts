import { api } from './api'

export type CustomerRank = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'

export type CustomerSummary = {
  customerId: string
  fullName: string
  email: string
  phone: string | null
  rank: CustomerRank
  isActive: boolean
  currentRentedItems: number
}

export type GetCustomerResponse = {
  customerId: string
  fullName: string
  email: string
  phone: string | null
  rank: CustomerRank
  isActive: boolean
  currentRentedItems: number
}

export type RegisterCustomerRequest = {
  fullName: string
  email: string
  phone: string
  rank?: CustomerRank
}

export type RegisterCustomerResponse = {
  customerId: string
  fullName: string
  email: string
  phone: string | null
  rank: CustomerRank
}

export type ListCustomersResponse = {
  customers: CustomerSummary[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ListCustomersQuery = {
  page?: number
  pageSize?: number
  search?: string
}

export async function listCustomers(query?: ListCustomersQuery): Promise<ListCustomersResponse> {
  const { data } = await api.get<ListCustomersResponse>('/customers', {
    ...(query ? { params: query } : {}),
  })
  return data
}

export async function getCustomer(customerId: string): Promise<GetCustomerResponse> {
  const { data } = await api.get<GetCustomerResponse>(`/customers/${customerId}`)
  return data
}

export async function registerCustomer(
  body: RegisterCustomerRequest
): Promise<RegisterCustomerResponse> {
  const { data } = await api.post<RegisterCustomerResponse>('/customers', body)
  return data
}

export type UpdateCustomerAdminRequest = {
  fullName: string
  email: string
  phone: string | null
  rank: CustomerRank
  isActive: boolean
}

export type UpdateCustomerAdminResponse = GetCustomerResponse

export async function updateCustomerAdmin(
  customerId: string,
  body: UpdateCustomerAdminRequest
): Promise<UpdateCustomerAdminResponse> {
  const { data } = await api.patch<UpdateCustomerAdminResponse>(
    `/customers/${encodeURIComponent(customerId)}`,
    body
  )
  return data
}
