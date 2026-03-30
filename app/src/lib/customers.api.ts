import { api } from './api'

export type CustomerRank = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'

export type CustomerSummary = {
  customerId: string
  fullName: string
  email: string
  phone: string | null
  rank: CustomerRank
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
}

export async function listCustomers(): Promise<ListCustomersResponse> {
  const { data } = await api.get<ListCustomersResponse>('/customers')
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
